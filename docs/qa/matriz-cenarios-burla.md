# AceleraLock — Matriz de cenários de burla (teste adversarial)

**Versão:** 2.0 — 2026-08-29
**Autor:** QA
**Status:** documento de referência pós-pivô. Rege a validação do produto **local-only** (sem backend, sem conta, sem parceiro). `dev` e `mobile` devem planejar contra esta versão.
**Substitui:** a v1.0 (arquitetura com backend + cerimônia via parceiro) está congelada em `backend.bkp/qa/matriz-cenarios-burla.md` — não editar aquele arquivo, ele é histórico.
**`docs/qa/cenarios-suite-backend.md`:** não recriado. Decisão da QA: o objeto dele (mapear rotas HTTP para casos de teste) não existe mais — não há rota nenhuma. O detalhe de caso de teste que ele carregava para os grupos A/F/J agora vive direto nos testes unitários do `core` (Kotlin, `BlockDeciderTest`/`PolicyReaderTest`) e da camada JS (`tests/*.test.ts`), referenciados a partir das linhas desta matriz em vez de duplicados num documento à parte — um documento de mapeamento rota→cenário não tem razão de existir sem rota. Ele continua arquivado em `backend.bkp/qa/` como histórico.

---

## O que mudou (2026-08-29) — para quem está lendo pela primeira vez

O usuário refatorou por conta própria: **backend, banco, autenticação e parceiro de confiança saíram do produto.** O bloqueio agora é decidido inteiramente no aparelho. Isso não é um detalhe de implementação — é a mudança que reclassifica a matriz inteira, porque quase toda coluna "Bloqueável" da v1.0 dependia de um árbitro fora do alcance do dono do aparelho, e esse árbitro não existe mais.

**O que volta a existir para compensar, em parte:** uma espera cronometrada **local** — antes de desbloquear um app da lista e antes de desligar a proteção — medida em tempo monotônico acumulado e persistido (mesma mecânica do antigo `OfflineFailsafeCounter` da v1.0, git-recuperável em `8a7d64b`, com o sentido invertido: antes contava até liberar sozinho depois de ficar offline; agora conta até **permitir** a ação que o usuário pediu). Ela é imune a adiantar o relógio de parede e sobrevive a reboot (o `onBoot()` original zera só o cursor de leitura, não o acumulado — perde-se no máximo o delta do último tick).

**O que isso muda de promessa:** a espera **não impede** — quem tem paciência sempre consegue. Ela **custa**: quem está no impulso desiste, quem está decidido espera. Se qualquer linha abaixo sugerir que o produto impede alguma coisa que na real só atrasa, é erro de redação — corrigir, não deixar passar. É a frase que resume o produto inteiro agora: **você não consegue por impulso; consegue com paciência.**

**Estado da implementação nesta data (atualizado — 4ª revisão, commit `61761ec`):** a espera, a concessão, o registro de interrupção e agora também a tela de bloqueio (`BlockScreenView`) **existem e estão testadas em JVM (o que é testável em JVM — a `View` em si não é).** Rodei a suíte eu mesma de novo: `gradle :core:test --rerun`, `BUILD SUCCESSFUL`, XML confere **43/43** (`BlockDeciderTest`=5, `GrantWindowTest`=10, `PolicyReaderTest`=3, `ProtectionLogTest`=7, `WaitingPeriodTest`=18 — os 4 novos são `pendingUnlockFor`, a regra por trás do item 8 da Prioridade 1 no roteiro de device), timestamp fresco. **Não prova integração em aparelho** — `res/` (temas, drawables) nunca foi inflado de verdade. (Atualização 2026-08-30: `android/` **compila** — `gradlew :aceleralock-blocker:compileDebugKotlin` fecha `BUILD SUCCESSFUL`, o que também prova que os recursos referenciados existem, já que o `R` é gerado antes do Kotlin. Continua sem provar que a `View` infla e desenha certo num aparelho.) Três verificações novas foram para `docs/qa/roteiro-validacao-aparelho.md`, Prioridade 1: tema claro/escuro no contexto do serviço (suspeita mais forte do próprio `dev`), o botão "Fechar" removendo do primeiro plano de verdade, e o corpo do overlay não vazando a espera de um pacote para outro.

**Achado A2 original — RESOLVIDO pelo `dev`, li o código para confirmar.** `GrantWindow` substituiu `TemporaryGrant.grantEndsAt` (relógio de parede) por um **saldo em milissegundos que só diminui**, descontado por delta de `elapsedRealtime` (`GrantWindow.tick()`), sem nenhum instante de fim para comparar — atrasar a hora não tem o que esticar. E `BlockPolicy` não guarda mais grant nenhum (`BlockPolicy.kt` ficou só com `blockedPackages`); a concessão ativa vive isolada em `GrantWindow`, **uma só, apagada ao terminar** (`clear()`), não arquivada — resolve também o agravante do parágrafo anterior (concessão expirada não tem mais onde acumular como chave permanente, porque não existe lista). Testes que provam isso, todos verdes: `wallClockCannotExtendTheGrant`, `finishedGrantIsErasedNotArchived`, `rebootEndsTheGrant`, `powerOffDoesNotPreserveTheGrant`. Ver A2 na tabela — reclassificada.

**Achado investigado por mim → correção do `supervisor` → fechado pelo `dev` em `b909b5f`, três voltas, cada uma achando um erro na anterior — registrado para não repetir o padrão "aceitar o primeiro fechamento".** Minha leitura original (`onCreate()` chama `onBoot()` sem condição) estava certa para o código daquele momento, mas o `supervisor` achou que era **excessiva**: `START_STICKY` recicla o serviço sozinho por pressão de memória — rotina em aparelho modesto, não exceção — e cada reciclagem estava encerrando a concessão de quem não fez nada. Correção: `GrantWindow.onServiceStart()` agora só chama `tick()` (desconta o intervalo morto do saldo, não encerra), e `clear()` só dispara quando `tick()` detecta o monotônico voltando para trás (boot de verdade, `elapsedRealtime` zerou). `WaitingPeriod` não precisou dessa distinção — congelar o intervalo é o lado conservador nos dois casos, então trata reciclagem e boot igual. Ver A10 na tabela, fechado. **A investigação também fechou o A11** (crédito de ~2s da instância desencontrada da ponte): `BlockerService.onStartCommand` agora chama `waiting.onServiceStart()` a cada partida, reancorando o cursor — deixou de ser resíduo aceito, é correção. **E continua de pé o que motivou tudo isso:** o Android não entrega `BOOT_COMPLETED` nem alarme de watchdog a um app em *stopped state* (force-stop) — isso reclassificou **B1**, decisão já fechada pelo `supervisor`: não impedir, medir e mostrar. O novo `ProtectionLog` é essa medição — ver Grupo B.

