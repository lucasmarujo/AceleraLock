# AceleraLock — Roteiro de validação em aparelho real (Android)

**Versão:** 1.0 — 2026-08-29
**Autor:** QA
**Status:** **PENDENTE.** `android/` ainda não compila no projeto; este roteiro é para o dia em que `expo prebuild` rodar contra um device de verdade. Não executado, não pode ser — escrito contra o que o produto **é** hoje (`GrantWindow`, `WaitingPeriod`, `ProtectionLog`, `BlockDecider`, todos lidos no código atual), não contra plano.
**Pré-requisito para começar:** `dev` confirma que `android/` compilou e o app instala e abre num device físico.

## Filtro de escopo — por que cada item está aqui

**Só entra o que aparelho prova e os 39 testes de JVM não provam.** As regras (espera monotônica, concessão, distinção reboot/reciclagem, registro de interrupção) já estão cobertas — repetir isso manualmente em device seria gastar a sessão mais cara do projeto validando o que já está validado. O que falta é **integração com a plataforma**: coisas que só existem quando há uma `WindowManager` de verdade, um `UsageStatsManager` de verdade, um `SystemClock.elapsedRealtime()` de verdade, e um fabricante de verdade decidindo se mata o processo.

Cada bloco abaixo diz explicitamente, na primeira linha, por que JVM não bastava.

---

## Antes de tudo: o que iniciar assim que o app abrir

Dois blocos (5 e 6) precisam de **horas** rodando para dar resposta. Não são o primeiro passo lógico do roteiro, mas são o primeiro passo **no relógio** — se só forem iniciados depois de tudo o mais, a sessão acaba antes de eles darem resultado.

**No minuto zero da sessão:** configure o bloqueio, ligue a proteção, e deixe o aparelho com a tela apagada e sem uso direto (bloco 5) já rodando em paralelo enquanto você executa os blocos 1-4 na mão. Anote o horário de início — é o dado que o bloco 5 e o bloco 6 vão precisar no fim.

**Anote sempre, para todo resultado deste roteiro:** modelo do aparelho, versão do Android, fabricante/skin (MIUI, One UI, ColorOS, stock, etc.) e se a otimização de bateria estava ligada. Um resultado de device é sempre **"neste aparelho, nesta condição"**, nunca uma generalização — se der só um aparelho na primeira sessão, registre qual, porque o próximo teste noutro fabricante pode discordar sem que nenhum dos dois esteja errado.

---

## Prioridade 1 — o overlay aparece de verdade e bloqueia o toque

**Por que só aparelho prova:** `OverlayPresenter` chama `WindowManager.addView` — não existe `WindowManager` real fora de um device (ou emulador, mas ver ressalva no fim do bloco). Nenhum teste de JVM toca nisso.

**Pré-condição:** app configurado com pelo menos um alvo na lista de bloqueio, proteção ligada, permissão de sobreposição concedida.

**Passo a passo:**
1. Abrir o app alvo. Cronometrar quanto tempo leva até o overlay cobrir a tela (o piso esperado é a janela de latência do `UsageStatsManager`, ~0,5-2s, já documentada na matriz — D-lat).
2. Com o overlay em tela, tentar tocar em qualquer ponto onde o app alvo estaria — abrir um post, tocar num botão do app por baixo.
3. Puxar a cortina de notificações por cima do overlay, depois voltar.
4. Girar a tela (se o app suportar rotação) com o overlay em tela.
5. Testar em pelo menos duas versões de Android diferentes se houver mais de um aparelho disponível — `WindowManager.LayoutParams` muda de comportamento entre versões (Android 10+ restringe *background activity starts*; o overlay usa `addView`, não `Activity`, então não deveria ser afetado — mas é exatamente o tipo de suposição que só device confirma).

