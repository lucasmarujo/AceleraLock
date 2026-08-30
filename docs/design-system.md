# AceleraLock — Design System Base

> Fundação visual e de componentes para React Native + Expo (iOS e Android).
> Este documento é proposta. Nenhum código nesta rodada.
> Autor: sessão `uxui`. Solicitado por: `supervisor`.
> Rev. 2 — contraste do botão primário escuro fechado; incorporadas as respostas às 5 dúvidas bloqueantes (cooldown congelado no servidor, `BlockScreen` em dois designs, parceiro único, sem desbloqueio offline, duas válvulas de emergência) e o novo componente `PartnerInvite`.
> Rev. 3 — prazos são configuração de servidor (layout não crava dígitos) e push é só aviso (estado sempre do sync), ambos em §2.1; dúvidas #1/#2 parqueadas (dependem de código nativo).
> Rev. 4 — arquitetura virou 100% local (sem servidor, sem conta, sem parceiro; ver `backend.bkp/`). Removidos: prazo duplo (§2.6 antigo), estado `unknown` do `Countdown` (§2.3 antigo), `PartnerApprovalStatus`/`PartnerInvite` (§3.6/§3.21 antigos), válvula local de 7 dias/`LocalValveNotice` (§2.7/§3.22 antigos — a premissa era servidor podendo cair, não existe mais servidor). Conteúdo original em `git log` desta rev. e em `backend.bkp/`. Consolidação completa (renumerar, fechar `UnlockCeremony`/`BlockScreen` pra espera local) fica pra quando a leva 2 fechar — esta rodada só remove o que descreve arquitetura que não existe mais.

---

## 0. Princípios

O produto vive entre dois estados emocionais opostos, e o sistema precisa servir os dois sem trocar de identidade:

1. **Protegido (calma e orgulho).** O estado padrão. App bloqueado = você ganhou. Visual limpo, verde-petróleo calmo, respiração, sem alarme.
2. **Atrito honesto.** A tela de bloqueio e a cerimônia de desbloqueio. Desencoraja sem humilhar. O usuário **sempre** sabe onde está, o que falta e como sair. Sem dark pattern: nada de botão escondido, contagem falsa, texto culpando o usuário, ou saída disfarçada.

Regras que decorrem disso:

- **Uma ação primária por tela.** Na tela de bloqueio, a primária é quase sempre "Voltar / Fechar", não "Desbloquear".
- **A fricção é explícita.** Tempo restante, etapa atual e condição pendente ficam sempre visíveis. Se o tempo é desconhecido, dizemos que é desconhecido — não mostramos número inventado.
- **Ninguém fica preso.** Toda espera é cronometrada e termina sozinha (padrão 30 min, configurável pelo usuário). A fricção vem da lentidão honesta, não de trancar o usuário. A UI comunica isso com calma, nunca como ameaça.
- **Nada comunicado só por cor.** Todo estado tem rótulo textual e/ou ícone.
- **Vermelho é só erro.** Nunca é "atrito" nem "bloqueado". Atrito usa âmbar; bloqueado usa a marca.

---

## 1. Tokens

Valores concretos. A camada semântica (`color.bg`, `color.text.primary`, …) é o que os componentes consomem; os primitivos existem só para montar os temas.

### 1.1 Cor — primitivos

Neutros:

| Token | Hex |
|---|---|
| `neutral.0` | `#FFFFFF` |
| `neutral.50` | `#F6F7F8` |
| `neutral.100` | `#ECEEF1` |
| `neutral.200` | `#DDE1E6` |
| `neutral.300` | `#C2C8D0` |
| `neutral.400` | `#98A0AB` |
| `neutral.500` | `#6C7480` |
| `neutral.600` | `#4C535E` |
| `neutral.700` | `#343A43` |
| `neutral.800` | `#21262D` |
| `neutral.900` | `#14181D` |
| `neutral.950` | `#0D1014` |

Marca — turquesa + quase-preto (decisão do usuário, 2026-08-29). Não é uma escala de luminância como as outras: são dois valores-âncora, mais alguns tons derivados só onde a matemática de contraste exige (ver §1.2). O par se comporta como **um par**, não como dois tokens independentes — `surfaces.brand` (§1.2) é quem garante isso no código, não a lista abaixo:

| Token | Hex | Uso |
|---|---|---|
| `brand.turquesa` | `#03c3bf` | cor principal — fill do primário no escuro, rótulo do primário no claro, acento nos dois temas |
| `brand.tema` | `#04141c` | quase-preto azulado — fill do primário no claro, rótulo do primário no escuro, `bg.canvas`/`bg.surface` do tema escuro |
| `brand.turquesaTextLight` | `#037476` | link/texto de marca no claro — turquesa cru falha o piso de texto (4.5:1) sobre canvas claro |
| `brand.turquesaIconLight` | `#039796` | ícone/borda de marca no claro — elemento gráfico, piso 3:1 (não 4.5:1) |
| `brand.turquesaPressedDark` | `#03a09e` | pressed do primário no escuro |
| `brand.temaPressedLight` | `#042e34` | pressed do primário no claro |
| `brand.aceleraAzul` | `#014D93` | **cor de marca, não de UI** — ponta baixo-esquerda do gradiente do anel do badge de splash (§3.24), medida da logo do AceleraDev |
| `brand.aceleraCiano` | `#08EFD5` | idem, ponta cima-direita |