---

## Modelo de ameaça

O adversário é **o próprio dono do aparelho** (sem mudança):

- Acesso físico total e ilimitado ao device.
- É administrador do sistema operacional (não é um device supervisionado por MDM corporativo, não é um menor sob controle parental de terceiro).
- Está **motivado** e tem tempo. Vai pesquisar, vai tentar de novo, vai aceitar fricção.
- Pode ter um segundo aparelho, um PC, e um amigo disposto a ajudar — mas isso deixa de importar: não há mais parceiro nem conta a fraudar em segundo aparelho (ver Grupo F).
- **Não** assumimos root/jailbreak como caso comum, mas ele está no radar como teto.

Restrições de arquitetura já fixadas pelo usuário:

- Android: `UsageStatsManager` + overlay (`SYSTEM_ALERT_WINDOW`). **Sem** Device Admin. **Sem** AccessibilityService.
- iOS: Family Controls / Screen Time (`ManagedSettings` + `DeviceActivityMonitor`). Sem MDM supervisionado.
- **(mudou)** ~~Cooldown cronometrado no servidor + aprovação de parceiro de confiança~~ → espera cronometrada **local**, tempo monotônico, sem árbitro externo.
- **(novo)** Sem backend, sem conta, sem parceiro, sem rede envolvida na decisão de bloquear/desbloquear.

Consequência direta, mais forte que na v1.0: sem servidor **e** sem parceiro, as ações destrutivas do dono (desinstalar, forçar parada, limpar dados, revogar permissão) continuam **não impedíveis** — mas agora também **não detectáveis por ninguém**. Isso não é falha de implementação, é o limite do que "100% local" pode prometer.

---

## Convenção de classificação

| Classe | Significado |
|---|---|
| **Bloqueável** | Dá para impedir de forma confiável com decisão de design correta. Se vazar, é bug. |
| **Mitigável** | Não dá para impedir 100%, mas dá para encarecer ou degradar com dignidade. Resta risco residual. |
| **Impossível de impedir** | O dono do device sempre consegue, dadas as APIs escolhidas. O produto **não pode prometer** que isso não acontece. Só cabe, na melhor das hipóteses, encarecer. |
| **Sem objeto** *(nova nesta versão)* | O vetor pressupõe uma peça que não existe mais (servidor, conta, parceiro, rede). A linha fica registrada por rastreabilidade, não por ter uma resposta. |

Antes de 2026-08-29, "Mitigável"/"Impossível de impedir" quase sempre vinham com um consolo: **P4 — o parceiro é avisado.** Esse consolo **não existe mais em linha nenhuma da matriz.** Onde isso muda a leitura de uma linha (não o rótulo, a tolerabilidade), está marcado **(sem P4)**.

Uma linha (B1) carrega o qualificador **"sem defesa possível, com caracterização deliberada"** — nem "Mitigável" (não reduz o vetor em nada) nem "Impossível de impedir" isolado (que sozinho não distingue "ninguém fez nada a respeito" de "decisão deliberada de medir e mostrar em vez de fingir que não aconteceu"). É a mesma distinção que "Sem objeto" faz para "resolvido" — evita o mal-entendido de achar que existe defesa onde existe só honestidade.

Plataforma: `AND` = Android, `iOS` = iOS, `AMBOS`.

---

## Primitivas de defesa (revisadas)