**Observar:** o overlay cobre a tela inteira sem brecha (incluindo atrás da barra de navegação/status, se o layout não excluir explicitamente); nenhum toque no passo 2 chega ao app por baixo; o overlay volta a cobrir a tela depois da cortina de notificações fechar (passo 3); sobrevive à rotação (passo 4) sem sumir ou deixar a tela sem cobertura por um frame.

**Reprova se:** qualquer toque no passo 2 alcançar o app alvo por baixo do overlay (o app não define `FLAG_NOT_TOUCHABLE`, então o esperado é bloquear — se algo vazar é regressão); o overlay sumir e não voltar depois da cortina de notificações; a rotação derrubar o overlay sem recriar.

**Ressalva sobre emulador:** dá para começar num emulador para pegar erro grosseiro rápido, mas `SYSTEM_ALERT_WINDOW` e comportamento de overlay têm histórico de divergir por fabricante (MIUI e alguns OEMs têm camada própria de permissão de overlay, às vezes com toggle adicional escondido) — **não fechar este item só com emulador**.

**Três verificações adicionais, achado do `dev` (`61761ec`) sobre `BlockScreenView` — a primeira é a que ele mais desconfia:**

6. **Tema claro/escuro no contexto do serviço — prioridade alta dentro desta prioridade.** O overlay é inflado pelo serviço via `WindowManager.addView`, **fora de qualquer Activity**. As cores (`values`/`values-night`) contam com o contexto do serviço seguir o modo do sistema (o cadeado da marca é um asset só, que lê nos dois temas — desde 2026-08-30 não há mais par `drawable`/`drawable-night`) — o código não lê `uiMode` manualmente, de propósito, para não haver dois lugares decidindo o tema. **Passo:** abrir um app bloqueado com o sistema em tema claro, depois trocar para tema escuro (Ajustes → Exibição) e abrir de novo (ou alternar com o overlay em tela, se o Android propagar a mudança de config para uma `View` de `WindowManager` sem recriação — vale testar as duas formas). **Reprova se:** fundo e escudo não trocarem juntos com o sistema — o caso citado pelo `dev` era escudo turquesa sobre canvas claro (ou o oposto), que é o par que reprova contraste sozinho. Agora o que muda com o tema é o fundo, o título, o corpo e o botão — o cadeado fica igual nos dois, então o que se observa é se o **texto** e o **preenchimento do botão** trocam junto com o sistema.
7. **"Fechar" tira do primeiro plano, não só esconde.** O botão manda para a home do Android; o overlay não deveria voltar sozinho. **Passo:** com o overlay em tela, tocar "Fechar", contar ~1-2s. **Reprova se** o overlay reaparecer sozinho nesse intervalo — sinal de que o botão só escondeu a view e o detector viu o app bloqueado em primeiro plano de novo no tick seguinte (o app-alvo continua em Recentes de propósito; reaparecer *depois* de o usuário reabrir o alvo por conta própria não é isto, é o comportamento normal).
8. **A frase motivacional muda a cada tentativa, e o shimmer para junto com o overlay.** Substituiu a verificação de vazamento de espera entre pacotes: a contagem saiu desta tela em 2026-08-30, então não há mais o que vazar. **Passo:** abrir um app bloqueado, ler a frase, tocar "Fechar", abrir de novo — três ou quatro vezes. Depois, com o overlay em tela, apagar a tela do aparelho e acender de novo. **Reprova se** a frase se repetir em tentativas seguidas (o sorteio é feito na construção da `View`, então repetir sugere que o `OverlayPresenter` está reaproveitando a `View` quando não deveria); se a frase trocar sozinha com o overlay parado na tela (o sorteio vazou para algum ciclo de refresh); ou se o `ValueAnimator` continuar rodando depois do `onDetachedFromWindow` (visível como consumo de bateria com a tela apagada). **Verificar também reduce-motion:** Ajustes → Opções do desenvolvedor → escala de duração do Animator = desligada; a frase deve aparecer **estática e legível** na cor `text_secondary`, sem gradiente travado no meio da varredura.