As duas últimas existem só pro badge de splash herdar a linhagem do AceleraDev; **nenhum token semântico as consome**. Tela que precise de azul usa o primitivo `blue` abaixo, não elas.

Âmbar — atrito / atenção (cooldown ativo, aviso):

| Token | Hex |
|---|---|
| `amber.50` | `#FBF1E2` |
| `amber.100` | `#F5DEBC` |
| `amber.300` | `#E7B369` |
| `amber.500` | `#C9871F` |
| `amber.550` | `#b37718` |
| `amber.600` | `#A56C13` |
| `amber.700` | `#7C4F0C` |

`amber.550` não é enfeite de escala: é o fill claro de `surfaces.amber` (badge/preenchimento âmbar), calculado pra fechar duas relações ao mesmo tempo — `amber.500` sozinho reprova contraste não-texto contra o canvas claro (2.81:1, piso 3:1), `amber.600` sozinho reprova o texto por cima (4.04:1, piso 4.5:1). Não "corrigir" de volta pro 500 nem pro 600 sem refazer as duas contas.

Erro — vermelho (só falha real):

| Token | Hex |
|---|---|
| `red.50` | `#FCEBEA` |
| `red.100` | `#F7CFCC` |
| `red.300` | `#E88C86` |
| `red.500` | `#C33A30` |
| `red.600` | `#9F2C24` |
| `red.700` | `#7A211B` |

Informação — azul (neutro, links, dicas):

| Token | Hex |
|---|---|
| `blue.50` | `#E8F0FB` |
| `blue.300` | `#7CAAE6` |
| `blue.500` | `#2C6BC4` |
| `blue.600` | `#22539B` |

### 1.2 Cor — tokens semânticos (tema claro / escuro)

| Semântico | Claro | Escuro | Uso |
|---|---|---|---|
| `bg.canvas` | `neutral.50` | `brand.tema` | fundo da tela |
| `bg.surface` | `neutral.0` | `neutral.900` | card, sheet, lista |
| `bg.surfaceRaised` | `neutral.0` | `neutral.800` | sheet sobre sheet, menu |
| `bg.sunken` | `neutral.100` | `neutral.950` | trilha de progresso, input |
| `bg.brandSubtle` | `#E6F9F9` | `#04262C` | fundo do estado "protegido" — turquesa a 10% sobre branco/`brand.tema`, não um primitivo da escala antiga |
| `bg.amberSubtle` | `amber.50` | `#3A2A0E` | fundo do estado "cooldown" |
| `bg.redSubtle` | `red.50` | `#3A1815` | fundo de erro inline |
| `bg.scrim` | `rgba(20,24,29,0.55)` | `rgba(0,0,0,0.65)` | backdrop de modal/sheet |
| `text.primary` | `neutral.900` | `neutral.50` | corpo, títulos |
| `text.secondary` | `neutral.600` | `neutral.300` | apoio, legendas |
| `text.tertiary` | `neutral.500` | `neutral.400` | placeholder, timestamp |
| `text.brand` | `brand.turquesaTextLight` | `brand.turquesa` | link, ênfase de marca (**não** é o fill do botão — ver `surfaces.brand` abaixo) |
| `text.danger` | `red.600` | `red.300` | mensagem de erro |
| `border.default` | `neutral.200` | `neutral.700` | borda de card, divisória |
| `border.strong` | `neutral.300` | `neutral.600` | borda de input, contorno |
| `border.brand` | `brand.turquesaIconLight` | `brand.turquesa` | input focado, chip selecionado |
| `focus.ring` | `brand.turquesaIconLight` | `brand.turquesa` | anel de foco (2px + offset 2px) |
| `icon.default` | `neutral.600` | `neutral.300` | ícone neutro |
| `icon.brand` | `brand.turquesaIconLight` | `brand.turquesa` | ícone de estado protegido |
| `icon.amber` | `amber.600` | `amber.300` | ícone de cooldown |

`bg.brand`/`bg.brandPressed`/`text.onBrand` **não existem mais como tokens soltos.** Botão preenchido de marca é sempre par único:

| `surfaces.*` | Claro | Escuro |
|---|---|---|
| `brand.fill` | `brand.tema` (`#04141c`) | `brand.turquesa` (`#03c3bf`) |
| `brand.onFill` | `brand.turquesa` | `brand.tema` |
| `brand.pressedFill` | `brand.temaPressedLight` | `brand.turquesaPressedDark` |
| `danger.fill` | `red.500` | `red.500` |
| `danger.onFill` | `neutral.0` | `neutral.0` |
| `danger.pressedFill` | `red.600` | `red.600` |
| `amber.fill` (badge/preenchimento raro) | `amber.550` | `amber.300` |
| `amber.onFill` | `neutral.900` | `neutral.900` |

**Regra do sistema, não coincidência de hex:** o `fill` do primário é sempre a cor que contrasta com o `bg.canvas` do tema; o `onFill` é sempre a oposta. É por isso que claro e escuro trocam quem é fundo e quem é rótulo em vez de repetir o mesmo par — turquesa como texto sobre canvas claro reprova contraste (2.20:1), então no claro ela vira acento/rótulo, não superfície.

Contraste — pares verificados (WCAG 2.1, dois eixos por par: texto-sobre-fill **e** fill-sobre-canvas quando o token é um preenchimento):