- ~~**P1 — Tempo é do servidor.**~~ **Morta.** Não há servidor. O tempo que decide qualquer coisa agora é local — e há dois relógios locais em jogo, com garantias diferentes: **de parede** (o que `BlockDecider` usa hoje para validar `grantEndsAt` — manipulável pelo dono) e **monotônico acumulado e persistido** (o que a espera nova vai usar — imune a ajuste de relógio, sobrevive a reboot). A defesa do grupo A depende de qual dos dois cada mecanismo usa. Ver nota "Achado" acima.
- **P2 — Fail-closed, redefinido.** Sem servidor, não existe mais "sem rede → bloqueado"; existe "sem tempo monotônico suficiente acumulado → bloqueado". O padrão é negar por default até a espera (quando existir) completar — não há mais uma condição de rede a falhar.
- ~~**P3 — Estado no servidor, atrelado à conta.**~~ **Morta.** O estado vive só em `SharedPreferences` do aparelho (JS: `AsyncStorage`/`blockedApps.ts`; nativo: leitura via `PolicyReader`). Reinstalar **não restaura nada** — não há conta para restaurar de onde. Ver Grupo B.
- ~~**P4 — Heartbeat + detecção de silêncio + alerta ao parceiro.**~~ **Morta, sem substituto.** Nenhuma interrupção de proteção é notificada a ninguém. Esta é a perda mais séria de toda a revisão — ver nota da tabela de classificação acima.
- ~~**P5 — Sem artefato de autorização portátil, recalculado pelo servidor.**~~ **Sem objeto.** Não há rede para forjar resposta nem token para roubar — mas também não há mais essa defesa específica: a razão agora é "nunca existiu tráfego", não "o servidor recomputa".
- **P6 — Re-arme automático, sobrevive parcialmente, com um buraco conhecido (ver B1).** Boot, atualização do app, retorno do processo → o agente relê o estado local e reaplica o bloqueio. Cai a perna "retorno de rede". E não cobre force-stop: um app em *stopped state* não recebe `BOOT_COMPLETED`, então nem o boot re-arma — só reabrir manualmente.
- **P7-local — Espera cronometrada antes de agir *(nova, substitui a válvula de escape da v1.0). [regra provada em JVM — `WaitingPeriod`, 14 testes]*** Antes de (a) desbloquear um app da lista, (b) desligar a proteção inteira, e (c) **encurtar a própria espera ou o próprio grant** (`WaitTarget.ChangeDurations` também passa pela mesma espera vigente — reduzir a duração não escapa da duração atual), o app exige tempo monotônico acumulado e persistido. **Ela não impede: ela custa.** Um pedido por vez, de propósito; cancelar é livre. Congela (nunca perde, nunca ganha) o tempo em que o serviço fica fora do ar, seja por reboot ou por reciclagem de processo — não precisa distinguir os dois, congelar é conservador nos dois casos. Falta só a integração Android (`android/` não compila ainda).
- **P-grant-local — Concessão temporária *(nova, substitui `TemporaryGrant` da v1.0). [regra provada em JVM — `GrantWindow`, 10 testes]*** Uma concessão ativa por vez, saldo em milissegundos que só diminui por delta monotônico, apagada ao terminar. Sem instante de fim para comparar, relógio de parede não tem o que afetar. Reboot de verdade **encerra** a concessão (política oposta à da espera, de propósito — ver A9); reciclagem de processo por pressão de memória **só desconta** o tempo fora do ar, não encerra (ver A10) — os dois são distinguíveis porque `elapsedRealtime` só zera no boot real.
- **P-log-local — Registro de interrupção *(nova). [regra provada em JVM — `ProtectionLog`, 7 testes]*** Não é defesa: não impede nada, sem Device Admin não há como. Registra que a proteção devia estar ativa e não estava, e por quanto tempo (nulo quando a interrupção atravessou reboot — sem relógio confiável para medir). Não sabe a causa (force-stop, OOM, crash e aparelho desligado são indistinguíveis) — ver B1.
- ~~**P8 — Failsafe offline do agente (7 dias sem servidor libera sozinho).**~~ **Morta como conceito** (não há "perder contato com o servidor" quando nunca houve servidor) **— mas a mecânica de contagem virou P7-local.** `OfflineFailsafeCounter` (soma de deltas monotônicos, checkpoint no reboot, nunca relógio de parede) é literalmente o motor que a nova espera reaproveita, de sentido invertido.

---

## A. Manipulação de tempo (a espera e a concessão) `[regra provada em JVM (43/43, rodado por mim) — integração Android ainda não compila, nada aqui verificado em aparelho]`

