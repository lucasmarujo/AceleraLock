# aceleralock-blocker — módulo nativo Android

Detecta o app em primeiro plano, mantém o serviço vivo, sincroniza com o backend
por conta própria e desenha o overlay de bloqueio.

## ⚠️ Estado: o `core/` é compilado e testado; o `android/` ainda não

| Parte | Estado |
|---|---|
| `core/` — Kotlin puro, toda a decisão de bloqueio | **compila e roda: 27 testes verdes** |
| `android/` — adaptadores Android + ponte Expo | **escrito, nunca compilado** |

O `android/` depende de `expo-modules-core`, que vem de `node_modules`, e **o app
React Native ainda não existe neste repositório**. Não há como compilar essa
metade aqui, e não vou dizer que está verde sem ter rodado. Ela precisa de uma
primeira compilação assim que o app existir — espere erros de assinatura de API,
que é o normal em código nunca compilado.

Por isso a divisão não é enfeite arquitetural: **a lógica que decide bloquear não
depende de Android**, e é justamente a parte que pode ser testada hoje, sem
emulador e sem aparelho.

```bash
gradle :core:test     # 27 testes, JVM pura, segundos
```

## Onde está o risco, e por que ele está no core

Quatro decisões de segurança, todas no `core/` e todas cobertas por teste:

**1. O relógio do aparelho nunca decide bloqueio.** Uma janela "segunda,
08:00–12:00" comparada com `System.currentTimeMillis()` cai com três toques em
Ajustes. `CorrectedClock` ancora `(serverTime, elapsedRealtime)` a cada sync e
extrapola pelo monotônico, que o usuário não ajusta. `System.currentTimeMillis()`
aparece em um lugar só, `SystemWallClock`, e serve apenas para **medir o desvio**
contra o servidor.

Âncora velha continua boa: a deriva do monotônico é de segundos por semana, então
dias sem rede não degradam a decisão. O que mata a âncora é o **reboot**, que zera
`elapsedRealtime`.

**2. Sem âncora, bloqueia tudo.** Depois do reboot e antes do primeiro sync o
módulo fica `UNANCHORED` e bloqueia **todos os alvos**, não o último estado
conhecido. Congelar o último estado seria fail-open: bastaria esperar sair da
janela, ligar o modo avião e reiniciar para o bloqueio nunca mais voltar — mais
barato que os três toques do relógio. O custo é o simétrico: reiniciar sem rede
bloqueia os alvos mesmo fora de janela, até o primeiro sync. São os apps que o
usuário pediu para bloquear, não o aparelho, e o boot já dispara sync imediato.

**3. O contador do failsafe é acumulado, não instantâneo.** Relógio de parede é
burlável; `elapsedRealtime` puro zera no reboot e o failsafe nunca dispararia para
quem reinicia o aparelho toda semana. `OfflineFailsafeCounter` soma deltas
monotônicos e persiste a cada tick: **reboot é checkpoint, não reset**. Zera só
quando um sync completa — e `304` conta como completo, porque significa que
falamos com o servidor e o relógio veio no header.

**4. Só o nativo rotaciona refresh token.** Dois rotacionadores são
indistinguíveis de um token roubado: o backend veria um token consumido cujo
sucessor já foi usado, concluiria reuso e **revogaria a família inteira**,
deslogando o usuário e derrubando o bloqueio junto. A regra do servidor está
certa; o defeito seria ter dois rotacionadores. O JS entrega a sessão uma vez
(`adoptSession`) e depois só pede access token pronto.

A exclusão do `TokenRotator` é **dentro do processo**, o que basta porque o
serviço roda no mesmo processo do app — o manifesto declara `BlockerService` sem
`android:process`, de propósito, e `ProcessAffinityGuard` falha alto no boot se
isso mudar. Um processo separado daria dois locks e traria a corrida de volta.

## Quem sincroniza