- `text.primary` claro sobre `bg.surface` claro: ~15:1 ✅
- `text.secondary` claro sobre `bg.surface` claro: ~7.4:1 ✅
- `text.primary` escuro sobre `bg.surface` escuro: ~14:1 ✅
- `text.secondary` escuro sobre `bg.surface` escuro: ~8:1 ✅
- `surfaces.brand` escuro — `onFill` (`#04141c`) sobre `fill` (`#03c3bf`): **8.52:1** ✅; `fill` sobre `bg.canvas` escuro (mesmo valor, `#04141c`≈canvas): contraste máximo, sobra.
- `surfaces.brand` claro — `onFill` (`#03c3bf`) sobre `fill` (`#04141c`): **8.52:1** ✅ (mesmo par, invertido); `fill` sobre `bg.canvas` claro (`neutral.50`): **17.45:1** ✅.
- `surfaces.brand.pressedFill` claro (`#042e34`) sobre `onFill`: **6.61:1** ✅ · escuro (`#03a09e`) sobre `onFill`: **5.82:1** ✅.
- `text.brand`/`icon.brand` claro — turquesa cru sobre `bg.canvas` claro reprova (2.20:1 como texto). `turquesaTextLight` (`#037476`) resolve o piso de texto: **5.58:1** ✅. `turquesaIconLight` (`#039796`, elemento gráfico, piso 3:1): **3.58:1** ✅. No escuro, turquesa cru já passa nos dois: **8.12–8.52:1** ✅, sem precisar de tom derivado.
- `surfaces.amber` claro — `amber.500` sozinho reprova fill-sobre-canvas (2.81:1); `amber.600` sozinho reprova texto-sobre-fill (4.04:1). `amber.550` fecha os dois: **3.52:1** (canvas) e **4.73:1** (texto) ✅. Escuro (`amber.300`) passa nos dois sem ajuste: **9.85:1** / **9.38:1** ✅.
- `surfaces.danger` — `red.500` reaproveitado nos dois temas (não existe `red.400` nos primitivos, e não criei um só pra isto): fill-sobre-canvas **4.93:1** (claro) / **3.54:1** (escuro), texto (`neutral.0`) sobre fill **5.29:1** (os dois temas) ✅.

> Todo par novo de cor deve ser validado nas duas relações (texto-sobre-fill **e** fill-sobre-canvas) antes de virar token final — validar só uma já causou dois furos nesta rodada (`amber.500` e o primário claro). A tabela acima é o ponto de partida, não a autoridade.

### 1.3 Tipografia

Fonte: **fonte do sistema** — San Francisco no iOS, Roboto no Android (`System` default do RN). Sem fonte custom nesta fase (não há marca definida). Números do cronômetro usam **variante tabular** (`fontVariant: ['tabular-nums']`) para não "pular" a cada segundo.

Escala (tamanho / entrelinha / peso). Tamanhos em pt; escalam com a fonte do sistema (`allowFontScaling` ligado, exceto onde indicado):

| Token | Tamanho | Entrelinha | Peso | Uso |
|---|---|---|---|---|
| `display` | 34 | 40 | 700 | número do cronômetro em tela cheia, hero |
| `title1` | 28 | 34 | 700 | título de tela |
| `title2` | 22 | 28 | 600 | título de seção, título de sheet |
| `title3` | 20 | 26 | 600 | card destaque |
| `body` | 17 | 24 | 400 | corpo padrão |
| `bodyStrong` | 17 | 24 | 600 | rótulo de botão, ênfase |
| `callout` | 15 | 20 | 400 | texto de apoio em card |
| `footnote` | 13 | 18 | 400 | legenda, timestamp |
| `caption` | 12 | 16 | 500 | rótulo de badge, overline |
| `timerHero` | 56 | 60 | 700 | cronômetro na cerimônia (tabular; escala travada em 1.3×) |

Regras:

- Nunca usar peso < 400 para texto sobre fundo colorido.
- Máx. ~60 caracteres por linha em texto corrido.
- Rótulo sempre em `bodyStrong` ou `caption`; nunca depender só de cor para indicar que é clicável — botão tem forma (preenchimento ou borda).

### 1.4 Espaçamento

Base 4. Escala:

| Token | px |
|---|---|
| `space.0` | 0 |
| `space.1` | 4 |
| `space.2` | 8 |
| `space.3` | 12 |
| `space.4` | 16 |
| `space.5` | 20 |
| `space.6` | 24 |
| `space.8` | 32 |
| `space.10` | 40 |
| `space.12` | 48 |
| `space.16` | 64 |

- Padding padrão de tela: `space.4` (16) nas laterais.
- Gap padrão entre itens de lista: `space.3` (12).
- Distância mínima entre dois alvos de toque adjacentes: `space.2` (8).

### 1.5 Raio

| Token | px | Uso |
|---|---|---|
| `radius.sm` | 8 | input, chip, badge |
| `radius.md` | 12 | botão, card |
| `radius.lg` | 16 | sheet (topo), card destaque |
| `radius.xl` | 24 | modal, container do cronômetro |
| `radius.full` | 999 | avatar, pill, anel de progresso |

### 1.6 Elevação

Semântica em 4 níveis. Cada nível mapeia para sombra (iOS) e `elevation` (Android) — mesma intenção, API nativa de cada plataforma. No tema escuro, preferir borda + `bg.surfaceRaised` a sombra (sombra some no escuro).