**Duas coisas que podem aparecer "erradas" e não são bug do overlay — não reportar sem confirmar contra o código primeiro:**
- **Nome do app genérico** ("Este app está bloqueado." em vez de "Instagram está bloqueado.") é o fallback de `appLabel()` funcionando: a partir do Android 11 a visibilidade de pacotes é restrita, e sem `<queries>` no manifesto a resolução do nome pode falhar. Documentar se aparecer, mas o achado correto é "falta `<queries>`", não "o app quebrou".
- **Não existe mais botão "Abrir AceleraLock":** ele saiu em 2026-08-30 junto com a contagem de espera. A tela tem uma ação só, "Fechar". Se alguém reportar que o botão sumiu, é a mudança, não regressão — o caminho para o app é a gaveta. Com isso, a tela deixou de depender da exceção frágil de `SYSTEM_ALERT_WINDOW` a *background activity starts* (ver Prioridade 1, passo 5) para qualquer coisa além da própria home do sistema.

---

## Prioridade 2 — o detector de app em primeiro plano acerta, inclusive nos casos difíceis

**Por que só aparelho prova:** `ForegroundAppDetector` consulta `UsageStatsManager.queryEvents` de verdade — o emulador reporta eventos de foreground de forma menos fiel que hardware real, e transição rápida entre apps é justamente onde a diferença aparece.

**Pré-condição:** mesma de Prioridade 1.

**Passo a passo — casos básicos primeiro:**
1. Abrir o app alvo a partir da tela inicial, de uma notificação, e de um widget — confirma que o motor de detecção reage independente de como o app foi aberto (D1-D3 da matriz de burla).
2. Abrir o alvo, sair, abrir de novo, repetidamente e rápido (rajada) — cada abertura deve registrar e bloquear, sem "furo" em nenhuma delas.

**Passo a passo — casos difíceis, o que realmente vale a sessão:**
3. Abrir o alvo, abrir o teclado (ex.: campo de busca dentro do app) — confirmar que o teclado não conta como "saiu do app" e não derruba o overlay indevidamente nem deixa de bloquear se o usuário reabrir.
4. Split screen: colocar o alvo numa partição e outro app na outra — confirmar que o overlay cobre a partição certa e não a errada, e que trazer o alvo de volta ao foco dentro do split reaciona o bloqueio.
5. Picture-in-picture: se o alvo suportar PiP (ex.: um app de vídeo), minimizar para PiP com o alvo tocando — confirmar se o detector trata a janela PiP como o app ainda em uso (é um caso que o `UsageStatsManager` historicamente reporta de forma inconsistente entre versões de Android).
6. Trocar rapidamente entre o alvo e outro app pelos Recentes (não fechar, só trocar) várias vezes seguidas — confirmar que o overlay some ao sair e volta ao entrar, sem atraso cumulativo nem estado preso.

**Observar:** overlay sobe em todos os casos do passo 1-2; teclado (3) não interfere; split screen (4) cobre a partição certa; PiP (5) — documentar o comportamento real, mesmo que seja "não bloqueia", porque é informação nova, não suposição; troca rápida (6) não deixa o overlay grudado no app errado nem atrasa progressivamente.

**Reprova se:** alguma abertura do passo 2 não registrar (furo na rajada); o teclado (3) fizer o overlay sumir e não voltar; o split screen (4) cobrir a partição errada ou nenhuma; a troca rápida (6) deixar o overlay em cima do app que não é mais o alvo.

---

## Prioridade 3 — force-stop: o `ProtectionLog` mede certo, e a distinção reciclagem/reboot se comporta como os testes de JVM previram

**Por que só aparelho prova:** os testes de JVM (`GrantWindowTest.processRecycleDoesNotEndTheGrant`, `WaitingPeriodTest.processRecycleFreezesTheWait`, `ProtectionLogTest`) usam relógio fake. Esta é a primeira vez que `SystemClock.elapsedRealtime()` real entra em jogo — ver Prioridade 4 para o caso ainda mais extremo (sono profundo).

