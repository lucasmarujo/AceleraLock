# Onboarding de permissões nativas — AceleraLock

> Rodada de especificação. Documento, não código. Define o fluxo de telas que
> leva o usuário a conceder as permissões de sistema sem as quais o app não
> bloqueia nada, e o fluxo de recuperação quando ele nega, revoga ou o SO
> derruba a permissão depois.
>
> Fora de escopo aqui: design system, tokens, paleta, tipografia, componentes
> base (é de `uxui`); backend, contratos e modelo de dados (é de `dev`);
> implementação de módulo nativo; a cerimônia de desbloqueio em si.
>
> **Rev. 2 (2026-08-28)** — incorpora decisões do usuário posteriores à rev. 1:
> (a) **parceiro de confiança é obrigatório**, um só por conta, e o onboarding
> não conclui sem convite aceito — ver §3.1 e §4.2; (b) **todo pedido de
> desbloqueio se resolve sozinho em 48 h** sem aprovação, para ninguém ficar
> preso — dito ao usuário em §4.2; (c) **onboarding das permissões essenciais
> é inescapável**: o app não abre a home sem elas, a única saída é desinstalar
> — ver §4.4.c, §5.4.c e §7. O estado degradado (§6, §7) continua valendo,
> agora só para revogação/queda *depois* do onboarding.
>
> Insumo cruzado: `docs/qa/matriz-cenarios-burla.md` (QA). Relevante aqui:
> grupo H / **D-lat** — no Android há de 0,5 a 2 s de conteúdo do alvo visível
> antes de o overlay subir; tratado em §4.9. Primitiva **P7** (break-glass) e
> cenários J1–J3 embasam a regra das 48 h.

---

## 1. Princípios que guiam este fluxo