O **serviço nativo**, não o JavaScript — o JS está morto enquanto o app está
fechado, que é o estado normal deste produto. Se o sync morasse no JS, aprovação
do parceiro nunca chegaria, mudança de perfil nunca chegaria, e o contador do
failsafe nunca zeraria: todo usuário caminharia para a liberação automática
mesmo com rede perfeita e servidor no ar.

Gatilhos: início do serviço e boot (é o que reancora o relógio), periódico
(15 min com tela ligada, 60 min apagada), **push recebido** (imediato), tela
ligando (throttle de 5 min), e `requestSync()` do JS.

O push como gatilho fecha o laço que o backend já previu: o payload carrega só
`{type, unlockRequestId}` — nenhuma decisão, nenhum prazo — porque o app é
obrigado a buscar a verdade no sync. Isso só funciona se alguém buscar com o app
fechado, e `PushMessagingService` é esse alguém.

## Overlay

`WindowManager.addView` com `TYPE_APPLICATION_OVERLAY`, direto do foreground
service. **Não inicio `Activity`**: o Android 10+ restringe *background activity
starts*, e embora `SYSTEM_ALERT_WINDOW` seja exceção a essa restrição, depender de
uma exceção que a Google já apertou duas vezes é frágil. `addView` não é início de
Activity, então a restrição não se aplica.

O overlay não impede o app de executar nem de tocar áudio — bloqueia visualmente
e consome o toque. Sem Device Admin não há melhor, e isso é decisão fechada.

## Apps críticos: duas barreiras

**Barreira 1** é no seletor (de `mobile`/`uxui`); este módulo só **fornece a
lista** por `criticalPackages()`. **Barreira 2** é em runtime: antes de desenhar
qualquer overlay, `BlockDecider` consulta o conjunto e nunca bloqueia um crítico
— nem quando está `UNANCHORED`.

`CriticalAppResolver` resolve **sempre dinamicamente**, nunca por nome de pacote
fixo: `ROLE_DIALER`, `ROLE_EMERGENCY`, resolvers de `ACTION_DIAL`,
`ACTION_SETTINGS` e `CATEGORY_HOME`, mais o próprio pacote. Recalculado no início
do serviço **e** em `PACKAGE_CHANGED`, porque o discador padrão pode mudar depois
de o usuário ter configurado os bloqueios — é só para isso que o
`PackageChangedReceiver` existe.

## Latência (D-lat)

`queryEvents` com `ACTIVITY_RESUMED`. O piso é o flush do próprio
`UsageStatsManager`, não o nosso laço: poll mais rápido melhora o caso médio e
não elimina o pior caso, medido pelo `qa` entre 0,5 e 2 s. Poll adaptativo
(400 ms dentro de janela, 2 s fora, pausado com a tela apagada) mais checagem
imediata em `SCREEN_ON` / `USER_PRESENT`.

Todos os números vivem em `BlockerTuning.kt`. **São ponto de partida, não
verdade** — o valor certo sai de medição em aparelho real e varia por fabricante.

## Sobrevivência a fabricante agressivo

Foreground service `specialUse` com notificação persistente e `START_STICKY`;
exceção de bateria; watchdog por `AlarmManager` (`setExactAndAllowWhileIdle`,
15 min); `WorkManager` periódico como segunda rede com constraint diferente, para
as duas morrerem por motivos diferentes; `BootReceiver`. Autostart de OEM é
instrução manual: não existe API nem forma de verificar, e deep link de OEM quebra
a cada ROM.

## O que falta

- Primeira compilação do `android/` junto com o app RN.
- `WorkManager` como segunda rede (o `AlarmManager` está feito).
- Fila de eventos de auditoria para o backend (`CLOCK_SKEW_DETECTED`,
  `UNLOCK_GRANTED_OFFLINE_FAILSAFE`) — hoje só há log.
- A view real do overlay: `BlockerService` usa um `FrameLayout` vazio como
  marcador; a tela é de `uxui`.
- Config plugin do Expo (`withAceleralockBlocker.js`).
- **Validação em Xiaomi ou Samsung real** — emulador não reproduz o kill agressivo.