**Pré-condição:** proteção ligada, uma concessão ativa e uma espera pendente ao mesmo tempo, se o fluxo permitir testar os dois de uma vez (senão, repetir o bloco duas vezes, uma para cada).

**Pré-requisito confirmado, não amarra mais a execução:** a correção que religa o serviço ao reabrir (`app/(protected)/index.tsx` chamando `AceleralockBlocker.start()` em `useFocusEffect`) está commitada em `62fb36c` (24/24, typecheck limpo, verificado pelo `supervisor`). Os Cenários A e B abaixo passam a ser observáveis. **Mesmo assim, antes de rodar A/B, confirme rapidamente que aquele `useFocusEffect` ainda existe na tela** — é a salvaguarda de regressão: se algum dia sumir, o cenário volta a não observar nada, e o achado a reportar seria isso, não os campos do `ProtectionLog`.

**Duas ressalvas de janela, achado do `dev` ao revisar o próprio conserto — não confundir com o bug antigo:**
1. **Frame de "protegido" falso, mas só por uma fração de segundo.** O veredito que decide a tela é calculado **antes** de `start()` rodar (o `useFocusEffect` dispara depois da renderização) — então existe um instante em que a tela mostra "protegido" com o serviço ainda morto. Diferente do bug antigo (que era permanente): se o roteiro fizer captura de tela bem no instante de abrir o app, pode pegar esse frame — não reportar como regressão do bug antigo sem antes confirmar que o número se corrige nos segundos seguintes.
2. **`downtimeTotalSeconds` só atualiza na leitura seguinte.** A leitura de `protectionState()` que decidiu o veredito aconteceu **antes** de `start()` religar o serviço e apurar o lapso — então o valor do lapso mais recente só aparece numa segunda leitura (outro `refresh()`, ou reabrir a tela de novo). **No passo 4 dos Cenários A e B abaixo, leia `protectionState()` duas vezes** (a segunda alguns segundos depois da primeira) antes de concluir que o número não bateu — ler só uma vez pode dar falso negativo.

**Cenário A — force-stop simples:**
1. Forçar parada do app pelas Ajustes (Ajustes → Apps → AceleraLock → Forçar parada).
2. Esperar um tempo conhecido (ex.: 3 minutos), cronometrado por relógio externo.
3. Reabrir o app manualmente.
4. Conferir `protectionState()` — **ler duas vezes, com alguns segundos de intervalo** (ver ressalva 2 acima): `downtimeLastSeconds` deve refletir os ~3 minutos (com alguma tolerância), `downtimeTotalSeconds` deve ter somado o mesmo valor, `downtimeUnknownCount` não deve ter incrementado.
5. Se havia uma concessão ativa antes do force-stop: conferir que o saldo restante foi **descontado** pelo tempo parado (não zerado, não preservado intacto) — é a garantia de A10.
6. Se havia uma espera pendente: conferir que o acumulado **não** avançou durante o tempo parado (congelou) nem regrediu.

**Cenário B — force-stop atravessando reboot:**
1. Repetir os passos 1-2 do Cenário A.
2. Antes de reabrir o app, **reiniciar o aparelho**.
3. Depois do boot completar, reabrir o app manualmente (o boot sozinho não deve ter reaberto — é a ausência de `BOOT_COMPLETED` documentada em B1).
4. Conferir `protectionState()` — de novo, **ler duas vezes**: `downtimeUnknownCount` deve ter incrementado; `downtimeLastSeconds` deve estar **null** (não zero, não um número qualquer) — é o caso em que `elapsedRealtime` zerou e não sobra relógio confiável para medir.
5. Se havia uma concessão ativa antes do force-stop: conferir que foi **encerrada** pelo boot real (regra de A9), diferente do Cenário A.

