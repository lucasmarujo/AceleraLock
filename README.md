# AceleraLock

App React Native (Expo) que ajuda o usuário a trancar os apps que tiram o tempo
dele. **Roda 100% no aparelho do usuário.** Não há backend, não há cadastro,
não há autenticação, não há nuvem, não há parceiro, não há servidor.

Tudo o que o app precisa saber — apps escolhidos, janelas, configuração de
bloqueio — vive no `AsyncStorage` do aparelho. Nada sai do celular.

## Estrutura

```
app/                       Rotas (expo-router). Sem backend por trás.
src/
  components/              Componentes React compartilhados.
  native/                  Ponte TS fina sobre o módulo nativo Android.
  state/                   Estado local, sem store global.
  theme/                   Tema de navegação (claro/escuro).
native/
  modules/aceleralock-blocker/
                           Módulo Expo (Android). Detecta app em primeiro
                           plano, desenha overlay de bloqueio, sustenta o
                           serviço de poll. Core Kotlin testado em JVM.
  plugins/                 Config plugin do Expo que liga o módulo ao prebuild.
docs/                      Documentação de produto e design.
backend.bkp/               Histórico: backend Spring Boot, infra Docker/blue-
                           green, e QA voltados à arquitetura com servidor.
                           Mantido apenas como referência — não roda.
```

## Veredito do app

`src/state/useProtectionVerdict.ts` decide a tela raiz em três valores:

| Veredito | Significado |
|---|---|
| `loading` | leitura assíncrona inicial ainda não respondeu |
| `onboarding-incompleto` | permissões de sistema ainda não concedidas, ou onboarding nunca concluído |
| `protegido` | permissões ok e onboarding concluído |

`app/_layout.tsx` mapeia cada veredito num grupo de rotas via `Stack.Protected`.

## Ponte nativa

`native/modules/aceleralock-blocker/` é o que efetivamente bloqueia. O
`src/native/blocker.ts` é a única ponte TS e expõe:

- `probePermissions()` — estado das permissões essenciais (Android).
- `criticalPackages()` — apps que nunca podem ser bloqueados (discador,
  emergências, ajustes, launcher, o próprio app).
- `setBlockedPackages(packages)` — lista de apps a trancar (vai pra
  `SharedPreferences` do módulo; o serviço lê no `onCreate`).
- `addGrant(packageName, endsAtIso)` / `clearGrant(packageName)` — desbloqueio
  temporário (decisão 16-a, cooldown local).
- `start()` / `stop()` — liga/desliga o serviço de poll.

O `core/` (Kotlin puro, dentro do módulo) é a `BlockDecider`: dado um pacote
em foreground, decide BLOCK ou ALLOW com base na `BlockPolicy` (lista de
bloqueio + grants ativos) e na lista de apps críticos.

## Dívida conhecida (pós-refatoração)

- **Defesa contra manipulação de relógio foi removida.** A `CorrectedClock`
  original ancorava em `serverTime`. Sem servidor, não há o que ancorar — o
  `BlockDecider` usa `Instant.now()` direto. Quem adianta o relógio do
  celular fura o cooldown. Pra reintroduzir defesa é preciso voltar a ter
  backend, ou uma autoridade de tempo alternativa (NTP do sistema, etc).
- **Válvula de 7 dias sem servidor foi removida.** Sem `OfflineFailsafeCounter`
  (era zerado por sync), não há contador de tempo offline. Se a app ficar
  sem nuvem... não tem mais nuvem. Sem efeito.
- **iOS continua sem módulo nativo.** Decisão original: adaptar
  `react-native-device-activity`, hoje fora de escopo.
- **O fluxo de onboarding é placeholder** (`OnboardingStepScreen`). Falta
  conectar a concessão real de permissão à marcação de onboarding completo
  e à transição pra home.
- **UI de seleção de apps não existe.** `readBlockedPackages` retorna lista;
  não há tela que escreva nela ainda.
- **UI de desbloqueio (cooldown local) não existe.** `addGrant` está pronta
  no nativo; falta a tela que conta o tempo e chama.

## Rodar

```bash
npm install
npm run typecheck
npm run test           # 8 testes JS puros, sem emulador
npm run android        # ou: npm run ios (iOS: sem bloqueador nativo)
```

Testes do `core/` Kotlin precisam de `gradle` no PATH (o `core/` não tem
wrapper próprio; roda via Gradle do prebuild do app).