| Nível | Uso | iOS (`shadowColor #000`) | Android |
|---|---|---|---|
| `elevation.0` | plano, na superfície | nenhuma | `elevation: 0` |
| `elevation.1` | card, lista destacada | opacity 0.08, radius 8, offset `{0,2}` | `elevation: 2` |
| `elevation.2` | sheet, menu, popover | opacity 0.12, radius 16, offset `{0,6}` | `elevation: 6` |
| `elevation.3` | modal, cerimônia | opacity 0.18, radius 28, offset `{0,12}` | `elevation: 12` |

### 1.7 Motion

| Token | Valor |
|---|---|
| `duration.instant` | 100 ms |
| `duration.fast` | 150 ms |
| `duration.base` | 220 ms |
| `duration.slow` | 300 ms |
| `easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `easing.decelerate` | `cubic-bezier(0, 0, 0, 1)` (entrada) |
| `easing.accelerate` | `cubic-bezier(0.3, 0, 1, 1)` (saída) |

- Feedback de toque em < 100 ms sempre (opacidade/ripple).
- Transição de tela: `duration.base`, delegada ao navegador nativo.
- **`prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled`:** sem spring, sem "respiração" do estado protegido, sem animação do anel do cronômetro. Trocas viram fade de `duration.instant`. O cronômetro continua atualizando o texto a cada segundo (isso não é "motion", é informação).
- O número do cronômetro nunca "conta rápido" nem faz efeito de urgência artificial.

---

## 2. Componente de primeira classe: contagem regressiva (`Countdown`)

Aparece em quase toda tela do fluxo de desbloqueio. É o componente mais sensível do produto.

### 2.1 Fonte da verdade

- **O tempo restante vem do nativo** (Android: `native/modules/aceleralock-blocker`), que conta em **tempo monotônico acumulado** — nunca do relógio de parede. Adiantar o relógio não adianta a espera; reboot também não zera (mesma disciplina que o `BlockDecider` já documenta no próprio código-fonte).
- O `Countdown` **nunca chama `Date.now()`**. Entre leituras do nativo, interpola com um clock monotônico local; cada leitura nova reancora, e recalcula a cada tick e a cada retorno ao primeiro plano (`AppState` → `active`). Um restart do app só perde a interpolação entre ticks, nunca o valor de verdade — que sempre vem de novo da leitura.
- A espera é local ao aparelho e à ação (desbloquear um app específico, ou desligar a proteção) — não é um "pedido" que mora num servidor. Fechar o app **não pausa, não reseta, não penaliza**: a contagem nativa segue rodando.
- **Padrão de 30 minutos, configurável pelo usuário.** Nenhum número cravado em layout: `timerHero` e afins dimensionam pro texto mais longo plausível, não pro valor configurado hoje.
- O `Countdown` recebe o tempo restante por uma função injetada, nunca chama o nativo direto e não assume o formato do contrato — quem monta a tela é quem decide de onde a leitura vem.

### 2.2 Estados

| Estado | Quando | Visual | Leitor de tela |
|---|---|---|---|
| `loading` | ainda não lemos o tempo restante (primeira carga) | skeleton no lugar do número, nunca `00:00` | "Carregando tempo restante" |
| `running` | término conhecido, no futuro | número tabular + rótulo "Faltam X" | rótulo textual atualizado em bucket de 15 s, não a cada tick |
| `nearingEnd` | ≤ 60 s restantes | mesmo layout; peso/tamanho sobem um degrau; **sem** vermelho, **sem** piscar | anúncio em 60 s, 10 s |
| `complete` | restante ≤ 0 | número some, vira o próximo passo ("Espera concluída") + CTA da próxima etapa | anúncio "Espera concluída" |
| `error` | leitura do tempo restante falhou (nativo não respondeu) | mensagem + "Tentar de novo" | mensagem de erro |

Não existe mais estado `unknown`: a fonte do tempo é local (tempo monotônico acumulado no nativo, não servidor), então não há "sem contato com o servidor" — o que pode falhar é o nativo não responder, e isso é `error`.

### 2.4 Anatomia visual

- Número: `timerHero` (cerimônia) ou `display` (card), tabular, `text.primary`.
- Progresso: anel (`radius.full`, traço 4px, `bg.sunken` de trilha + `icon.amber` de preenchimento) OU barra linear. **O anel nunca é o único indicador** — número + rótulo textual sempre presentes.
- Rótulo: "Faltam 6 min 20 s" em `callout`, `text.secondary`.
- Cor de acento do cooldown: âmbar. Ao completar: a marca (turquesa).

### 2.5 Acessibilidade do `Countdown`

- **Não** anunciar cada segundo (abusivo com leitor de tela). Anunciar em marcos: início, 50%, 1 min, 10 s, concluído — via `AccessibilityInfo.announceForAccessibility` (throttle).
- O nó do número: `accessibilityRole="timer"` (iOS), `accessibilityLiveRegion="polite"` (Android), `accessibilityLabel` reescrito a cada ~15–30 s como "Faltam 6 minutos e 20 segundos" (não "06:20").
- `timerHero` trava escala de fonte em 1.3× para não quebrar layout; o rótulo textual abaixo escala livre.
- Sob reduce-motion: anel estático (só o texto muda).

---

## 3. Inventário de componentes-núcleo

Cada um com seus estados. `mobile` monta fluxos em cima destes sem inventar visual novo.

### 3.1 `Button`

- **Variantes:** `primary` (`surfaces.brand`: preenchido com `fill`, rótulo em `onFill` — **invertido por tema**, não dois valores fixos: no claro é fundo quase-preto (`#04141c`) com rótulo turquesa, no escuro é fundo turquesa com rótulo quase-preto; regra do sistema em §1.2, não coincidência), `secondary` (borda `border.strong`, fundo transparente, rótulo `text.primary`), `ghost` (só texto, `text.brand`), `destructive` (`surfaces.danger`: preenchido `fill`, rótulo `onFill`).
- **Tamanhos:** `lg` (altura 52, full-width — ação primária de tela), `md` (altura 44).
- **Estados:** `default`, `pressed` (cor -1 degrau + opacidade 0.92), `disabled` (opacidade 0.4, sem toque), `loading` (spinner substitui o rótulo, **largura preservada**), `focusVisible` (anel `focus.ring` 2px + offset 2px).
- Alvo de toque mínimo **48×48** mesmo no `md` (área de toque estendida via `hitSlop`).
- Rótulo diz a ação: "Salvar alterações", "Iniciar desbloqueio", "Voltar" — nunca "OK".