**Cenário C — persistência sob force-stop:**
1. Configurar a lista de apps bloqueados, ligar a proteção.
2. Forçar parada.
3. Reabrir o app.
4. Conferir que a lista de bloqueio e as durações configuradas continuam exatamente como estavam — `SharedPreferences` não é limpo por force-stop (diferente de "Limpar dados", que é outro botão, ver B2 na matriz).

**Observar:** todos os itens dos passos 4-6 de cada cenário, comparados ao que a regra prevê.

**Reprova se:** Cenário A — `downtimeLastSeconds` muito distante do tempo real cronometrado (mais que alguns segundos de folga), ou a concessão zerada/preservada em vez de descontada, ou a espera tiver avançado durante o tempo morto. Cenário B — `downtimeLastSeconds` vier com um número em vez de `null`, ou a concessão não for encerrada pelo boot. Cenário C — qualquer configuração perdida.

---

## Prioridade 4 — `elapsedRealtime` em sono profundo: a suposição mais arriscada do projeto

**Por que só aparelho prova, e por que é o item de maior risco escondido:** todas as regras monotônicas (espera, concessão, registro de interrupção) partem de uma suposição: que `SystemClock.elapsedRealtime()` continua avançando de forma confiável mesmo em Doze/sono profundo, e que o `pollLoop` do serviço eventualmente roda de novo para capturar o delta. Se essa suposição estiver errada em algum fabricante — atraso agressivo de alarme, `elapsedRealtime` se comportando diferente do documentado, `Handler.postDelayed` sendo suprimido por horas — **nenhum teste de JVM detectaria isso**, porque o `FakeMonotonicClock` só faz o que o teste manda.

**Pré-condição:** proteção ligada, com uma espera pendente e/ou concessão ativa.

**Passo a passo:**
1. Deixar o aparelho com a tela apagada, sem carregador, sem tocar, pelo tempo mais longo que a sessão permitir (idealmente várias horas — é o caso que dispara Doze de verdade, não só a tela apagada).
2. Ao retomar o uso, conferir imediatamente `protectionState()` antes de fazer qualquer outra coisa.
3. Comparar o acumulado da espera (ou o saldo descontado da concessão) contra o tempo real decorrido, cronometrado por relógio externo desde o início do passo 1.

**Observar:** o delta medido pelo app bate com o tempo real decorrido, dentro de uma tolerância pequena (ideal: poucos segundos; aceitável: o intervalo entre polls configurado em `BlockerTuning`).

**Reprova se:** o delta medido divergir do tempo real por uma margem grande (minutos) — sinal de que o Doze suprimiu o `pollLoop` por tempo suficiente para o acumulado ficar defasado, ou que `elapsedRealtime` não se comportou como a documentação promete neste fabricante específico. Isto seria o achado mais sério de toda a sessão: seria a suposição central do redesenho de A2/A9/A10 falhando silenciosamente, exatamente o tipo de erro que "ninguém notaria" — reportar imediatamente, mesmo que atrase o resto do roteiro.

---

## Prioridade 5 — o serviço sobrevive (iniciar no minuto zero, ler o resultado aqui)

**Por que só aparelho prova:** `START_STICKY`, exceção de bateria, e o comportamento de OEMs agressivos (MIUI, alguns Samsung/Huawei) são inteiramente do sistema operacional real — não existe forma de simular isso em JVM, e emulador tende a ser mais complacente que hardware real com apps em segundo plano.

**Passo a passo (retomando o que foi iniciado no início da sessão):**
1. Conferir se o overlay ainda funciona depois de várias horas com a tela apagada sem interação (retomando Prioridade 1 depois do tempo decorrido).
2. Com a exceção de otimização de bateria **concedida** (fluxo normal do onboarding): confirmar sobrevivência.
3. Se der tempo, repetir com a exceção de bateria **negada** de propósito, para ver a diferença — documentar quanto tempo o serviço aguenta sem a exceção, não só "aguenta ou não".
4. "Limpar tudo" nos Recentes (swipe pra fora do card do app) — conferir se o serviço sobrevive ao swipe (`START_STICKY` deveria religar).
5. Se o aparelho for de um fabricante conhecido por matar processos agressivamente (Xiaomi/MIUI é o caso mais documentado), checar a configuração de "Autostart"/"sem restrições" e testar com ela desligada de propósito, simulando alguém que não passou pelo onboarding guiado.