| # | Vetor | Reprodução | Esperado (v2.0) | Classe | Plat. |
|---|---|---|---|---|---|
| A1 | Adiantar relógio do sistema para terminar a espera mais rápido | Ajustes → Data e hora → data no futuro, durante a espera de desbloqueio/desligar proteção | **Sem efeito.** `WaitingPeriod.tick()` só avança por delta de `elapsedRealtime`; relógio de parede nunca entra na conta. Provado por `onlyMonotonicTimeAdvancesTheWait` (100 `tick()` sem avançar o monotônico → acumulado continua zero). | **Bloqueável** [provado em JVM] | AND (iOS não confirmado — ver I3) |
| A2 | Atrasar relógio do sistema para reviver uma concessão já encerrada, sem repetir a espera | Deixar a concessão zerar; atrasar o relógio; abrir o app alvo | **Reclassificado — achado original desta revisão, resolvido pelo `dev`.** `GrantWindow` não tem `grantEndsAt` nenhum para comparar: o saldo é monotônico e só diminui, e a concessão encerrada é **apagada** do armazenamento (`clear()`), não arquivada — não sobra registro para um relógio favorável ressuscitar. Provado por `wallClockCannotExtendTheGrant` e `finishedGrantIsErasedNotArchived` (a segunda checa a chave no armazenamento, não só a API pública). | **Bloqueável** [provado em JVM] | AND (iOS não confirmado — ver I3) |
| A3 | Trocar fuso horário | Ajustes → fuso manual, durante a espera ou concessão | Sem efeito, mesmo raciocínio de A1/A2 — tempo monotônico não lê fuso, não há relógio de parede em nenhum ponto do caminho. | **Bloqueável** [provado em JVM, por construção — nenhum teste lê fuso porque a implementação não lê `ZoneId`] | AMBOS |
| A4 | Cache de "libera às HH:MM" comparado ao relógio local | Iniciar a espera, fechar o app, adiantar o relógio, reabrir | Só é seguro se a UI (RN/JS, fora do `core`) **recalcula contra `PendingWait.remaining`/`GrantWindow.remaining()` a cada leitura**, nunca contra um timestamp absoluto salvo para exibição. O `core` já entrega a resposta certa (`remaining`, não um instante). **Primeira evidência a favor, parcial:** o overlay nativo (`BlockScreenView.bodyMessage()`) já segue o padrão certo — recalcula contra `remainingOf(blockedPackage)` a cada refresh de 30s, nunca guarda um "libera às HH:MM". Isso cobre a tela de bloqueio; a tela RN de espera (`/esperando`, contador ao vivo) é uma superfície diferente e continua sem confirmação. | **Bloqueável, se nenhuma UI inventar timestamp** [overlay nativo já correto — RN `/esperando` ainda pendente de leitura] | AMBOS |
| A5 | NTP falso / manipular sincronização de horário | Redirecionar `time.android.com` via DNS local | Sem rede envolvida na decisão em nenhum momento, sem efeito. | **Bloqueável** [provado em JVM, por construção] | AMBOS |
| A6 | ~~Drift/bug de relógio no próprio servidor~~ | — | Não há servidor. | **Sem objeto** | — |
| A7 *(era G7 na v1.0)* | Reiniciar o aparelho para zerar o contador da espera | Iniciar a espera; reiniciar o aparelho a cada poucos minutos até completar o total | `onBoot()` de `WaitingPeriod` zera só o **cursor de leitura** em memória, não o acumulado persistido — perde-se no máximo o delta do último tick, não o progresso todo. Provado por `rebootIsCheckpointNotReset` (15min+reboot+15min completam os 30) e `repeatedRebootsNeverResetProgress` (30 reboots seguidos, um por minuto, ainda completa). | **Bloqueável** [provado em JVM] | AND |
| A8 *(era G8 na v1.0)* | Combo: relógio + reboot + app parado durante a espera | Sequência combinada das linhas acima | Continua negando até o acumulado monotônico bater o total — nenhuma combinação de relógio+reboot antecipa a espera. | **Bloqueável** [provado em JVM] | AMBOS |
| A9 *(nova, veio da resposta do `dev`)* | Reiniciar o aparelho **durante uma concessão ativa**, esperando preservar o saldo restante | Abrir uma concessão, usar um pouco, reiniciar o aparelho, verificar se a concessão continua valendo | **Política deliberadamente oposta a A7/A8:** reboot **encerra** a concessão, não preserva. É escolha consciente do `dev`, não descuido — saldo puramente monotônico com reboot "transparente" deixaria desligar o aparelho por 3h preservar a concessão intacta; encerrar no boot faz "reiniciar para prolongar" custar a concessão inteira. Detecção em dois pontos redundantes: `onBoot()` chama `clear()` direto, e `tick()` também encerra sozinho se detectar o monotônico andando para trás (cobre o caso de o `BootReceiver` não disparar). Provado por `rebootEndsTheGrant` e `powerOffDoesNotPreserveTheGrant`. | **Bloqueável** [provado em JVM] | AND |
| A10 | Reciclagem do serviço por pressão de memória durante a espera ou a concessão (**não** confundir com A9, que é reboot real) | Deixar o Android matar e recriar o serviço por falta de memória, no meio de uma espera/concessão, sem tocar no aparelho de propósito | **Fechado em `b909b5f`, três voltas de revisão até chegar aqui — ver a nota "Achado" no topo.** `elapsedRealtime()` não zera numa reciclagem de processo, só no boot de verdade — o cursor persistido em `GrantWindow` distingue os dois sem heurística de limiar (valor atual < guardado = boot; ≥ guardado = mesma sessão). **Concessão desconta** o intervalo morto do saldo (não bloqueava nada enquanto o serviço estava fora, a pessoa já "usou" aquele tempo — descontar de novo seria cobrar duas vezes o contrário: não descontar seria dar de graça); **boot real ainda encerra** a concessão, como A9. **Espera congela** o intervalo nos dois casos (reciclagem ou boot) — não precisou distinguir, congelar já é o lado conservador nas duas situações. Provado por `GrantWindowTest.processRecycleDoesNotEndTheGrant`, `GrantWindowTest.timeWithTheServiceDeadIsDiscounted`, `WaitingPeriodTest.processRecycleFreezesTheWait`. | **Bloqueável** [provado em JVM — `SystemClock.elapsedRealtime()` real ainda não testado, só fake] | AND |
| A11 | Pedir um desbloqueio pela ponte JS logo depois de um `tick()` do serviço, para colher crédito grátis contra o acumulado da espera (era resíduo aceito, ~2s por pedido) | Chamar `addGrant`/pedir espera logo após o poll anterior do serviço | **Fechado em `b909b5f` — deixou de ser resíduo.** `BlockerService.onStartCommand` agora chama `waiting.onServiceStart()` a cada partida do serviço, reancorando o cursor da instância viva contra o pedido que acabou de chegar pela ponte — a instância desencontrada que dava o crédito de ~2s não tem mais margem para isso. Uma linha de correção, segundo o `dev`. | **Bloqueável** [provado em JVM — não verificado em aparelho] | AND |
| A11 *(nova, achado do `dev` ao revisar A10 — "ajuste 1")* | Pedir um desbloqueio pela ponte JS logo depois de o serviço ter processado um `tick()`, para colher até ~2s de crédito grátis contra o acumulado da espera | Chamar `addGrant`/pedir espera assim que possível após o poll anterior do serviço | `AceleralockBlockerModule` cria uma instância de `WaitingPeriod` **por chamada**, diferente da instância que o serviço mantém em memória — `request()` seta `lastTickElapsed` só na instância nova, não na do serviço. No próximo `tick()` do serviço, o delta calculado inclui até um intervalo de poll inteiro (~2s, `POLL_OUTSIDE_WINDOW`) que já tinha passado **antes** do pedido existir. Teto de ~2s por pedido, não acumula, não repete sem refazer o pedido (que zera o progresso). **Decisão do `dev`: não consertar sem mandado** — o custo de consertar (sincronizar as duas instâncias, ou trocar o padrão de criação) supera o ganho de fechar 2 segundos numa espera de 30 minutos. | **Mitigável, aceito como resíduo — não é bug pendente de correção** | AND |
| A12 *(nova, 2026-08-31)* | Desativar o modo restrito e pular a espera (adiantar relógio, reiniciar em loop, ou qualquer combinação de A1/A3/A7) | Ativar modo restrito, pedir desativação, aplicar qualquer burla de tempo conhecida | `WaitTarget.RestrictedModeOff` é mais um caso do `sealed interface WaitTarget` — `WaitingPeriod` é o mesmo motor das outras esperas, e as barreiras de A1/A3/A7 valem sem adaptação. Adiantar o relógio não avança, reboot congela o progresso (não zera), reciclar processo também congela. `consumeMaturedWait` em `BlockerService` lê a política atual antes de regravar, então outro caminho que tenha chegado via bridge durante a espera (ex.: `setBlockedPackages`) não é perdido. Provado em JVM por `WaitingPeriodTest.disablingRestrictedModeGoesThroughTheWait`, `onlyMonotonicTimeAdvancesRestrictedModeOffWait`, `rebootFreezesRestrictedModeOffWait`, `switchingTargetFromRestrictedModeOffRestarts`, `cancellingRestrictedModeOffIsFree`. | **Bloqueável** [provado em JVM] | AND |

---

## B. Ciclo de vida do processo e dos dados