### 3.2 `Countdown`

Ver §2.

### 3.3 `ProtectedCard` (estado "você está protegido")

- Superfície calma: `bg.brandSubtle`, `radius.lg`, `elevation.1`.
- Conteúdo: ícone de escudo (`icon.brand`), "Instagram está bloqueado", "desde ontem, 21:00", opcional: sequência/streak ("3 dias seguidos").
- Tom recompensador, não punitivo. Sem "você tentou abrir X vezes".
- **Estados:** `default`, `loading` (skeleton), `empty` (nenhum app bloqueado → vira `EmptyState`).
- Micro-motion: "respiração" lenta e sutil do ícone (escala 1.0→1.03, 4 s, ease-in-out). Desligada sob reduce-motion.

### 3.4 `BlockScreen` — **dois designs, uma identidade**

O momento de atrito honesto. É onde a regra "comportamento delega, identidade fica idêntica" é testada de verdade, porque **no iOS a tela não é nossa**.

#### iOS — superfície do sistema (`ShieldConfiguration`, Family Controls)

Renderizada pelo próprio iOS. Não é React Native. A customização é um conjunto **fechado** de campos: ícone, título, corpo (subtítulo), rótulo do botão primário, rótulo do botão secundário — e cores desses elementos. Sem controle de layout, tipografia, composição ou motion. **Não há cronômetro ao vivo aqui** (a superfície é estática; só re-renderiza quando reconfigurada).

Projetar dentro da caixa:

- **Ícone:** o escudo da marca (mesma forma do `ProtectedCard`).
- **Título:** "Instagram está bloqueado".
- **Corpo:** curto e sem culpa. Ex.: "Você decidiu proteger seu tempo. Abra o AceleraLock para começar o desbloqueio." Nada de "você tentou X vezes".
- **Botão primário:** "Fechar" (volta ao início — a saída sem fricção).
- **Botão secundário:** "Abrir AceleraLock" (leva o cronômetro e a cerimônia para dentro do nosso app, onde temos controle total).
- Cor do título/botão: derivada dos tokens de marca, dentro do que o `ShieldConfiguration` aceita.

Consequência de produto: **no iOS a espera inteira (cronômetro, cancelar) vive dentro do app AceleraLock**, não na tela de bloqueio. A `BlockScreen` do iOS é só a porta.

#### Android — overlay nosso, código nativo (não é React Native)

`WindowManager` por cima do app-alvo (`OverlayPresenter`) — código Android, não RN. Mesma restrição de fundo que o iOS, por um motivo diferente: **esta tela não tem botão de desbloquear**. Não existe caminho de desbloqueio direto daqui — só abrindo o AceleraLock e pedindo, com a espera (`WaitingScreen`, §3.5). Por isso o Android também vira "só a porta", como o iOS (§5): o overlay informa e direciona, a espera ao vivo mora no app.

- **Fundo:** `bg.canvas` do tema do sistema no aparelho (claro `#F6F7F8` / escuro `#04141c`), opaco — tela cheia, nunca transparente. É o oposto do que existe hoje (overlay vazio deixando o app-alvo visível "atrás de vidro", que lê como celular quebrado, não como bloqueio).
- **Hierarquia (topo → base, centralizada):**
  1. Cadeado da marca (`assets/png/mark/lock-3d-512.png`, copiado para `res/drawable-xxxhdpi/ic_aceleralock_mark.png` no módulo nativo), 72dp. **Um asset serve os dois temas** — o turquesa com alfa lê tanto sobre o canvas claro quanto sobre o escuro, então aqui não há par `drawable`/`drawable-night` a manter em sincronia. O SVG de origem (`assets/svg/aceleralock-adaptive-foreground.svg`) usa `mask`, `filter` e `skewX`, que VectorDrawable não suporta — por isso PNG, como na `SplashScreen`.
  2. Título: "[App] está bloqueado." — `title2`, `text.primary`. Sem nome de app resolvido nesta superfície: "Este app está bloqueado." (caminho real, não decoração — nome de pacote pode não resolver em Android 11+ sem `<queries>` no manifesto).
  3. Corpo: **uma frase motivacional sorteada** de `res/values/arrays.xml` (1000 frases, `aceleralock_block_motivation`), com **shimmer em looping** (`ShimmerTextView`). O sorteio acontece na construção da `View`, e o `OverlayPresenter` só constrói uma `View` nova quando o pacote em primeiro plano muda — então é uma frase diferente por tentativa, que é o efeito pretendido. **A contagem de espera saiu desta superfície** (decisão de 2026-08-30): quem chega aqui já sabe que o app está bloqueado, e repetir o procedimento dava ao impulso mais uma porta pra olhar. A espera ao vivo mora dentro do app. As regras de escrita das frases (sem caractere que exija escape em resource, 8–90 caracteres, nenhuma repetida, nenhuma que culpe) estão travadas em `tests/frasesMotivacionais.test.ts`.
  4. **Um botão só: "Fechar"**, em cápsula (`cornerRadius` grande — o `GradientDrawable` limita o raio a `min(largura, altura) / 2`, então fica 100% arredondado em qualquer altura), largura total. Manda a pessoa para a home do Android (`ACTION_MAIN`/`CATEGORY_HOME`), não fecha nem penaliza o app-alvo (ele continua em recentes) — só tira do primeiro plano, que é a condição que sustenta o bloqueio; sem isso o overlay reaparece em até 1s no próximo tick do detector. **"Abrir AceleraLock" saiu** na mesma decisão de 2026-08-30: era a única ação da tela que levava de volta pra dentro de um app, e dependia da exceção frágil de `SYSTEM_ALERT_WINDOW` a *background activity starts*. Quem quer o AceleraLock abre pela gaveta.