1. **O app explica antes; o SO só confirma.** Nenhuma dessas permissões é um
   `Alert` de "Permitir?". Todas jogam o usuário para fora do app, para uma
   tela do sistema onde ele se perde. Cada handoff é precedido de uma tela
   nossa (tela de *priming*) que diz, com o texto e o rótulo exatos que ele
   vai ver lá, o que tocar. Referência: Apple HIG, *Privacy — Requesting
   permission* ("explain why your app needs access before the system prompt
   appears"); Material 3, *Permissions* ("educate before requesting; give a
   clear rationale in context").

2. **Uma permissão por vez, com estado próprio.** Cada permissão é um passo do
   onboarding com um de quatro estados: `pendente` / `concedida` / `negada` /
   `revogada`. O app nunca pede duas de uma vez. A lista de passos mostra o
   progresso (ex.: "2 de 4").

3. **Valor antes do pedido.** O usuário escolhe o que quer bloquear e quem é o
   parceiro *antes* de qualquer tela de sistema. Ele precisa ter algo em jogo
   quando a fricção começa. Material 3, *Permissions*: "request in context,
   after the user has expressed intent".

4. **Detectar no retorno.** Toda vez que o app volta do background
   (`AppState` → `active`), ele reavalia o estado real de cada permissão.
   É assim que detectamos tanto "o usuário concedeu lá fora" quanto "o usuário
   revogou nas Configurações depois".

5. **Degradado é um estado visível, não um silêncio.** App instalado e incapaz
   de bloquear nunca fica com aparência de "tudo certo". Ver seção 7.

6. **Não punir por permissão.** A cerimônia de fricção (espera cronometrada +
   parceiro) é para *desbloquear um app*, não para religar uma permissão.
   Reconceder uma permissão revogada é sempre 1 toque, sem espera. A fricção
   contra a evasão por permissão é social e informacional (seção 6.4), não
   um bloqueio de fluxo.

7. **Parceiro é obrigatório; a válvula das 48 h torna isso honesto.** O
   desbloqueio depende da aprovação do parceiro, então não existe conta sem
   parceiro — seria um usuário que tranca apps e nunca mais destranca. Um só
   parceiro por conta. Contrapartida, dita ao usuário no momento em que ele
   escolhe: **todo pedido de desbloqueio expira e libera sozinho em 48 h**
   mesmo sem resposta do parceiro (é a primitiva P7 da matriz de QA, aplicada
   por pedido). Ninguém fica preso se o parceiro sumir.

8. **As permissões essenciais são inescapáveis.** Onboarding não é um tour com
   "pular". Sem as permissões *core* (Android: A1 + A2; iOS: I1) o app não
   abre a home — mostra a tela de onde parou. A única saída é desinstalar.
   Passos *não essenciais* (bateria, autostart, notificação) seguem puláveis.

---

## 2. Inventário de permissões

### Android (sem Device Admin, sem AccessibilityService)

| # | Permissão | Para quê | Tela do SO | Como o app detecta o estado |
|---|-----------|----------|------------|------------------------------|
| A1 | **Acesso de uso** (`PACKAGE_USAGE_STATS`) | Saber qual app está em primeiro plano agora (poll do `UsageStatsManager` num *foreground service*). Sem isso o app não sabe que o Instagram foi aberto. | `Settings.ACTION_USAGE_ACCESS_SETTINGS` — lista de apps; o usuário acha o AceleraLock e liga o toggle | `AppOpsManager.checkOpNoThrow(OPSTR_GET_USAGE_STATS)` → `MODE_ALLOWED` |
| A2 | **Sobrepor a outros apps** (`SYSTEM_ALERT_WINDOW`) | Desenhar a tela de bloqueio por cima do app-alvo. Também é a exceção que permite subir a tela a partir do background (Android 10+ restringe *background activity starts*). | `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` — tela dedicada, toggle único | `Settings.canDrawOverlays(context)` |
| A3 | **Ignorar otimização de bateria** | Sem isso o *foreground service* de poll é morto em silêncio por OEMs (Xiaomi/MIUI, Samsung, Oppo, Vivo, Huawei). O bloqueio simplesmente para de funcionar depois de algumas horas. | `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (diálogo direto), com `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` (lista) de fallback — D3 decidida | `PowerManager.isIgnoringBatteryOptimizations(pkg)` |
| A4 | **Notificações** (`POST_NOTIFICATIONS`, Android 13+) | Mostrar a notificação persistente do *foreground service* ("Proteção ativa"). O serviço roda sem ela, mas o usuário perde o indicador de que está protegido — e sem indicador ele não confia. | Diálogo runtime padrão (inline, não sai do app) | `PermissionsAndroid` / `Notifications.getPermissionsAsync()` |
| A5 | **Autostart / inicialização automática** (OEM) | MIUI, ColorOS, FuntouchOS, One UI e outras matam o serviço no reboot / no *swipe* de recentes se o app não estiver na whitelist de autostart. Não existe API oficial nem forma de verificar o estado. | **Instrução manual ilustrada + vídeo curto por fabricante** (D9 decidida — sem *deep link* para activity de OEM, que quebra a cada ROM) | **Não detectável.** Tratado como passo "não verificável" — ver 4.7 |

Manifesto (sem prompt, mas relevante): `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_SPECIAL_USE` (API 34+, exige declaração e justificativa no
Play Console — ver dúvida D6), `RECEIVE_BOOT_COMPLETED`.

### iOS (Family Controls / Screen Time API)

| # | Permissão | Para quê | Tela do SO | Como o app detecta o estado |
|---|-----------|----------|------------|------------------------------|
| I1 | **Acesso ao Tempo de Uso** (Family Controls) | `ManagedSettingsStore` aplica o *shield* nos apps escolhidos; o sistema é quem enforça — não há poll, não há serviço, não há problema de bateria. | `AuthorizationCenter.shared.requestAuthorization(for:)` → **diálogo único do sistema**. Texto do diálogo é fixo da Apple, não customizável. | `AuthorizationCenter.shared.authorizationStatus` → `.approved` / `.denied` / `.notDetermined` |
| I2 | **Seleção de apps** (`FamilyActivityPicker`) | Escolher quais apps/categorias bloquear. Retorna *tokens* opacos — o app nunca vê quais apps são. Exige I1 concedida antes de abrir. | Folha modal do sistema dentro do app (não é uma tela de Configurações; não tira o usuário do app) | A seleção é persistida pelo app; não é uma "permissão" com status |

**Semântica individual vs. responsável por menor:** `requestAuthorization(for: .individual)`
é o caso deste produto — adulto restringindo o próprio uso, no próprio device,
sem Apple ID de família, sem *Family Sharing*. `.child` é para o responsável
configurar no device do menor e só funciona com o device gerenciado via
família. **Decisão: usar `.individual` sempre nesta versão.** `.child` fica
para uma eventual feature de controle parental e está fora de escopo.

Entitlement: `com.apple.developer.family-controls`. Em build de desenvolvimento
/ dev client é concedido automaticamente ao adicionar o entitlement. Para
distribuição (TestFlight e App Store) exige aprovação manual da Apple via
formulário, com prazo de dias a semanas — ver dúvida D1.

---

## 3. Sequência de passos do onboarding

```
                 ┌─────────────────────────────────────────────┐
  Comum às duas  │ 0. Boas-vindas / proposta de valor           │
  plataformas    │ 1. Escolher apps para bloquear (intenção)    │
                 │ 2. Convidar parceiro (OBRIGATÓRIO): expira-  │
                 │    ção auto + idade mín. do vínculo + consent│
                 │ 3. Tela-ponte: "Agora os acessos do sistema" │
                 └──────────────────┬──────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          │ ANDROID                          iOS              │
          │ 4A.1 priming → Acesso de uso*    4I.1 priming →   │
          │ 4A.2 priming → Sobreposição*         Tempo de Uso*│
          │ 4A.3 priming → Bateria           4I.2 seleção de  │
          │ 4A.4 Notificações (inline)            apps (picker)│
          │ 4A.5 Autostart (condicional)                      │
          │        * = essencial, inescapável                 │
          └─────────────────────────┬─────────────────────────┘
                                    │
                 ┌──────────────────┴──────────────────────────┐
                 │ 5. Parceiro já aceitou?                      │
                 │    SIM → 6. Teste real → 7. Pronto           │
                 │    NÃO → §4.11 Estado "aguardando parceiro"  │
                 │           (permissões ok, bloqueio NÃO       │
                 │            armado; teste real adiado)        │
                 └─────────────────────────────────────────────┘
```

Ordem das permissões Android é deliberada: **Acesso de uso** primeiro porque é
a que dá sentido a tudo (sem ela nada é detectado); **Sobreposição** em
seguida porque é o que o usuário *vê* funcionar no teste final; **Bateria** e
**Autostart** são "durabilidade" e vêm depois, quando o usuário já investiu
nos dois primeiros e é menos provável que desista.

### 3.1 — Estado "aguardando parceiro" (resolve o aceite assíncrono)

O convite ao parceiro depende de outra pessoa, em outro celular, que pode
levar horas. Travar o onboarding nesse ponto seria péssimo. Resolução:

- Depois de **enviar** o convite (§4.2), o onboarding **segue** para as
  permissões. O usuário configura tudo e concede tudo sem esperar o parceiro.
- Ao terminar as permissões, se o parceiro **ainda não aceitou**, o app entra
  no estado **`aguardando-parceiro`** — que **não é** a home normal e **não é**
  o estado degradado:
  - permissões concedidas, apps escolhidos, tudo salvo;
  - **o bloqueio não é armado** — nada é trancado ainda;
  - a tela é um *holding* dedicado (§4.11), com o convite pendente em destaque,
    botão de reenviar e de trocar o convidado;
  - o teste real (§4.9 / §5.6) fica **adiado** — sem bloqueio armado não há o
    que testar.
- Quando o parceiro aceita (push + revalidação no `AppState` → `active`), o
  app **arma o bloqueio**, roda o teste real adiado e vai para a home normal.
- Se o convidado **recusa**, volta para §4.2 pedindo outro nome; segue em
  `aguardando-parceiro`.
- `aguardando-parceiro` acima de alguns dias: lembrete, nunca punição — o
  usuário ainda não está protegido, mas também não prometeu nada a ninguém.

---

## 4. Fluxo Android, passo a passo

### 4.0 — Boas-vindas

> **AceleraLock**
>
> Você escolhe os apps que roubam seu tempo. A gente tranca. Para destrancar,
> tem espera cronometrada e a aprovação de alguém em quem você confia — e, se
> essa pessoa sumir, o pedido libera sozinho depois de um tempo fixo (`[X] h`,
> valor vindo do servidor — ver §4.2.b).
>
> Sem drama: você desiste quando quiser — só não no impulso.
>
> `[ Começar ]`

### 4.1 — Escolher apps para bloquear

Lista de apps instalados com busca. Multi-seleção. Instagram, TikTok etc. em
destaque como sugestão. Nenhuma permissão pedida aqui — isto é só intenção.

> **O que você quer trancar?**
>
> Escolha os apps que te sugam. Dá para mudar depois.
>
> `[ lista com checkboxes ]`
>
> `[ Continuar ]`   — desabilitado até ≥ 1 app selecionado

#### 4.1.1 — Apps que NUNCA podem ser bloqueados (trava de segurança)

Requisito de **segurança física**, não de UX: alguém que bloqueie o próprio
discador não liga para a emergência. O servidor não pode filtrar isso — os
identificadores de app viram opacos antes de sair do aparelho (é a restrição
que fundou o modelo). A proibição **só existe se for aplicada no seletor
nativo, antes de o alvo virar opaco**, e reforçada em runtime.

**Lista de exclusão — resolvida dinamicamente, nunca por nome de pacote fixo**
(OEMs e configs do usuário mudam os pacotes):

| Categoria | Android — como resolver | iOS |
|-----------|-------------------------|-----|
| Discador padrão | `RoleManager` `ROLE_DIALER` + resolver de `Intent.ACTION_DIAL` | Ver 4.1.3 |
| Emergência / SOS | `RoleManager` `ROLE_EMERGENCY` (API 29+) + pacotes conhecidos (`com.android.emergency`) | Chamada de emergência é garantida pelo iOS abaixo da camada de apps — sempre funciona |
| Ajustes do sistema | resolver de `Settings.ACTION_SETTINGS` (normalmente `com.android.settings`) | `com.apple.Preferences` — ver 4.1.3 |
| Launcher padrão | resolver de `Intent.CATEGORY_HOME` | N/A (não aplicável) |
| O próprio AceleraLock | `context.packageName` | próprio `bundleIdentifier` |
| SMS/mensagens padrão, autenticador, banco | **aviso forte**, não bloqueio duro (matriz de QA, J6) — usuário confirma | idem, na medida do possível |

O conjunto é recalculado a cada início do serviço e nos broadcasts de
`ACTION_PACKAGE_CHANGED` / mudança de app padrão — o discador padrão pode
mudar *depois* de o usuário configurar os bloqueios.

#### 4.1.2 — Android: duas barreiras

- **Barreira 1 — no seletor (§4.1).** Os apps da lista de exclusão aparecem
  na lista **visíveis, esmaecidos, não-tocáveis**, com cadeado e uma linha de
  motivo. Visível e explicado é melhor que ausente — some da lista o usuário
  só estranha.
- **Barreira 2 — em runtime, no *foreground service*.** Antes de desenhar o
  overlay para qualquer pacote detectado em foreground, checar contra o
  conjunto de exclusão recém-resolvido. Se for excluído → **nunca desenha o
  overlay**, registra `warning` (não deveria acontecer se a barreira 1
  funcionou; significa lista desatualizada, seleção restaurada de backup
  antigo, ou troca de app padrão pós-configuração).

Uma barreira só quebra quando a lista muda entre versões. As duas juntas
degradam com segurança.

#### 4.1.3 — iOS: confirmar cobertura da Apple, tratar o resto

O `FamilyActivityPicker` é da Apple e **parte** dos apps críticos já é
protegida pelo sistema (chamada de emergência sempre funciona; o app Ajustes
e o Telefone provavelmente não são *shieldáveis* — **confirmar empiricamente
antes de assumir**, era pedido do `supervisor`). O que não está coberto:

- **Barreira 1 — antes do picker:** tela recomendando escolher **app por
  app** e desencorajando categorias inteiras (uma categoria pode varrer um
  app essencial junto).
- **Barreira 2 — após a seleção:** inspecionar o `FamilyActivitySelection` —
  não dá para ver identidades (tokens opacos), mas dá para ver se
  `categoryTokens` não está vazio → **aviso duro**: "você bloqueou categorias
  inteiras; apps essenciais podem estar dentro — recomendamos rever e
  escolher um a um".
- **Barreira 3 — na extensão de *shield* (iOS 16+):** ali `Application.bundleIdentifier`
  fica legível. Se bater com a denylist crítica → remover esse token de
  `ManagedSettingsStore.shield.applications` e não apresentar ação de
  bloqueio. É a rede de segurança que funciona apesar da opacidade. (Depende
  de `dev` para o módulo nativo — sinalizar.)

#### 4.1.4 — O que o usuário vê ao tentar selecionar um app proibido

Nem erro seco, nem falha silenciosa. Linha na lista (Android):

> 🔒 Telefone · Ligações
> *Sempre liberado — você precisa poder ligar para a emergência.*

Se tocar na linha (ou, no iOS, no aviso pós-seleção):

> **Esse app fica sempre liberado**
>
> O AceleraLock nunca bloqueia telefone, chamada de emergência, os Ajustes do
> sistema e ele mesmo. É uma trava de segurança — não dá para desativar.
>
> `[ Entendi ]`

### 4.2 — Convidar o parceiro de confiança (obrigatório)

Mecânica de convite, verificação de telefone e antifraude são de `dev` (ver
matriz de QA, grupo F). Aqui: **não há "pular"**. O onboarding envia o convite
e segue; o aceite chega depois (§3.1). Um só parceiro por conta.

**4.2.a — Escolher e convidar:**

> **Quem segura sua mão?**
>
> Uma pessoa. Ela aprova (ou não) quando você pedir para destrancar um app.
> Escolha alguém que não vai ceder fácil — e que você não vai querer chantagear.
>
> `[ Convidar por contato ]`   → seletor de contatos / número
> `[ Convidar por link ]`
>
> (sem opção de pular)

**4.2.b — A regra da expiração automática (mesma tela ou logo após o envio):**

> **Se [nome] sumir, você não fica preso**
>
> Todo pedido de desbloqueio libera sozinho depois de um tempo fixo (hoje,
> **[X] horas**), mesmo que [nome] não responda nada. A aprovação dela serve
> para *acelerar* — não para te manter refém.
>
> Perdeu o contato de vez? Dá para trocar de parceiro, com a mesma espera.
>
> `[ Entendi ]`

Essa tela é o que torna honesto pedir que o usuário entregue essa chave a
outra pessoa. O texto das telas de cerimônia (próxima rodada) tem de repetir
a expiração automática — é premissa, não letra miúda.

**O prazo é dado, não constante de layout.** O conceito ("todo pedido expira
sozinho") é fixo; o número vem da **config do servidor no payload de
sincronização** (decisão do `supervisor` sobre D11). Hoje são 48 h. Nenhuma
tela ou cópia estática pode cravar "48h" — se virar 72 h, muda sem release.
Onde o texto precisa do número, ele é interpolado a partir do valor
sincronizado (`[X] horas`).

**4.2.b′ — Idade mínima do vínculo (48 h antes do 1º atalho):**

Decisão do `supervisor`: o vínculo com o parceiro tem **idade mínima** (hoje
48 h, mesmo tratamento de dado do §4.2.b) antes de ele poder aprovar qualquer
coisa. Fecha o roteiro "instalo o app, adiciono um cúmplice, destranco em 30
minutos". Consequência: **nas primeiras 48 h o usuário não tem atalho de
parceiro** — o primeiro pedido dele cai direto na espera longa. É intencional,
mas se a interface não disser *desde quando* o parceiro poderá aprovar, vira
reclamação de suporte no dia 1.

Onde a interface diz isso, sempre com a data/hora absoluta calculada:

- **Ao parceiro aceitar** (§3.1 → transição), confirmação:
  > **[nome] entrou como seu parceiro**
  >
  > A partir de **[data, hora]** ele já pode aprovar seus pedidos. Até lá,
  > todo desbloqueio vai pela espera longa — é assim que a gente evita
  > "arranjar um cúmplice de última hora".
  >
  > `[ Entendi ]`
- **Na home**, enquanto o vínculo é mais novo que a idade mínima: linha de
  status permanente — *"Atalho do parceiro disponível em [contagem / data]"*.
- **No 1º pedido de desbloqueio dentro da janela** (tela de cerimônia,
  próxima rodada — herda daqui): deixar explícito que este pedido não tem
  atalho e por quê, com a data em que passa a ter.

A idade conta **a partir do aceite** (quando o vínculo passa a existir), não
do envio do convite. Trocar de parceiro reinicia a contagem — mesma regra,
sem exceção (senão vira porta dos fundos: matriz de QA, F10).

**4.2.c — Consentimento do alerta de queda de proteção (resolve D4):**

> **[nome] vai saber se a proteção cair**
>
> Se você desligar uma permissão, desinstalar o app ou o celular derrubar o
> serviço, o AceleraLock avisa [nome] — do mesmo jeito que avisa quando você
> pede para destrancar algo. É essa transparência que faz o combinado valer.
>
> `[ Concordo ]`   — obrigatório para concluir
> `[ Saber mais ]`  → o que exatamente é enviado (evento + horário, sem
>                     conteúdo) e o que não é

Sem esse consentimento o onboarding não avança — o alerta de queda (§6.4
item 2) é a única fricture real contra revogar permissão para escapar, então
ele deixou de ser opcional (era D4).

**4.2.d — Envio:** confirma "Convite enviado para [nome]" e segue para §4.3.
O estado da conta fica `aguardando-parceiro` até o aceite (§3.1).

### 4.3 — Tela-ponte

> **Agora, 3 acessos do sistema**
>
> O Android não deixa nenhum app bloquear outro sem permissão explícita. São
> 3 telas do próprio Android. A gente te mostra exatamente onde tocar em cada
> uma.
>
> Leva 1 minuto. Sem esses acessos, o AceleraLock não bloqueia nada.
>
> `[ Vamos lá ]`
>
> Progresso: `○ ○ ○`

### 4.4 — Passo 1: Acesso de uso (`PACKAGE_USAGE_STATS`)

**4.4.a — Priming (tela nossa, antes do handoff):**

> **Passo 1 de 3 — Acesso de uso**
>
> Para saber a hora em que você abre o Instagram, o AceleraLock precisa do
> **Acesso de uso**.
>
> Ao tocar em "Abrir Configurações", o Android vai abrir uma lista de apps.
>
> **O que fazer lá:**
> 1. Toque em **AceleraLock** na lista
> 2. Ligue a chave **"Permitir acesso ao uso"**
> 3. Volte para cá com o botão voltar
>
> `[ Abrir Configurações ]`
> `[ Por que isso? ]`  → folha explicativa: "O AceleraLock não lê conteúdo de
> nada. Ele só vê qual app está aberto e por quanto tempo. Nada sai do seu
> aparelho." (referência de transparência — Material 3, *Permissions*: "state
> what data is accessed and why")

**4.4.b — Handoff:** `IntentLauncher` → `Settings.ACTION_USAGE_ACCESS_SETTINGS`.
Se o device não resolver a intent com o app pré-selecionado (comum), o texto
já instrui a achar na lista.

**4.4.c — Retorno:** ao voltar (`AppState` → `active`), checar
`checkOpNoThrow(OPSTR_GET_USAGE_STATS)`.
- `MODE_ALLOWED` → passo vira `concedida`, avança para 4.5 automaticamente,
  com um *toast*/estado de sucesso curto ("Acesso de uso: ok").
- ainda não → tela de "não detectamos ainda":

> **Ainda não detectamos o acesso**
>
> Sem estresse. Às vezes a lista do Android é confusa.
>
> `[ Tentar de novo ]`  (reabre a mesma tela de sistema)
> `[ Ver o passo a passo com imagens ]`  (guia ilustrado, estático)
> `[ Preciso de ajuda ]`  (abre suporte / FAQ)

**Acesso de uso é essencial — não há "pular" (princípio 8).** Enquanto A1 não
estiver concedida, o app fica nesta tela; não existe botão que avança sem ela.
A saída honesta é dita sem drama, uma vez, discreta no rodapé:

> Não quer dar esse acesso? Sem problema — o AceleraLock só faz sentido com
> ele. Você pode desinstalar pelas Configurações do Android.

Nada de overlay atrapalhando o caminho até as Configurações, nada de esconder
o desinstalar (matriz de QA, nota transversal E; Google Play — *Deceptive
Behavior*). O app não segura o usuário; só não finge que funciona sem a
permissão.

O mesmo vale para **4.5.c** (Sobreposição): essencial, mesma tela de espera,
mesma saída por desinstalação, sem "pular".

### 4.5 — Passo 2: Sobrepor a outros apps (`SYSTEM_ALERT_WINDOW`)

**4.5.a — Priming:**

> **Passo 2 de 3 — Desenhar por cima**
>
> Para mostrar a tela de bloqueio na frente do Instagram, o AceleraLock
> precisa de **"Sobrepor a outros apps"**.
>
> **O que fazer lá:**
> 1. Ligue a chave **"Permitir sobreposição"** (ou "Aparecer sobre outros apps")
> 2. Volte com o botão voltar
>
> `[ Abrir Configurações ]`

**4.5.b — Handoff:** `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` com
`package:` URI — na maioria dos devices já abre direto na tela do AceleraLock,
com toggle único. Texto cobre o caso de cair na lista.

**4.5.c — Retorno:** `Settings.canDrawOverlays(context)`. Mesmo tratamento de
sucesso / "não detectamos" de 4.4.c.

### 4.6 — Passo 3: Ignorar otimização de bateria

**4.6.a — Priming:**

> **Passo 3 de 3 — Não deixar o Android me matar**
>
> Alguns celulares (Xiaomi, Samsung, Motorola e outros) desligam apps em
> segundo plano para poupar bateria. Se isso acontecer com o AceleraLock, o
> bloqueio **para de funcionar sem avisar**.
>
> Na próxima tela, escolha **"Permitir"** / **"Não otimizar"**.
>
> `[ Continuar ]`

**4.6.b — Handoff (D3 decidida):** tenta `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
(diálogo direto de sim/não); se o Play recusar a permissão
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, cai para `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`
(lista) com o texto adaptado.

**4.6.c — Retorno:** `PowerManager.isIgnoringBatteryOptimizations(pkg)`.
Se negado, **não travar** — este passo é "recomendado forte", não "obrigatório
para bloquear". Marcar como `negada` e seguir; o resumo final (4.9) e o painel
de saúde (seção 6) mostram como um alerta amarelo, não vermelho.

### 4.7 — Passo condicional: Autostart (OEM)

Só aparece se `Build.MANUFACTURER` estiver na lista de fabricantes conhecidos
por matar serviços (xiaomi, redmi, poco, oppo, realme, vivo, iqoo, huawei,
honor, samsung, oneplus, letv, meizu, asus).

> **Um último ajuste no seu [Xiaomi]**
>
> Celulares [Xiaomi] precisam de uma liberação extra chamada
> **"Inicialização automática"** para o AceleraLock continuar ativo depois de
> reiniciar.
>
> **Como fazer (passo a passo com imagens do seu [Xiaomi]):**
> 1. Abra **[Segurança › Permissões › Inicialização automática]**
> 2. Ache **AceleraLock** na lista e ligue a chave
> 3. Volte
>
> `[ Ver o passo a passo ]`  → guia ilustrado + vídeo curto do fabricante
> `[ Abrir Configurações ]`  → abre só a tela raiz de Ajustes (sem tentar
>                              *deep link* para activity de OEM — D9)
> `[ Já fiz isso / Pular ]`

**Não detectável.** O app não consegue confirmar. Depois do retorno, mostrar:

> **Marcamos como feito.**
>
> A gente não consegue verificar esse ajuste. Se o bloqueio falhar depois de
> um reboot, volte aqui em Configurações → Saúde da proteção.

Registrar `autostart: assumido` no estado local para o painel de saúde poder
sugerir revisão se detectarmos o serviço tendo sido morto.

### 4.8 — Notificações (`POST_NOTIFICATIONS`, Android 13+)

Feito **inline**, sem sair do app, porque é um diálogo runtime padrão.
Priming curto imediatamente antes:

> **Deixe o AceleraLock te mostrar que está ativo**
>
> Uma notificação fixa e discreta — é assim que você sabe, de relance, que a
> proteção está de pé.
>
> `[ Ativar notificação ]`   → dispara o diálogo runtime
> `[ Agora não ]`

Se negado: seguir. O serviço roda mesmo assim; a notificação do *foreground
service* fica em canal de baixa prioridade. O painel de saúde registra
"indicador de proteção desligado" como aviso informativo.

### 4.9 — Teste real

Existencial para o produto: o usuário precisa **ver** o bloqueio acontecer
antes de confiar. Só roda com o **bloqueio armado** — ou seja, com o parceiro
já tendo aceitado. Se ainda `aguardando-parceiro`, este passo é adiado (§3.1)
e o onboarding termina em §4.11.

**Cuidado com a promessa (matriz de QA, D-lat / H1).** No Android, sem
AccessibilityService, a detecção é reativa: o QA mediu **0,5 a 2 segundos**
de conteúdo do Instagram visível antes de o overlay subir. Se a tela de teste
promete "trava na hora" e o usuário vê o feed rolar por dois segundos, o
momento que deveria criar confiança vira o momento em que ele para de
confiar. O texto assume a latência em vez de esconder:

> **Vamos testar agora**
>
> Toque em "Abrir Instagram". Você vai ver o app por um instante e então a
> tela de bloqueio cobre tudo — e a tentativa fica registrada. É assim que
> funciona: a gente te barra na porta, não impede você de ver a maçaneta.
>
> `[ Abrir Instagram ]`
> `[ Agora não ]`  → conclui o onboarding; o teste fica sugerido na home

Quando o app volta ao primeiro plano depois de o overlay ter disparado:

> **Barrou. É exatamente assim que vai ser.**
>
> Aquele meio segundo até a tela subir é o limite do Android — nenhum app de
> bloqueio sem controle parental faz melhor. O que importa: você não entra sem
> passar pela espera e pelo seu parceiro.
>
> `[ Terminar ]`

No **iOS** a história é outra e o texto pode ser direto: o *shield* do Family
Controls é aplicado pelo sistema **antes** de o app renderizar (matriz de QA,
nota transversal D). Ver §5.6.

Se o overlay não disparou de todo (detectável: o serviço registrou o evento
de foreground do Instagram mas não conseguiu mostrar a tela): mandar para o
fluxo de diagnóstico apontando a permissão provável em falta (quase sempre
A2 revogada ou o serviço morto).

### 4.10 — Pronto (parceiro já aceitou)

> **Você está protegido**
>
> ✓ Acesso de uso
> ✓ Sobreposição
> ✓ Bateria liberada
> ⚠ Inicialização automática — não verificável, marcada como feita
> ✓ 4 apps trancados
> ✓ Parceiro: [nome]
>
> `[ Concluir ]`

Itens `⚠` levam à ação correspondente ao toque.

### 4.11 — Estado "aguardando parceiro" — parceiro ainda não aceitou

Quando o usuário chega ao fim das permissões e o convite segue pendente. Não
é a home, não é degradado — é um *holding* honesto.

> **Quase lá — falta [nome] aceitar**
>
> Suas permissões estão todas certas. Assim que [nome] aceitar ser seu
> parceiro, o AceleraLock **arma o bloqueio** e a gente faz o teste juntos.
>
> Enquanto isso, **nada está trancado** — você ainda não está protegido.
>
> Convite enviado há [2 h] · `[ Reenviar ]` · `[ Trocar de parceiro ]`
>
> `[ Ver como vai funcionar ]`  → prévia estática, sem armar nada

- Sem notificação persistente de "proteção ativa" (não está).
- Push quando o parceiro aceita → transição automática para 4.10 + teste real.
- Não conta streak, não mostra "dias de foco" — não começou.

---

## 5. Fluxo iOS, passo a passo

Muito mais curto: um diálogo, uma folha de seleção. O trabalho de UX aqui é
**preparar para o diálogo fixo da Apple** (que o usuário pode ler como
assustador — "restringir conteúdo", "limitar apps") e explicar por que um app
de foco está pedindo *Screen Time*.

### 5.0–5.2 — Boas-vindas, apps, parceiro

Iguais a 4.0–4.2, **incluindo a lista de apps não-bloqueáveis (§4.1.1), o
parceiro obrigatório, a expiração automática do pedido, a idade mínima do
vínculo e o consentimento do alerta de queda** (§4.1.1, §4.2.a–d) — idênticos
entre plataformas. No iOS, a barreira 1/2/3 de apps críticos é a de §4.1.3.
Na tela 5.1 ("escolher apps"), como o `FamilyActivityPicker` exige autorização
antes, a ordem é: **autorizar (5.4) primeiro, escolher apps (5.5) depois**. A
tela 5.1 aqui só coleta a *intenção* ("quais tipos de app? redes sociais,
jogos, notícias?") em categorias amigáveis; a seleção técnica real acontece
em 5.5. O estado `aguardando-parceiro` (§3.1) e o *holding* de §4.11 valem
igual no iOS.

### 5.3 — Tela-ponte

> **Um acesso do sistema**
>
> O iOS controla bloqueio de apps através do **Tempo de Uso** (Screen Time),
> a mesma tecnologia dos Controles Parentais da Apple. O AceleraLock usa isso
> para trancar o que você escolher.
>
> Na próxima tela, o iOS vai perguntar se permite. Toque em **"Continuar"**.
>
> `[ Entendi ]`

### 5.4 — Autorização (Family Controls)

**5.4.a — Priming (antes do diálogo do sistema):**

> **O que o iOS vai perguntar**
>
> A tela do sistema vai dizer algo como:
>
> > *"AceleraLock" Gostaria de Acessar o Tempo de Uso — isso pode permitir
> > ver seus dados de atividade, restringir conteúdo e limitar o uso de apps
> > e sites.*
>
> Esse texto é padrão da Apple e vale para qualquer app de controle de tempo.
> Na prática, o AceleraLock só tranca os apps que **você** escolheu. Ele não
> vê quais apps são (o iOS entrega códigos anônimos), não lê conteúdo e nada
> sai do aparelho.
>
> Toque em **"Continuar"** na tela do sistema.
>
> `[ Mostrar a tela do sistema ]`

**5.4.b — Handoff:** `AuthorizationCenter.shared.requestAuthorization(for: .individual)`.
Diálogo do sistema, dentro do app.

**5.4.c — Resultado:** `async` retorna e/ou checar `authorizationStatus`.
- `.approved` → segue para 5.5.
- `.denied` / `.notDetermined` persistente → **parada dura** (princípio 8). I1
  é a única permissão essencial do iOS; sem ela o app não abre a home.

> **Sem o Tempo de Uso, o AceleraLock não faz nada**
>
> É a única permissão que ele precisa. Tente de novo, ou libere em
> **Ajustes › Tempo de Uso**.
>
> `[ Tentar de novo ]`  → `requestAuthorization` se ainda `.notDetermined`;
>                          senão abre Ajustes via `openSettingsURLString`
> `[ Abrir Ajustes ]`
>
> Não é pra você? Sem problema — pode apagar o app. Ele só funciona com esse
> acesso.

Nota de implementação: dependendo da versão do iOS, uma vez `.denied` o app
não consegue reapresentar o diálogo — aí "Tentar de novo" tem de levar direto
a Ajustes. O texto e os botões se adaptam ao `authorizationStatus` real
(confirmar na versão-alvo — era D7).

### 5.5 — Seleção de apps (`FamilyActivityPicker`)

> **Escolha o que trancar**
>
> A próxima tela é do iOS. Marque apps ou categorias inteiras. A gente não
> enxerga o que você marcou — só os códigos anônimos que o iOS gera.
>
> `[ Abrir seleção ]`

Apresenta o `FamilyActivityPicker`. A `Selection` (tokens) é persistida e
aplicada via `ManagedSettingsStore.shield`.

### 5.6 — Teste real

Mesma ideia de 4.9, mas o texto pode prometer o que o Android não pode: o
*shield* do Family Controls é aplicado pelo sistema **antes** de a UI do app
renderizar (matriz de QA, nota transversal D). Não há janela de conteúdo
visível.

> **Vamos testar agora**
>
> Toque em "Abrir Instagram". Ele nem chega a abrir — a tela de bloqueio já
> está lá. E a tentativa fica registrada.
>
> `[ Abrir Instagram ]`
> `[ Agora não ]`

O texto e os botões do próprio *shield* (`ShieldConfiguration` /
`ShieldActionExtension`) são a próxima rodada — aqui só validamos que ele
aparece. Como 4.9, só roda com o bloqueio armado (parceiro aceitou); senão,
adiado (§3.1) e o onboarding termina em §4.11.

**Expectativa a calibrar no texto (achado do `uxui`):** o `ShieldConfiguration`
é uma **superfície estática** — ícone, título, corpo e dois rótulos de botão,
fixos, **sem cronômetro ao vivo**. No teste real o usuário vê essa tela
simples do sistema, não uma tela rica com contagem regressiva. O texto de
5.6 não deve prometer mais do que o shield entrega: "a tela de bloqueio
aparece e leva você de volta ao AceleraLock" — a cerimônia com o cronômetro
acontece **dentro do app**, não no shield. Ver nota da próxima rodada em §11.

### 5.7 — Pronto

Igual a 4.10 (parceiro aceitou) ou 4.11 (`aguardando-parceiro`), sem os itens
de bateria/autostart (não existem no iOS).

---

## 6. Detecção de revogação e fluxo de recuperação

### 6.1 — Quando checar

- **Todo** `AppState` `background`/`inactive` → `active`.
- Na inicialização do app (cold start).
- Android: adicionalmente, o *foreground service* revalida A1/A2 a cada ciclo
  de poll e ao ser recriado após morte; se perdeu A1 ou A2, dispara
  notificação de alta prioridade e marca o estado global como degradado.
- iOS: `AuthorizationCenter` publica mudança de status; observar. Cobre o caso
  de o usuário desligar o Tempo de Uso inteiro em Ajustes.

### 6.2 — Health check (função única, um lugar só)

Uma rotina `avaliarSaudeDaProtecao()` retorna, por permissão, um dos estados
`{ ok, faltando, nao_verificavel }`, cruza com o estado da conta (parceiro
aceito? bloqueio armado?) e devolve um veredito que **decide a tela raiz** do
app:

| Veredito | Condição | Tela raiz |
|----------|----------|-----------|
| `onboarding-incompleto` | Falta permissão *core* **e** o usuário nunca concluiu o onboarding | Retoma o onboarding no passo pendente (§4/§5). App não abre a home (princípio 8). |
| `aguardando-parceiro` | Permissões *core* ok, mas o parceiro ainda não aceitou o convite | *Holding* de §4.11. Bloqueio **não armado**. |
| `protegido` | *Core* ok + parceiro aceito + bloqueio armado. Bateria/autostart/notificação podem estar em aviso. | Home normal. |
| `frágil` | `protegido`, mas A3 (bateria) ou A5 (autostart) faltando — bloqueio funciona agora, pode cair depois. | Home normal + banner (§6.3). |
| `degradado` | Onboarding **já foi concluído** e agora falta permissão *core* (revogação, auto-reset do SO, serviço morto) | Tela de recuperação de §6.3 — cobre este caso e só este. |

`onboarding-incompleto` e `degradado` são distintos de propósito: o primeiro é
"nunca funcionou", o segundo é "funcionava e caiu". A tela e o tom mudam — no
`degradado` o usuário tinha um combinado com o parceiro que agora está furado.

### 6.3 — Telas de recuperação

**Ao detectar `degradado`** (onboarding já concluído, permissão *core* caiu
depois) — tela cheia no retorno do background:

> **A proteção caiu**
>
> O acesso **[Acesso de uso]** foi desligado. Pode ter sido você, uma
> atualização do Android, ou uma limpeza automática do sistema. Enquanto isso,
> o Instagram e os outros **não estão trancados** — e **[nome] já foi avisado**.
>
> `[ Religar agora ]`   → mesmo priming + handoff da seção 4, 1 toque, sem
>                          espera, sem cerimônia (princípio 6)
> `[ Religar depois ]`   → mantém banner permanente + notificação persistente;
>                          registra o evento; [nome] segue vendo "sem proteção"
>
> Se você desistiu de vez do AceleraLock, desinstale em paz. Mas não deixe
> meio-tranca: ou protege, ou solta.

"Religar depois" continua existindo aqui — pós-onboarding não dá para *forçar*
reconceder uma permissão de sistema, só insistir e manter o parceiro no
circuito. O que **não** existe é "religar depois" no onboarding
(`onboarding-incompleto`): lá o app não abre a home (princípio 8).

Se **mais de uma** permissão caiu, listar todas com um botão por item e um
`[ Religar tudo ]` que encadeia os handoffs.

**Ao detectar `frágil`** — banner não-bloqueante no topo da home + item no
painel de saúde:

> ⚠ O bloqueio pode parar depois que você reiniciar o celular.
> `[ Corrigir (30s) ]`

### 6.4 — Fricção contra evasão por permissão

Tensão existencial do produto: o usuário **pode** revogar qualquer permissão
de sistema, e o app não tem como impedir. Se revogar for uma saída trivial e
silenciosa, a proposta inteira desmorona. O que dá para fazer sem código
nativo abusivo e sem enganar o usuário:

1. **Tornar visível e imediato.** Detecção no retorno + tela cheia (6.3). Não
   deixar passar despercebido.
2. **Avisar o parceiro.** Quando a proteção cai para `degradado`, notificar o
   parceiro ("Fulano ficou sem proteção às 21h03"). **Decidido: obrigatório**,
   com consentimento explícito no onboarding (§4.2.c). Com parceiro
   obrigatório, essa é a única fricção real contra revogar permissão para
   escapar — o usuário não burla *em silêncio*. Enviado: evento + horário,
   sem conteúdo. (era D4)
3. **Quebrar o *streak*.** Se o produto tem contador de dias protegidos, uma
   janela em `degradado` acima de X minutos zera o streak. Perda concreta.
4. **Registrar o histórico.** "Proteção esteve fora 4 vezes esta semana"
   visível para o usuário e para o parceiro.
5. **Não** tentar re-pedir permissão em loop, **não** usar overlay para
   dificultar o acesso às Configurações, **não** esconder o botão de
   desinstalar. Isso vira malware e o usuário perde a confiança (e o Google
   Play remove o app).

---

## 7. Estados em que o app está instalado e não bloqueia

São **três**, com telas e tons distintos. Nunca se parecem com "tudo certo".

| Estado | Quando | Já teve proteção? | Parceiro sabe? |
|--------|--------|-------------------|----------------|
| `onboarding-incompleto` | Permissão *core* nunca concedida; onboarding não concluído | Não | Não (nem convite aceito ainda) |
| `aguardando-parceiro` | Permissões ok; convite enviado, aceite pendente | Não | — (convite pendente) |
| `degradado` | Onboarding concluído; permissão *core* caiu depois | **Sim** | **Sim** — alertado (§6.4.2) |

- `onboarding-incompleto` → o app abre direto no passo pendente do onboarding
  (§4/§5). Não há home por trás. Saída: concluir ou desinstalar (princípio 8).
- `aguardando-parceiro` → *holding* de §4.11. Sem alarme vermelho: o usuário
  não prometeu nada a ninguém ainda, só ainda não está protegido.
- `degradado` → a seção abaixo. É o único que grita.

### 7.1 — Estado `degradado` (o que o app mostra)

| Superfície | Conteúdo |
|-----------|----------|
| Home | Cabeçalho vermelho/alerta: **"Desprotegido — nada está trancado"**. Lista de apps que *deveriam* estar trancados, esmaecidos, com etiqueta "solto". Botão primário grande: `[ Ativar proteção ]`. |
| Notificação persistente (Android) | Canal alta prioridade, não-dispensável enquanto degradado: "AceleraLock não está bloqueando. Toque para religar." |
| Ícone / badge | Se possível, badge de alerta no ícone do app. |
| Abertura de app-alvo | Sem permissão não há como interceptar — por isso o estado degradado precisa gritar *dentro* do AceleraLock e na notificação, já que é o único lugar onde temos voz. |
| Parceiro | Notificado (ver 6.4 item 2). |

**O que o app NÃO faz no estado degradado:**
- Não finge que está tudo bem.
- Não mostra telas de "parabéns, 3 dias de foco!".
- Não exige a cerimônia de desbloqueio para religar (religar ≠ desbloquear —
  princípio 6; religar é sempre 1 toque, sem espera, sem parceiro).
- Não trava o acesso do usuário ao resto do app.
- Não usa overlay para dificultar chegar às Configurações; não esconde o
  desinstalar (matriz de QA, nota transversal E; Google Play — *Deceptive
  Behavior*).

**Saída do estado degradado:** assim que o health check volta a `protegido`,
transição para a home normal com uma confirmação discreta ("Proteção de
volta") — e o parceiro recebe o "voltou", fechando o evento aberto em §6.4.2.

---

## 8. Detecção de retorno — resumo técnico (para `dev` e implementação futura)

| Gatilho | Android | iOS |
|---------|---------|-----|
| App volta ao 1º plano | `AppState` listener → `avaliarSaudeDaProtecao()` | idem |
| Durante uso em background | Poll do *foreground service* revalida A1/A2 | `AuthorizationCenter` observer |
| Cold start | Health check → veredito (§6.2) decide a tela raiz: `onboarding-incompleto` / `aguardando-parceiro` / `protegido` / `frágil` / `degradado` | idem |
| Parceiro aceitou o convite | Push → revalida no `active` → arma o bloqueio → teste real adiado | idem |
| Pós-reboot | `RECEIVE_BOOT_COMPLETED` recria o serviço → health check | N/A (sistema mantém o shield) |

A tela inicial do app é decidida sempre pelo health check, nunca assumida.

---

## 9. Referências concretas usadas nas decisões

| Decisão | Fonte |
|---------|-------|
| Tela de priming antes de todo handoff de sistema | Apple HIG — *Privacy › Requesting permission*: peça em contexto, explique o motivo antes do prompt. Material 3 — *Foundations › Permissions*: "educate before requesting", padrão de *rationale* em contexto. |
| Uma permissão por vez, com rationale por item | Material 3 — *Permissions*, seção "Request in context" e "Multiple permissions". Android Developers — *App permissions best practices*: "ask for permissions in context", "one at a time". |
| Não pedir tudo no cold start | Material 3 — *Permissions*: upfront só para o que é crítico ao core; mesmo assim, depois de intenção do usuário. |
| Explicar o texto fixo do diálogo da Apple antes de mostrá-lo | HIG — *Screen Time* / Family Controls: o texto de autorização não é customizável; cabe ao app dar contexto antes. |
| `.individual` e não `.child` | Apple — *FamilyControls › AuthorizationCenter*: `.individual` é o modo para autorrestrição no próprio device, sem gerenciamento de família. |
| Alvos de toque ≥ 44pt (iOS) / 48dp (Android), ≥ 8dp entre alvos | HIG — *Layout › Hit targets* (44pt). Material 3 — *Accessibility › Touch target size* (48dp). Confirmado em `ui-ux-pro-max` (app-interface, severidade Critical). |
| `SafeAreaView` em todas as telas do fluxo | `ui-ux-pro-max` app-interface — *Safe Area Insets*, severidade High. HIG — *Layout › Safe areas*. |
| Estados de erro anunciados (`role=alert` / `accessibilityLiveRegion`), erro perto do campo, sempre com caminho de recuperação | `ui-ux-pro-max` ux-guidelines — *Error Messages*, *Error Recovery*, *Error Placement*. |
| Estado vazio/degradado nunca em branco: mensagem + ação | `ui-ux-pro-max` ux-guidelines — *Empty States*, severidade Medium. |
| Permissões *core* do onboarding são inescapáveis (sem "pular") | Desvio **deliberado** de `ui-ux-pro-max` ux-guidelines — *Onboarding › User Freedom*, por decisão de produto do usuário (rev. 2, princípio 8). "Voltar" e "pular" seguem nos passos não essenciais (bateria, autostart, notificação). A saída sempre disponível é desinstalar — não é dark pattern enquanto o caminho às Configurações fica livre. |
| Parceiro obrigatório + válvula de expiração automática do pedido | Decisão de produto do usuário. Alinhado à primitiva **P7** (break-glass) da matriz de QA (`docs/qa/matriz-cenarios-burla.md`) e aos cenários J1–J3 ("parceiro sumiu"): ninguém pode ficar preso para sempre. |
| Assumir a latência do overlay no texto do teste real (Android) | Matriz de QA — grupo H / **D-lat**: 0,5–2 s de conteúdo visível medidos; polling mais rápido reduz, não elimina, e custa bateria. Nota transversal D: iOS é materialmente mais forte (shield pré-render). |
| Discador / emergência / Ajustes / o próprio app nunca são bloqueáveis, aplicado no seletor nativo + runtime | Segurança física. Matriz de QA — J6. Android: `RoleManager.ROLE_DIALER` / `ROLE_EMERGENCY` (API 29+), resolver de `ACTION_SETTINGS` / `CATEGORY_HOME`. iOS: chamada de emergência é garantida pelo SO; `Application.bundleIdentifier` legível na extensão de shield (iOS 16+) para a rede de segurança. |
| Vínculo do parceiro tem idade mínima antes de poder aprovar | Decisão do `supervisor` (fecha o roteiro "cúmplice de última hora", matriz de QA — F1/F10). Interface tem de mostrar a data a partir da qual o atalho existe. |
| Skeleton/estado de carregamento em vez de tela branca; feedback de toque em 80–150ms; micro-interações 150–300ms | `ui-ux-pro-max` pro-rules — *Interaction (App)*. |
| Dynamic Type / font scale sem quebrar layout; reduzir movimento respeitado | `ui-ux-pro-max` app-interface — *Dynamic Type Support*, severidade High; pro-rules checklist. |
| Battery optimization exige categoria elegível no Google Play | Google Play — *Permissions and APIs that Access Sensitive Information › `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`* (uso restrito a categorias específicas). Ver D3. |
| `FOREGROUND_SERVICE_SPECIAL_USE` exige declaração no Play Console (API 34+) | Android 14 behavior changes — *Foreground service types*. Ver D6. |
| Permission auto-reset / Hibernation revoga permissões de apps sem uso (Android 11+) | Android Developers — *Permissions › Auto-reset permissions from unused apps*. Motiva o health check no retorno. |
| Não dificultar acesso às Configurações / desinstalação | Google Play — *Device and Network Abuse*; *Deceptive Behavior*. Limita o que a seção 6.4 pode fazer. |

---

## 10. Dúvidas em aberto

### Resolvidas na rev. 2 (mantidas aqui como registro)

- **D1 — Entitlement de distribuição do Family Controls (iOS).** Levado ao
  usuário como caminho crítico; a solicitação à Apple é dele. Fora das mãos
  de `mobile` e `dev`.
- **D2 — Libs comunitárias vs. do zero.** Repassado ao `dev`; decisão de
  arquitetura, ele responde depois de entregar o backend.
- **D3 — Permissão de bateria.** Aceito: tenta `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
  (diálogo direto) e mantém `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` como
  plano B. §4.6.b já reflete. Não precisa de decisão de produto.
- **D4 — Alerta ao parceiro na queda de proteção.** Aprovado e tornado
  **obrigatório**, com consentimento explícito no onboarding (§4.2.c, §6.4.2).
- **D5 — "Pular" no onboarding.** Decidido **contra** a proposta original:
  onboarding das permissões *core* é inescapável, a única saída é desinstalar
  (princípio 8). §4.4.c, §5.4.c e §7 reescritas.
- **D6 — `FOREGROUND_SERVICE_SPECIAL_USE` / revisão do Play.** Risco real, já
  reportado ao usuário. Não bloqueia este doc; validação com `dev`.

### Ainda abertas

**D7 — iOS: reabrir o diálogo de autorização após `.denied`.**
Em algumas versões do iOS, uma vez negado o Family Controls o app não
reapresenta o diálogo — só resta Ajustes. Confirmar na versão-alvo se §5.4.c
precisa dos dois caminhos ("tentar de novo" vs. "só Ajustes") ou de um só. O
texto já está escrito para se adaptar ao `authorizationStatus`; falta só
saber qual ramo é o real. **Inclinação:** assumir que precisa dos dois e
degradar para "só Ajustes" quando `requestAuthorization` não reabrir.

**D8 — Escopo do `.child` / controle parental.**
Fora de escopo nesta versão, mas se o roadmap tem "pais controlam filhos", a
arquitetura de autorização muda (device gerenciado, Family Sharing) e a regra
"um parceiro por conta" pode não valer nesse modo. Vale saber agora para não
fechar portas.

**D9 — Deep links de autostart por fabricante.** → **decidida** (`supervisor`
concordou): não manter lista de intents de OEM (quebra a cada ROM). O passo
4.7 é sempre instrução manual ilustrada + vídeo curto por fabricante. §4.7 e a
linha A5 do §2 atualizadas para remover o *deep link*.

**D10 — Onboarding inescapável vs. revisão das lojas.** → **encaminhada ao
usuário** pelo `supervisor`. É achado real: um app que se recusa a funcionar
sem permissões especiais é o perfil que o revisor reprova, porque ele **não
vai conceder acesso de uso nem sobreposição** para testar, e marca "não
funciona". Ação (rodada de publicação, não agora): (a) tela de parada (§4.4.c,
§5.4.c) explícita o bastante para um humano apressado entender em 5 s; (b)
notas de revisão no console das duas lojas explicando que as permissões *são*
o produto. Registrado na §11.

**D11 — Duração da expiração automática.** → **decidida: 48 h**, valor da
config do servidor no payload de sincronização (não constante de app). O
conceito é fixo, o número é dado. §4.2.b já reflete. Nada mais a decidir.

---

## 11. Notas para a próxima rodada (cerimônia de desbloqueio)

Não é escopo desta rodada; registrado aqui para não se perder.

**iOS e Android são dois fluxos, não duas peles do mesmo (achado do `uxui`).**
O `ShieldConfiguration` do Family Controls é estático: ícone, título, corpo,
dois rótulos de botão, **sem cronômetro ao vivo, sem UI custom**. Consequência
estrutural:

- **iOS:** a cerimônia inteira (contagem do cooldown, pedido ao parceiro,
  status da aprovação, expiração automática) acontece **dentro do app**. O
  shield é só uma porta — dois botões, algo como "Fechar" / "Abrir
  AceleraLock". O `ShieldActionExtension` intercepta o toque e encaminha.
- **Android:** o overlay é nosso, controle total. A cerimônia pode viver na
  própria tela de bloqueio — cronômetro, botão de pedir desbloqueio, estado
  da aprovação, tudo ali.

Se a rodada de cerimônia partir de um desenho único e tentar adaptar para o
iOS depois, não encaixa. Desenhar os dois lado a lado desde o início, com a
lógica compartilhada (servidor, P1–P7 da matriz de QA) e as superfícies
separadas.

**Herda deste doc, para o texto das telas de cerimônia:**
- Expiração automática do pedido (princípio 7) e "religar ≠ desbloquear"
  (princípio 6) precisam aparecer.
- O prazo (**48 h hoje**) vem do payload de sincronização do servidor —
  interpolado, nunca cravado em layout ou cópia (D11).
- Idade mínima do vínculo (§4.2.b′): o 1º pedido dentro da janela de 48 h
  não tem atalho de parceiro; a tela precisa dizer isso e a data em que passa
  a ter.
- `ShieldConfiguration` (iOS 16+) expõe `Application.bundleIdentifier` — é o
  gancho da barreira 3 de segurança de apps críticos (§4.1.3); depende de
  `dev` para o módulo nativo.

**Item da rodada de publicação (D10):** notas de revisão no console da App
Store e do Google Play explicando que acesso de uso / sobreposição / Family
Controls **são o produto**, não acessório — o revisor não concede essas
permissões para testar e reprova por "não funciona". A tela de parada (§4.4.c,
§5.4.c) precisa ser entendível por um humano apressado em 5 s.