**O que mudou nesta seção:** nenhum rótulo de linha piora tecnicamente (já eram, em maioria, "Impossível de impedir"), mas **toda linha perde P4** — antes "não impeço, mas o parceiro sabe"; agora ninguém sabe, nunca. Duas linhas pioram de fato, não só de tolerabilidade: **B2 e B6-B9** dependiam de P3 (estado na conta) para restaurar o bloqueio numa reinstalação — sem conta, **não há o que restaurar**. E **B1 piora mais que todas as outras juntas** — ver abaixo, achado do `dev` de 2026-08-29, provavelmente o vetor mais barato do produto inteiro.

| # | Vetor | Reprodução | Esperado (v2.0) | Classe | Plat. |
|---|---|---|---|---|---|
| B1 | Forçar parada do app | Ajustes → Apps → AceleraLock → Forçar parada | **Reclassificado de novo, agravado — achado do `dev` em 2026-08-29, verificado por mim lendo o código.** Force-stop põe o app no *stopped state* do Android (sem broadcast, sem `BOOT_COMPLETED`, sem watchdog) — isso não mudou. O que agravou: `protectionActive` (flag persistida, `b909b5f`) fica `true` depois do force-stop — correto, é o comportamento desejado da flag. Mas `computeVerdict()` (`verdict.ts`) só olha essa flag: `!protectionActive → 'pausado'`, senão `'protegido'`. Com o serviço morto e a flag em `true`, o veredito é **`protegido`**, que roteava (antes da correção abaixo) para `app/(protected)/index.tsx` — tela que **não chamava `start()`**, então nada religava o serviço. Resultado: **o app dizia "Você está protegido" com o serviço morto**, e o lapso nunca era apurado (`ProtectionLog.onServiceStart()` só roda quando o serviço é criado — ninguém o criava). Verifiquei isso lendo `verdict.ts` e o arquivo da tela diretamente, não só pelo relato. **Isto é pior que o furo original**: sem o conserto, force-stop não é "desliga até reabrir", é "desliga indefinidamente E o app confirma proteção falsa a quem abre para checar" — o furo original ao menos não mentia. **Corrigido: commit `62fb36c` (`mobile`), 24/24 e typecheck limpo, verificado pelo `supervisor`.** `app/(protected)/index.tsx` chama `AceleralockBlocker.start()` em `useFocusEffect` ao ganhar foco — religa o serviço morto, que passa por `onCreate()` → `ProtectionLog.onServiceStart()`, apurando o lapso. **Duas ressalvas de janela, não bugs, achado do `dev` ao revisar o próprio conserto:** por uma fração de segundo a tela pode mostrar "protegido" antes de `start()` rodar (o veredito é calculado antes do efeito disparar); e `downtimeTotalSeconds`/`downtimeLastSeconds` só refletem o lapso na leitura **seguinte** de `protectionState()`, não na que decidiu o veredito exibido. Nenhuma das duas é a mentira permanente de antes — são timing, documentadas no roteiro de device (Prioridade 3) para não virarem falso positivo de regressão. **Ainda pendente:** validação em aparelho real — ver `docs/qa/roteiro-validacao-aparelho.md`, Prioridade 3, cenário liberado para rodar. | **Sem defesa possível, com caracterização deliberada** — corrigido para entregar o que promete (não "Mitigável": não reduz o vetor, só garante que a medição não minta) | AND |
| B2 | Limpar dados / limpar armazenamento | Ajustes → Apps → AceleraLock → Armazenamento → Limpar dados | **Piora de verdade:** antes restaurava do servidor no próximo login (P3); agora **apaga a lista de bloqueio e os grants de vez**, sem login nenhum para restaurar de onde. Caminho de burla mais óbvio que existe, e agora é definitivo, sem exigir nenhum conhecimento técnico. | **Impossível de impedir** (era Mitigável — piora de rótulo) | AND |
| B3 | Limpar cache | idem, só cache | Sem efeito — dados de bloqueio não moram em cache (mesma garantia de antes, independente do backend). | **Bloqueável** | AND |
| B4 | Reiniciar o aparelho | Desligar/ligar | `BOOT_COMPLETED` re-sobe o agente e relê o estado local (P6). Janela entre boot e agente subir continua existindo. **(sem P4)** para avisar se o boot falhar em subir o agente em algum OEM. **Só vale se o app não estiver em *stopped state* — ver B1**: depois de um force-stop, reiniciar o aparelho não re-arma nada, porque o próprio `BOOT_COMPLETED` não chega. | **Mitigável** (mesmo rótulo, sem P4; condicional a B1 não ter acontecido antes) | AMBOS |
| B5 | Modo avião durante a janela de bloqueio | Ligar modo avião, usar o alvo | **Sem mudança de fato** — o motor de bloqueio sempre foi local (`UsageStatsManager` + overlay), nunca precisou de rede para bloquear. A v1.0 já dizia isso; fica ainda mais verdadeiro agora que não há rede em jogo em nenhum momento. | **Bloqueável** | AMBOS |
| B6 | Desinstalar o AceleraLock | Segurar ícone → Desinstalar | **O alvo fica 100% livre, permanentemente.** Sem Device Admin, nada impede a desinstalação — isso não mudou. O que mudou é que reinstalar **não restaura mais nada** (sem P3): o teto declarado do produto passou de "recuperável" para "definitivo". **[Investigação aberta do `dev`]:** se o Android Auto Backup restaurar o `SharedPreferences` na reinstalação, esta linha melhora de novo — **não assumir que funciona até ele confirmar.** | **Impossível de impedir** (mesmo rótulo — já era o pior — mas a consequência prática piorou: era recuperável, agora não é, salvo confirmação de Auto Backup) | AND |
| B7 | Desinstalar e reinstalar para "zerar" o histórico | Desinstalar, reinstalar | Antes o servidor restaurava o estado por conta (P3) e isso *impedia* o reset. Agora — sujeito à mesma investigação de Auto Backup de B6 — reinstalar plausivelmente **zera de fato**, o oposto da garantia da v1.0. | **Impossível de impedir** (era Bloqueável — inverteu, não só piorou) | AMBOS |
| B8 | Reinstalar sem fazer nenhum "login" | idem, mas o conceito de login não existe mais | Não há mais distinção entre B7 e B8 — não existe login para pular. Linha efetivamente absorvida por B6/B7. | **Sem objeto** (fundida em B6/B7) | AND |
| B9 | Desativar o app sem desinstalar (`disable`) | Ajustes → Apps → Desativar / via ADB | Equivale a B1 persistente. **(sem P4)**. | **Impossível de impedir** (mesmo rótulo, sem P4) | AND |
| B10 | Limpar dados de "Serviços do Google Play" | Ajustes → Apps → Google Play Services → Limpar dados | Sem FCM/push envolvido nesta arquitetura (nunca houve push do parceiro/servidor para derrubar) — o único risco real aqui é WorkManager agendado, se o agente usar. Menos exposta que na v1.0 porque não havia mesmo o que essa limpeza pudesse derrubar de crítico (push). | **Mitigável** (risco residual menor que na v1.0) | AND |
| B11 | Restaurar backup do device anterior ao bloqueio | Restaurar backup iCloud/Android | Sem conta, não há "estado do servidor" para prevalecer (P3 morta) — o que prevalece é o que estiver no backup local (se o backup incluir o `SharedPreferences`, ou não, ver a mesma investigação de Auto Backup de B6). Sem P4 para avisar se a autorização de Family Controls não sobreviver. | **Mitigável** (consequência a confirmar junto com B6) | AMBOS |
| B12 | Reset de fábrica | Apagar tudo | Tudo some, sem nada para restaurar (era P3, morta) e sem ninguém para avisar (P4, morta). Nunca foi impedível; agora também não é sinalizado. | **Impossível de impedir** (mesmo rótulo, sem P3 nem P4) | AMBOS |