**Observar:** o overlay volta a funcionar corretamente depois de horas de inatividade (passo 1); diferença de sobrevivência entre bateria exemptada e não (passos 2-3); religamento após swipe nos Recentes (passo 4).

**Reprova se:** o serviço morrer e não se religar sozinho mesmo com a exceção de bateria concedida — esse é o caso que o produto promete cobrir; morrer sem a exceção é esperado e não é falha, é o motivo de o onboarding pedir a exceção.

---

## Prioridade 6 — consumo de bateria do laço de polling (iniciar no minuto zero, ler o resultado aqui)

**Por que só aparelho prova:** consumo de bateria é medido pelo sistema operacional real ao longo de horas de uso real — não é algo que qualquer teste unitário ou emulador reporta de forma que valha a pena confiar.

**Passo a passo:**
1. Deixar o app rodando com a proteção ativa por um dia inteiro de uso normal do aparelho (não só parado — inclui trocar de apps, o poll em intervalo curto `POLL_INSIDE_WINDOW`/`POLL_WHILE_BLOCKING` durante bloqueio ativo).
2. Ao fim do dia, checar Ajustes → Bateria → uso por app.
3. Comparar a posição do AceleraLock na lista contra apps conhecidos (ex.: o navegador, o WhatsApp) usados de forma parecida no mesmo período.

**Observar:** posição relativa do app na lista de consumo.

**Reprova se:** o app aparecer nas primeiras posições da lista de consumo de bateria do sistema, ou o Android oferecer para "otimizar"/restringir o app automaticamente por consumo alto. **Isto é crítico mesmo sem ser um "bug" no sentido tradicional**: é o `supervisor` quem definiu o critério — se o app aparecer na lista de vilões de bateria, o usuário desinstala, e nesse momento nenhuma outra linha desta matriz importa mais.

---

## Bônus — investigação aberta da matriz: Auto Backup restaura `SharedPreferences` na reinstalação?

**Por que só aparelho prova:** depende do serviço de backup do Google de verdade, `allowBackup: true` já está declarado em `app.json`, e a matriz (`docs/qa/matriz-cenarios-burla.md`, B6/B7) trata isso como aberto — "não assumir que funciona até confirmar".

**Passo a passo:**
1. Configurar o app (lista de bloqueio, durações), usar por tempo suficiente para o backup automático do Android rodar pelo menos uma vez (isso não é imediato — pode levar até 24h dependendo do sistema; se houver um jeito de forçar via `adb shell bmgr backupnow com.aceleralock.app`, mais rápido).
2. Desinstalar o app.
3. Reinstalar (mesma conta Google logada no aparelho).
4. Abrir o app sem configurar nada, e conferir se a lista de bloqueio/durações voltou sozinha, ou se o app pede onboarding do zero.

**Observar:** o estado depois da reinstalação.

**O que fazer com o resultado, não é pass/fail:** se restaurar, é uma boa notícia que muda a severidade de B6/B7 na matriz de burla (desinstalar deixaria de ser definitivo) — atualizar o documento. Se não restaurar, confirma o que já está escrito lá — também atualizar, de "não confirmado" para "confirmado que não restaura".

---

## Depois de terminar

Não inventar mais cenário nenhum além destes seis blocos + o bônus — é o filtro que o `supervisor` pediu: só o que aparelho prova e JVM não. Reportar resultado por bloco, com o achado mais sério (esperançosamente nenhum) destacado primeiro, principalmente qualquer coisa da Prioridade 4 — é onde uma suposição errada seria mais cara e mais silenciosa.