- **Motivo próprio da pessoa (por que bloqueou este app) — não existe no modelo hoje.** Não há campo em `BlockPolicy`, nem tela que capture, nem persistência. Não é detalhe de implementação: é feature nova (dado + tela de captura + migração), fora do escopo desta rodada. Se for pra entrar, é pedido separado — não implementar campo vazio nem inventar de onde tirar.
- **O que não existe aqui, de propósito:** botão "Desbloquear", contagem de tentativas, qualquer texto que culpe ("você tentou X vezes"), vermelho, alarme, animação de urgência. O shimmer da frase **não é urgência** — é ambiente: varredura lenta e contínua, sem piscar e sem acelerar, e desligada sob reduce-motion (§1.7 e §3.3). Mesmo cadeado calmo da marca, não um símbolo de punição.
- **Regras anti-dark-pattern (as duas plataformas):** a saída sem fricção (aqui, "Fechar") sempre no mesmo lugar, com peso visual igual ou maior que a outra ação — nunca menor, nunca escondida. No Android isso ficou trivialmente satisfeito: **"Fechar" é a única ação da tela**. Nada irreversível sem confirmação. Passo atual e pendência sempre visíveis, nunca um número inventado.

#### O que mantém a identidade única

Mesma marca, mesma paleta, mesma voz de texto, mesmos rótulos-verbo, mesmo tom sem-culpa. O usuário reconhece o AceleraLock nas duas — a diferença é só quanta tela o SO nos deixa desenhar. (O corpo diverge de propósito desde 2026-08-30: no iOS a superfície é estática e reconfigurada pelo sistema, então a frase sorteada e o shimmer são só do Android.)

### 3.5 Tela de espera (ex-`UnlockCeremony`)

Sem parceiro nem passo de aprovação, a cerimônia de múltiplas etapas caiu: sobra uma espera cronometrada única (`Countdown`, padrão 30 min, configurável) antes de desbloquear um app ou desligar a proteção. `Stepper` (§3.7) não é mais usado aqui.

Duas coisas que o `supervisor` marcou como não-negociáveis pra quando esta tela for montada, e que já vão condicionando `Countdown`/`Button`:

- **Cancelar é fácil, não escondido.** Desistir da espera é o resultado que o produto quer — botão de saída no mesmo peso visual da ação de esperar, sempre visível, nunca atrás de confirmação extra.
- **O contador não é hostil.** Sem vermelho, sem piscar, sem contagem regressiva dramática — mesma regra do `Countdown` em `nearingEnd` (§2.2), aqui é o produto inteiro, não só o componente.

Layout final (container, exato texto, o que acontece em `error`) é trabalho de leva 2 — este parágrafo registra a restrição, não fecha o desenho.

### 3.7 `Stepper`

- Linear, horizontal ou vertical, rótulo textual em cada passo (não só bolinha).
- Passo atual óbvio: preenchido + `bodyStrong`. Concluído: check. Pendente: contorno.
- Estado por passo: `pending`, `active`, `done`, `failed`.

### 3.8 `AppListItem`

- Ícone do app + nome + `Badge` de status + `Toggle` ou chevron.
- **Estados:** `blocked`, `scheduled` ("Bloqueia às 22:00"), `allowed`, `loading`.

### 3.9 `Toggle`

- `Switch` nativo da plataforma (aparência iOS / Material), mas rótulo sempre à esquerda, estado descrito por texto adjacente, não só pela posição.
- **Estados:** `on`, `off`, `disabled`, `loading` (durante persistência).
- `accessibilityRole="switch"` + `accessibilityState={{ checked }}`.

### 3.10 `TextField`

- **Rótulo sempre visível acima** (nunca placeholder como rótulo).
- Helper text abaixo; erro substitui o helper e diz **como resolver** ("Digite um e-mail válido, ex.: nome@dominio.com"), não só "inválido".
- **Estados:** `default`, `focus` (`border.brand` + `focus.ring`), `error` (`border` vermelho + `text.danger`), `disabled`, `readOnly`.
- Altura mínima 48. `accessibilityLabel` = rótulo; erro via `accessibilityLiveRegion` + `accessibilityState={{ invalid: true }}`.

### 3.11 `InlineAlert` / `Banner`