**Nota sobre B1 — decisão fechada pelo `supervisor`, mecanismo fechado pelo `dev` (`b909b5f`):** registrar o tempo fora do ar e mostrar ao reabrir. Não impede nada, fecha a mentira por omissão de dizer "protegido" sobre um período em que não estava.

**Cenário de device pendente, só testável em aparelho real (não em JVM) — prioridade quando `android/` compilar:** force-stop pelo Ajustes → reabrir o app → conferir que o lapso aparece com a duração certa em `downtimeLastSeconds`/`downtimeTotalSeconds`. Segunda parte do mesmo cenário: force-stop, **reiniciar o aparelho** antes de reabrir o app → conferir que a interrupção aparece **contada** (`downtimeUnknownCount` incrementa) mas **sem duração** (`downtimeLastSeconds` = null). A regra em si está provada em `ProtectionLogTest` (7 testes, com relógio fake); o que falta é confirmar que o `SystemClock.elapsedRealtime()` de verdade se comporta como o fake assume — é a primeira vez nesta revisão que isso entra em jogo de verdade.

---

## C. Otimização de bateria e "background killers" de OEM

Todas as linhas C1-C10 mantêm o **mesmo rótulo** da v1.0 — a defesa (foreground service, exceções de bateria pedidas no onboarding) sempre foi local, nunca dependeu de backend. **A única mudança é a Nota transversal C.**

| # | Vetor | Esperado (v2.0, resumido — ver v1.0 para reprodução completa) | Classe | Plat. |
|---|---|---|---|---|
| C1 | Doze / App Standby mata o serviço | Foreground Service + exceção de bateria pedida no onboarding + WorkManager watchdog. Sem mudança de mecanismo. | Mitigável | AND |
| C2-C5 | Autostart/gerenciamento de bateria por OEM (MIUI, Samsung, Huawei, Oppo/Vivo) | Onboarding guiado por fabricante, sem mudança de mecanismo. | Mitigável | AND |
| C6 | "Limpar tudo" nos Recentes | `START_STICKY` + `AlarmManager` + watchdog, sem mudança. | Mitigável | AND |
| C7 | Economia de bateria extrema | Sem mudança de mecanismo. | Mitigável | AND |
| C8 | Task killer de terceiro | Equivale a B1 recorrente. | Impossível de impedir | AND |
| C9 | Adaptive Battery após "uso raro" | Sem mudança de mecanismo. | Mitigável | AND |
| C10 | iOS `DeviceActivityMonitor`, orçamento curto | Sem mudança — shield é do sistema, não da extensão. | Mitigável | iOS |

**Nota transversal C (atualizada):** continua verdade que nenhum OEM killer é "burla" no sentido de vencer a criptografia — todos produzem o mesmo efeito, o agente para e o alvo fica acessível. **O que mudou é a segunda metade da promessa.** A v1.0 dizia: "se a proteção cair, seu parceiro fica sabendo na hora." Essa metade **morreu** — não há mais parceiro, não há mais P4. A promessa honesta agora é só a primeira metade: "a proteção pode cair sem eu perceber, e ninguém vai me avisar." Isso é uma degradação de confiabilidade prática do produto, não uma questão de rótulo de matriz.

---

## D. Caminhos laterais até o app bloqueado

**Sem mudança nenhuma nesta seção.** O motor de detecção (`UsageStatsManager`, pacote em foreground) nunca dependeu de servidor, conta ou parceiro — D1-D14 e D-lat da v1.0 valem exatamente como estavam. Ver v1.0 (`backend.bkp/qa/matriz-cenarios-burla.md`) para a tabela completa; não duplicado aqui por não ter mudado uma linha sequer.

---

## E. Revogar permissões / desarmar a proteção

Mesmo padrão do Grupo B/C: **rótulo igual, tolerabilidade pior — perde P4 em todas as linhas.** E10 (root/jailbreak) ganha uma nuance nova: com a espera agora sendo local e verificável por engenharia reversa/hook, root vira um vetor mais direto contra a *nova* defesa do que era contra a antiga (que dependia de um servidor fora do alcance de qualquer hook local).

| # | Vetor | Esperado (v2.0) | Classe | Plat. |
|---|---|---|---|---|
| E1 | Revogar Acesso ao Uso | Detector para. **(sem P4)** — antes alertava o parceiro; hoje, silêncio. | Impossível de impedir | AND |
| E2 | Revogar Sobreposição (overlay) | Sem tela de bloqueio. **(sem P4)**. | Impossível de impedir | AND |
| E3 | Revogar via ADB | idem E1/E2, ADB onipotente do lado do dono. **(sem P4)**. | Impossível de impedir | AND |
| E4 | `pm clear` / `am force-stop` via ADB | Equivale a B1/B2 via cabo — e B2 agora é o achado que piorou (ver Grupo B). **(sem P4)**. | Impossível de impedir | AND |
| E5 | Modo de Segurança do Android | Apps de terceiros desabilitados; re-arme ao sair (P6). **(sem P4)** durante a janela no modo seguro. | Impossível de impedir | AND |
| E6 | iOS: desativar Tempo de Uso | Sem MDM supervisionado, o dono controla. **(sem P4)**. | Impossível de impedir | iOS |
| E7 | iOS: revogar autorização de Family Controls | idem E6. **(sem P4)**. | Impossível de impedir | iOS |
| E8 | iOS: apagar/"Offload" o app | Remove o shield. Reinstalar — sujeito à mesma incerteza de restauração local de B6 (iOS não tem exatamente Auto Backup do Android, mas iCloud Backup pode ter papel equivalente; não investigado ainda). **(sem P4)**. | Impossível de impedir | iOS |
| E9 | Alterar/definir o código de Tempo de Uso para trancar o AceleraLock fora | Sem mudança — segue fora da arquitetura, frágil e não recomendado. | Mitigável | iOS |
| E10 | Root/jailbreak: Frida, Xposed/LSPosed, hook no cliente | **Fica mais grave que na v1.0.** Antes, a defesa de tempo vivia no servidor — fora do alcance de qualquer hook local, então root só atacava a UI/local enforcement, não o cronômetro. Agora **o cronômetro inteiro é local** (a nova espera monotônica): um hook competente pode em tese ler/reescrever o acumulador direto, sem precisar nem manipular relógio de parede. Não há mais nenhuma barreira que sobreviva a root determinado. | Impossível de impedir (era já o rótulo, mas a superfície de ataque cresceu) | AMBOS |
| E11 | Remover perfil de configuração / MDM | Sem supervisão, removível pelo dono. | Impossível de impedir | iOS |

---

## F. Conluio social / o "parceiro de confiança" — Grupo inteiro sem objeto

**Não há mais parceiro.** F1-F10 da v1.0 (segunda conta, identidade fraca, amigo complacente, engenharia social, pacto recíproco, forjar aprovação, replay, interceptar canal, trocar de parceiro) pressupunham uma pessoa e um servidor de vínculo que não existem mais no produto. Toda a seção fica **Sem objeto**. Preservada em `backend.bkp/qa/matriz-cenarios-burla.md` como referência caso o parceiro volte a ser cogitado no futuro — se isso acontecer, é redesenho de produto, não reclassificação de matriz.

---

## G. Rede e canal cliente–servidor — quase todo sem objeto

**G1-G6: Sem objeto.** Bloquear domínio do backend, MITM para forjar "aprovado", replay de sync, servir sync antigo do cache, desregistrar push, combo relógio+offline+cache — todos pressupõem um canal cliente-servidor que não existe mais. Não há domínio a bloquear, não há resposta de rede a forjar, não há push a desregistrar.

**G7 e G8: migraram para o Grupo A como A7 e A8** — nunca foram realmente "sobre rede", eram sobre o contador monotônico local mesmo na v1.0 (o `OfflineFailsafeCounter` já era um mecanismo 100% de aparelho). Ver A7/A8 acima; não duplicado aqui.

---

## H. Específico Android — `UsageStats` + overlay

**Sem mudança nenhuma.** H1-H9 nunca dependeram de servidor. Ver v1.0 para a tabela completa — vale exatamente como estava.

---

## I. Específico iOS — Family Controls / Screen Time

A maior parte é intocada (Family Controls sempre foi API local do dispositivo). A exceção é I3, espelhando o Grupo A.

| # | Vetor | Esperado (v2.0) | Classe | Plat. |
|---|---|---|---|---|
| I1 | Desautorizar Family Controls / desligar Tempo de Uso | Ver E6/E7. **(sem P4)** — antes alertava o parceiro. | Impossível de impedir | iOS |
| I2 | Apagar / offload do app | Ver E8. **(sem P4)**. | Impossível de impedir | iOS |
| I3 | Alterar data/hora | **Espelha A1/A3** — sem efeito **se e somente se** a implementação iOS da espera também usar um relógio monotônico local (`ProcessInfo.systemUptime` ou equivalente), não `Date()`/`Date.now()`. **Não confirmado**: o módulo `core` lido nesta revisão é Kotlin, Android-only — não há evidência ainda de que o lado iOS (Swift) tenha o mesmo cronômetro monotônico. **Não assumir paridade entre plataformas sem o `dev`/`mobile` confirmarem que o lado iOS existe e usa a mesma base de tempo.** | Bloqueável, condicional [pendente + não confirmado para iOS] | iOS |
| I4 | Restaurar backup anterior ao bloqueio | Ver B11 — sem P3 para prevalecer; o que sobrevive é o que estiver no backup local. | Mitigável | iOS |
| I5 | Granularidade do `DeviceActivitySchedule` | Sem mudança — shield contínuo, não depende do schedule. | Mitigável | iOS |
| I6 | Bypass de shield conhecido entre versões de iOS | Sem mudança — risco inerente à API do sistema. | Mitigável | iOS |
| I7 | Segundo device no mesmo Apple ID | Ver D14. Sem mudança. | Impossível de impedir | iOS |
| I8 | Web no Safari | Ver D5. Sem mudança. | Impossível de impedir | iOS |

---

## J. Perda real de acesso — quase todo sem objeto agora

**Reenquadramento total.** A v1.0 resolvia "perda de acesso" com duas válvulas arbitradas por servidor (48h sem parceiro, 7 dias offline). Sem servidor, **não existe mais "perda de acesso" no sentido antigo** — não há parceiro para sumir, não há servidor para perder contato. O que existe é só a espera local, que qualquer usuário (legítimo perdendo paciência ou adversário burlando) atravessa do mesmo jeito.