- Variantes: `info` (azul), `warning` (âmbar), `error` (vermelho), `success` (a marca, turquesa).
- Ícone + texto + ação opcional. Fundo `*.Subtle`.
- Usado para: falha ao ler o tempo restante, permissão do sistema revogada. **Nunca toast para informação crítica que exige ação.**

### 3.12 `Toast`

- Só confirmação transitória e não crítica ("Instagram adicionado à lista").
- Auto-dismiss 4 s, swipe para fechar. **Nunca** para erro acionável.
- `accessibilityLiveRegion="polite"`.

### 3.13 `Sheet` (bottom sheet)

- Confirmações, escolhas, passos da cerimônia.
- Handle de arraste, backdrop `bg.scrim`, topo `radius.lg`.
- Dismissível por padrão; **não** dismissível quando é um passo comprometido da cerimônia (aí só "Cancelar" explícito).
- `elevation.2`. Respeita safe area inferior.

### 3.14 `Dialog`

- Confirmação bloqueante ("Remover [app] da lista de bloqueio?"). Título + corpo + no máximo 2 ações.
- Ação destrutiva à direita, em `destructive`; cancelar à esquerda.
- `accessibilityViewIsModal`, foco preso, primeiro foco no título.

### 3.15 `EmptyState`

- Ícone/ilustração + título + 1 frase + CTA opcional.
- Para: nenhum app bloqueado ainda, sem histórico.
- Tom convidativo, não neutro-vazio ("Adicione o primeiro app que rouba seu tempo").

### 3.16 `Skeleton`

- Placeholder de carga para listas e para o número inicial do `Countdown`.
- Sem shimmer sob reduce-motion (fica estático).

### 3.17 `Avatar`

- Parceiro. Imagem → iniciais → ícone genérico (nessa ordem de fallback).
- `radius.full`. Tamanhos: 24, 32, 40.

### 3.18 `Badge`

- Rótulo de status: "Bloqueado", "Agendado", "Liberado".
- Sempre cor **+ texto** (e ícone quando couber). Nunca cor sozinha.
- `caption`, `radius.sm`.

### 3.19 `ListRow` / `SettingsRow`

- Ícone opcional + rótulo + valor/controle à direita + chevron.
- Altura mínima 48. Toque no row inteiro.

### 3.20 Navegação — `Header` e `TabBar`

- **`Header`:** título da tela + ação de voltar (seta iOS / seta Android) + ações à direita. Large-title permitido no iOS, top app bar padrão no Android — **mesmo texto, mesmas ações**.
- **`TabBar`:** 2–4 destinos, ícone + rótulo, na base. Tab bar iOS / navigation bar Android. Item ativo em `icon.brand` + rótulo `bodyStrong`.
  - O piso era 3. Passou a 2 em 2026-08-30, quando a área logada ganhou Início e Perfil: o app faz uma coisa, e um terceiro destino existiria só para cumprir a faixa — item de menu de enfeite é pior que uma barra curta.

### 3.23 Estados obrigatórios por tela

Toda tela declara: `loading`, `empty`, `error`, `success`/conteúdo. Tela sem estado vazio é tela incompleta. Toda ação assíncrona dá feedback visual em < 100 ms (mesmo que seja só o botão em `loading`).

### 3.24 `SplashScreen` — splash de marca

- Badge do AceleraLock (128) + nome em `title1`, centralizados; assinatura **"Made By"** em `caption`/`textTertiary` + logo do AceleraDev (56) na base.
- **É tela do app, não imagem da splash nativa.** A splash do Android 12+ recorta o que mostra num círculo e aceita um ícone só — texto e uma segunda logo não sobrevivem ao recorte. A nativa mostra só o badge; esta tela continua a partir dele, **no mesmo `bgCanvas`**, pra transição não piscar.
- É o `loading` do `RootNavigator` (§3.23), com piso de tempo (`SPLASH_MIN_MS`): o veredito resolve em poucos ms e sem piso a assinatura apareceria por um frame. O piso corre **em paralelo** com o veredito, não em série.
- As duas logos são PNG geradas (`assets/brand/README.md`), não `<Svg>` — o app não tem `react-native-svg`.

---

## 4. Acessibilidade — decisões explícitas

- **Contraste:** WCAG 2.1 AA. 4.5:1 texto normal, 3:1 texto grande (≥ 24 pt, ou ≥ 18.66 pt bold) e elementos de interface / gráficos. Tabela de pares verificados em §1.2, nas duas relações (texto-sobre-fill e fill-sobre-canvas) — **todos os pares do sistema passam**, incluindo o botão primário nos dois temas (par turquesa/`#04141c`, 8.52:1, invertido entre claro e escuro).
- **Alvo de toque:** mínimo **48×48 dp** (cobre iOS 44 e Android 48). Espaçamento ≥ 8 entre alvos adjacentes. `hitSlop` para ícones pequenos.
- **Fonte ampliada do sistema:** `allowFontScaling` ligado em tudo, exceto `timerHero` (travado em 1.3×). Layouts em flex, sem altura fixa em container de texto. Testar a 200%.
- **Leitor de tela (VoiceOver / TalkBack):** todo elemento interativo tem `accessibilityLabel` + `accessibilityRole` + `accessibilityState` (`disabled`, `checked`, `busy`, `invalid`). Ícone decorativo: `accessibilityElementsHidden` (iOS) / `importantForAccessibility="no-hide-descendants"` (Android). Ordem de foco segue a ordem visual. Modais prendem foco.
- **Cronômetro:** anúncios em marcos, nunca por segundo (§2.5).
- **Nada só por cor:** todo status tem texto/ícone. `denied` e `error` se distinguem por texto, não só por matiz.
- **Foco visível:** anel `focus.ring` 2px + offset — para teclado externo, Switch Control, Full Keyboard Access.
- **Reduce motion:** respeitado em todo lugar (§1.7).
- **Reduce transparency:** sem fundo que dependa de blur; fallback sólido.
- **Hierarquia de heading:** um `title1` por tela; seções em `title2`; `accessibilityRole="header"` nos títulos.
- **Toque/háptica:** sutil, em transições relevantes (desbloqueio concedido). Nunca é o único feedback.
- **Idioma:** pt-BR. Rótulo = verbo ("Salvar alterações"). Erro = solução, não só constatação.