| # | Cenário (v1.0) | Estado em v2.0 | Classe | Plat. |
|---|---|---|---|---|
| J1-J3 | Parceiro sumiu/recusa/morreu | **Sem objeto** — não há parceiro. | Sem objeto | — |
| J4 | Servidor fora do ar / 7 dias sem rede | **Sem objeto** — não há servidor, e a espera nova não depende de rede em nenhum momento (nunca esteve "online" para poder cair). | Sem objeto | — |
| J5 | Deleção de conta (LGPD) | **Sem objeto** — não há conta. Se existir alguma exportação/limpeza local de dados por privacidade, é um requisito novo e separado, não herdeiro desta linha. | Sem objeto | — |
| J6 | Bloqueio acidental de app crítico (discador, SMS, etc.) | **Sem mudança** — sempre foi validação do seletor nativo, nunca do servidor (o backend nunca soube qual app um id representava). Ver v1.0 para o texto completo; requisito do `mobile`. | Bloqueável | AND/iOS |
| J7 | Emergência legítima sem rede, app bloqueado | **Decisão fechada do `supervisor`: não existe quota de emergência.** Uma quota local seria um botão de desbloqueio imediato com nome bonito, aprendido em duas semanas — zeraria a espera para todo mundo. A emergência de verdade já tem caminho: **a lista de apps críticos** (discador, mensagens, o que a pessoa marcar) nunca é bloqueada — emergência é ligar para alguém, não abrir o Instagram. | **Coberto pela isenção de apps críticos** (ver J6) | AMBOS |
| J8 | Viagem entre fusos deixa o fim da espera num horário ruim | Espelha A3 — sem efeito se a espera for monotônica (duração acumulada, não hora de parede). | Bloqueável [pendente] | AMBOS |
| J9 | Duplo clique em "pedir liberação"/"desligar proteção" | Precisa de idempotência **local** agora (não há mais `requestId` de servidor a deduplicar) — um único timer ativo por ação, não dois iniciados em paralelo por clique duplo. Teste obrigatório quando a UI da espera existir. | Bloqueável, a testar [pendente] | AMBOS |
| J10 | Texto longo/emoji no motivo enviado ao parceiro | **Sem objeto** — não há parceiro para receber motivo nenhum. Se sobrar algum campo de texto local (ex.: nota pessoal), é vetor novo e diferente, não este. | Sem objeto | — |
| J11 | Console/log limpo | **Sem mudança** — sempre foi validação de qualidade de código, nunca dependeu de servidor. Continua valendo: erro novo no console/logcat é defeito. | Bloqueável | AMBOS |
| N4 | Isolar da rede por 7 dias para forçar o failsafe | **Sem objeto** — não havia "estar online" para poder se isolar de propósito; o app sempre rodou sem rede. A ideia de "custo alto para escapar" migrou inteira para a espera do Grupo A (que custa tempo, não conectividade). | Sem objeto (superseded por A1/A7) | AMBOS |

---

## Seção final — o que a promessa sustenta agora

A versão v1.0 desta seção prometia coisas que dependiam de P3/P4/P5/P7/P8 — todas mortas. Reescrita do zero, não editada por cima, porque a antiga afirmava coisas que deixaram de ser verdade (ex.: "toda interrupção gera alerta ao parceiro" — **falso agora**, e deixar isso no documento seria a promessa inflada que o `supervisor` pediu para eu vigiar).

**O mais barato de todos, atualizado nesta revisão — force-stop (B1).** Dois toques em Ajustes, sem perda de dados, reversível a qualquer momento, e **sobrevive a reboot** porque o Android para de entregar qualquer broadcast a um app em *stopped state* — nem `BOOT_COMPLETED`, nem o alarme do watchdog. Mais barato que esperar, mais barato que desinstalar. Sem Device Admin não há defesa nem detecção antes do fato.

**Em seguida, o que é fisicamente impossível impedir:**
1. Desinstalar o AceleraLock / apagar o app — **isso é definitivo**, não recuperável (salvo Auto Backup confirmado pelo `dev`, ver B6). Mais caro que force-stop (perde configuração, exige reconfigurar), mas ainda mais barato que na v1.0 (não há mais conta para restaurar depois).
2. Limpar dados, revogar permissão, ADB, Modo de Segurança, reset de fábrica.
3. Ver o app alvo na versão web, num clone, ou noutro perfil/usuário do Android.
4. Usar outro aparelho onde o AceleraLock não está.
5. A janela de latência do `UsageStatsManager` no Android.
6. Root/jailbreak com hooking — **e agora com superfície maior**, porque o cronômetro que a burla mais precisa vencer é local (ver E10).

**O que NINGUÉM detecta mais, e isso é uma perda real em relação à v1.0, não um detalhe:** toda a lista acima, na v1.0, vinha com "mas seu parceiro sabe". Agora nenhuma delas gera qualquer sinal para qualquer pessoa. O usuário (ou quem quer que dependa dele manter o bloqueio) só descobre abrindo o próprio app e olhando.

**A única válvula de escape projetada de propósito, e ela é honesta por definição:** a espera cronometrada local antes de desbloquear ou desligar a proteção. Não impede — custa. Sobrevive a relógio adiantado/atrasado e a reboot — **resolvido**: `GrantWindow` não tem mais instante de fim em relógio de parede para o A2 explorar, provado em JVM (ver A2). Não tem prazo arbitrado por ninguém além do próprio código; o usuário que espera, consegue, sempre — é o desenho, não um furo. Mas ela só entra em jogo se o app estiver rodando — force-stop passa por cima dela sem precisar vencê-la (ver B1).

**Frase honesta para este produto, substituindo a da v1.0** (que dependia de "seu parceiro sabe", e isso não é mais verdade): **"você não consegue por impulso — mas se quiser sair rápido, dois toques em Ajustes bastam, ninguém mais vai saber disso além de você, e nem o próprio aparelho vai perceber até você abrir o app de novo."**