---

## 5. Adaptação iOS ↔ Android sem virar dois designs

**Regra:** o que é *comportamento da plataforma* delega-se à plataforma. O que é *o que o AceleraLock é* fica idêntico.

**Idêntico nas duas:** tokens de cor, tipografia (a escala; a família muda), espaçamento, raio, todos os componentes de §3, arquitetura de informação, cópia, fluxos, estados.

**Delegado à plataforma:**

| Aspecto | iOS | Android |
|---|---|---|
| Família de fonte | San Francisco | Roboto |
| Feedback de toque | opacidade / highlight | ripple (`android_ripple` no `Pressable`) |
| Elevação | sombra | `elevation` dp |
| Voltar | seta no header + swipe-back | seta no header + botão/gesto do sistema |
| Header | large-title opcional | top app bar |
| Switch / date picker | controle nativo iOS | controle Material |
| Transição de tela | push nativo | nativo |
| Scroll | bounce | overscroll glow |
| Safe area | `react-native-safe-area-context` (notch, home indicator) | idem (cutout, nav bar) |
| Háptica | Taptic Engine | vibração / `HapticFeedback` |

**Não fazer:** blur estilo iOS no Android, FAB Material no iOS, dois conjuntos de ícones (usar **uma** biblioteca de ícones nas duas plataformas — não SF Symbols + Material). Nenhum componente exclusivo de uma plataforma que mude o fluxo da tarefa.

**Cor dinâmica (Material You / Android 12+):** **não** adotar nesta fase — a paleta da marca é fixa e o estado "protegido/atrito" depende de cor semântica estável. Reavaliar depois.

**O caso-limite: `BlockScreen` (§3.4).** É a maior divergência forçada do produto — no iOS é uma superfície do sistema com campos fixos e sem cronômetro; no Android é overlay nosso com tela cheia. A regra se aplica na forma mais dura: a *identidade* (escudo, paleta, voz, rótulos-verbo, tom sem-culpa) é idêntica; o *layout* é o que cada SO permitir. No iOS, a cerimônia inteira migra para dentro do app — a `BlockScreen` é só a porta.

---

## 6. Como isto vira código (nota para `dev` / `mobile`, fora de escopo desta rodada)

- Tokens como um único módulo TS (`theme/tokens.ts`) — primitivos + os dois temas semânticos.
- Provider de tema com detecção de `useColorScheme()` + override manual.
- Componentes de §3 numa pasta `components/` plana; sem lib de UI externa nesta fase (RN puro + `Pressable` + `react-native-safe-area-context` + uma lib de ícones + `react-native-reanimated` só se o motion exigir).
- Nada disso agora. Só quando `supervisor` liberar.

---

## 7. Dúvidas em aberto

Fechadas nesta rodada: cooldown não pausa/reseta (§2.1) · `BlockScreen` são dois designs (§3.4) · contraste do botão primário — nas duas direções, escuro e claro invertido (§1.2) · prazo é config local, layout não crava dígitos (§2.1). A arquitetura de parceiro/servidor que motivou boa parte das dúvidas antigas (offline, dois bypasses, pareamento assíncrono) não existe mais — ver Rev. 4 no topo.

Parqueadas (só se respondem com código nativo na mão; `dev` está no módulo nativo):

- **Campos exatos do `ShieldConfiguration` (iOS)** — lista real de campos, se aceita mais de um botão, se reconfigura em background. O design da §3.4 assume o pior caso (estático, campos mínimos) até haver resposta.
- **Overlay do Android (`SYSTEM_ALERT_WINDOW`)** — confiabilidade em OEMs restritivos; pode exigir plano B para a `BlockScreen` Android. `qa` já catalogou no grupo C da matriz de burla — ler antes de assumir que o overlay sempre sobe.

Ainda abertas (produto):

1. **Gamificação / streak** — existe recompensa para o polo "orgulho" (sequência, conquistas) ou só calma neutra? Define se `ProtectedCard` ganha componentes de progresso.
2. **Fonte custom** — ficamos em fonte de sistema. Se a marca pedir fonte própria, a escala de §1.3 é reaproveitável, mas entrelinhas precisam de reteste.
3. **Escopo de localização** — só pt-BR ou também en? Afeta folga de layout e teste de fonte ampliada.
4. **Versões mínimas de OS** (iOS / Android) — afeta APIs disponíveis (Family Controls, `SYSTEM_ALERT_WINDOW`, `accessibilityLanguage`).
5. **Alinhar registro emocional do onboarding com `mobile`** — o tom da primeira sessão precisa casar com o polo "calma e orgulho".
6. **Layout final da tela de espera** (§3.5) — cancelar fácil e contador calmo são restrição fechada; container, cópia exata e o que `error` mostra ali ainda não.
