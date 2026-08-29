# AceleraLock — Design System Base

> Fundação visual e de componentes para React Native + Expo (iOS e Android).
> Este documento é proposta. Nenhum código nesta rodada.
> Autor: sessão `uxui`. Solicitado por: `supervisor`.
> Rev. 2 — contraste do botão primário escuro fechado; incorporadas as respostas às 5 dúvidas bloqueantes (cooldown congelado no servidor, `BlockScreen` em dois designs, parceiro único, sem desbloqueio offline, duas válvulas de emergência) e o novo componente `PartnerInvite`.
> Rev. 3 — prazos são configuração de servidor (layout não crava dígitos) e push é só aviso (estado sempre do sync), ambos em §2.1; dúvidas #1/#2 parqueadas (dependem de código nativo).

---

## 0. Princípios

O produto vive entre dois estados emocionais opostos, e o sistema precisa servir os dois sem trocar de identidade:

1. **Protegido (calma e orgulho).** O estado padrão. App bloqueado = você ganhou. Visual limpo, verde-petróleo calmo, respiração, sem alarme.
2. **Atrito honesto.** A tela de bloqueio e a cerimônia de desbloqueio. Desencoraja sem humilhar. O usuário **sempre** sabe onde está, o que falta e como sair. Sem dark pattern: nada de botão escondido, contagem falsa, texto culpando o usuário, ou saída disfarçada.

Regras que decorrem disso:

- **Uma ação primária por tela.** Na tela de bloqueio, a primária é quase sempre "Voltar / Fechar", não "Desbloquear".
- **A fricção é explícita.** Tempo restante, etapa atual e condição pendente ficam sempre visíveis. Se o tempo é desconhecido, dizemos que é desconhecido — não mostramos número inventado.
- **Ninguém fica preso.** Todo pedido tem uma saída automática (30 min com parceiro, 48 h sem). A fricção vem da lentidão honesta, não de trancar o usuário. A UI comunica isso com calma, nunca como ameaça.
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

Marca — verde-petróleo (estado "protegido", ação primária):

| Token | Hex |
|---|---|
| `brand.50` | `#E4F3EF` |
| `brand.100` | `#BFE2DA` |
| `brand.200` | `#8FCcBF` |
| `brand.300` | `#5DB3A2` |
| `brand.400` | `#2F9784` |
| `brand.500` | `#0E7A66` |
| `brand.600` | `#0A6252` |
| `brand.700` | `#084C40` |
| `brand.800` | `#06392F` |

Âmbar — atrito / atenção (cooldown ativo, aguardando parceiro, aviso):

| Token | Hex |
|---|---|
| `amber.50` | `#FBF1E2` |
| `amber.100` | `#F5DEBC` |
| `amber.300` | `#E7B369` |
| `amber.500` | `#C9871F` |
| `amber.600` | `#A56C13` |
| `amber.700` | `#7C4F0C` |

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
| `bg.canvas` | `neutral.50` | `neutral.950` | fundo da tela |
| `bg.surface` | `neutral.0` | `neutral.900` | card, sheet, lista |
| `bg.surfaceRaised` | `neutral.0` | `neutral.800` | sheet sobre sheet, menu |
| `bg.sunken` | `neutral.100` | `neutral.950` | trilha de progresso, input |
| `bg.brandSubtle` | `brand.50` | `brand.800` | fundo do estado "protegido" |
| `bg.amberSubtle` | `amber.50` | `#3A2A0E` | fundo do estado "cooldown" |
| `bg.redSubtle` | `red.50` | `#3A1815` | fundo de erro inline |
| `bg.scrim` | `rgba(20,24,29,0.55)` | `rgba(0,0,0,0.65)` | backdrop de modal/sheet |
| `text.primary` | `neutral.900` | `neutral.50` | corpo, títulos |
| `text.secondary` | `neutral.600` | `neutral.300` | apoio, legendas |
| `text.tertiary` | `neutral.500` | `neutral.400` | placeholder, timestamp |
| `text.onBrand` | `neutral.0` | `neutral.950` | texto sobre `bg.brand` (ver nota de contraste) |
| `text.onAmber` | `neutral.900` | `neutral.900` | texto sobre `bg.amber` |
| `text.brand` | `brand.600` | `brand.300` | link, ênfase de marca |
| `text.danger` | `red.600` | `red.300` | mensagem de erro |
| `bg.brand` | `brand.500` | `brand.400` | preenchimento de botão primário |
| `bg.brandPressed` | `brand.600` | `brand.500` | botão primário pressionado |
| `bg.amber` | `amber.500` | `amber.300` | preenchimento âmbar (raro; usar subtle antes) |
| `bg.danger` | `red.500` | `red.400` | botão destrutivo |
| `border.default` | `neutral.200` | `neutral.700` | borda de card, divisória |
| `border.strong` | `neutral.300` | `neutral.600` | borda de input, contorno |
| `border.brand` | `brand.400` | `brand.300` | input focado, chip selecionado |
| `focus.ring` | `brand.500` | `brand.300` | anel de foco (2px + offset 2px) |
| `icon.default` | `neutral.600` | `neutral.300` | ícone neutro |
| `icon.brand` | `brand.500` | `brand.300` | ícone de estado protegido |
| `icon.amber` | `amber.600` | `amber.300` | ícone de cooldown |

Contraste — pares já verificados (WCAG 2.1, alvo AA):

- `text.primary` claro sobre `bg.surface` claro: ~15:1 ✅
- `text.secondary` claro (`neutral.600` `#4C535E`) sobre `bg.surface` claro: ~7.4:1 ✅
- `text.onBrand` (`#FFFFFF`) sobre `bg.brand` claro (`#0E7A66`): ~5.2:1 ✅ (AA corpo)
- `text.onAmber` (`neutral.900`) sobre `bg.amber` claro (`#C9871F`): ~7.1:1 ✅
- `text.primary` escuro (`neutral.50`) sobre `bg.surface` escuro (`neutral.900`): ~14:1 ✅
- `text.secondary` escuro (`neutral.300`) sobre `bg.surface` escuro: ~8:1 ✅
- `text.onBrand` escuro (`neutral.950` `#0D1014`) sobre `bg.brand` escuro (`brand.400` `#2F9784`): **~5.3:1 ✅ (AA corpo)** — **decisão fechada:** no tema escuro o rótulo do botão primário é quase-preto, não branco. Branco sobre `brand.400` dava só ~3.4:1 (reprovado para texto normal) e foi descartado. O preenchimento continua `brand.400` (mais claro que `brand.500`, lê melhor sobre superfície escura).

> Todo par novo de cor deve ser validado em ferramenta de contraste antes de virar token final. A tabela acima é o ponto de partida, não a autoridade.

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

- O payload traz **`serverTime` + `...EndsAt`**, ambos do servidor. O cliente calcula `restante = EndsAt − serverTime − (agora_local − momento_da_resposta)`. Nunca subtrai do relógio do aparelho: mexer na hora do celular não pode acelerar nada.
- Recalcular a cada tick e a cada retorno ao primeiro plano (`AppState` → `active`).
- O prazo é **congelado no servidor no instante em que o pedido é criado** e corre independente do app: aberto, fechado, desinstalado ou celular desligado. **Fechar o app não pausa nem reseta nem penaliza.** Não existe estado `paused`. O `Countdown` só desenha o que o servidor já decidiu.
- Nunca persistir "segundos restantes" localmente — só o instante de término e o offset servidor↔cliente da última resposta autenticada.
- **Os prazos (30 min / 48 h / 7 dias) vivem na configuração do servidor e chegam no payload de sync — mudam sem release de app.** Nenhum número cravado em layout: `timerHero` e afins dimensionam para "45 h 59 min" ou "120 min", não para o valor de hoje. Toda cópia que cita um prazo lê do sync, nunca de constante local.
- **Notificação push é só aviso, nunca autoridade.** O push carrega tipo + identificador do pedido, nada mais — sem decisão, sem prazo. Nenhuma tela renderiza estado a partir do conteúdo da notificação; sempre a partir do sync. Ao abrir por um push, a tela entra em `loading` até o sync responder.

### 2.2 Estados

| Estado | Quando | Visual | Leitor de tela |
|---|---|---|---|
| `loading` | ainda não sabemos o término (primeira carga) | skeleton no lugar do número, nunca `00:00` | "Carregando tempo restante" |
| `running` | término conhecido, no futuro | número tabular + anel/barra de progresso + rótulo "Faltam X" | rótulo textual atualizado a cada ~15 s |
| `nearingEnd` | ≤ 60 s restantes | mesmo layout; peso/tamanho sobem um degrau; **sem** vermelho, **sem** piscar | anúncio em 60 s, 10 s |
| `complete` | restante ≤ 0 | número some, vira o próximo passo ("Espera concluída") + CTA da próxima etapa | anúncio "Espera concluída" |
| `unknown` | sem contato com o servidor e término não confiável | ver §2.3 | ver §2.3 |
| `error` | término inválido / sessão expirada | mensagem + "Tentar de novo" | mensagem de erro |

Um mesmo pedido carrega **dois prazos** (aprovação do parceiro em 30 min · liberação automática em 48 h): ver §2.6. `running` e `nearingEnd` referem-se sempre ao **prazo ativo no momento**.

### 2.3 Estado `unknown` / offline — regra dura

**Este é caminho principal, não caso de erro.** O desbloqueio só nasce numa transação no servidor (não há liberação offline), então toda vez que o usuário ficar sem rede no meio de uma cerimônia ele cai aqui. A tela tem que ser calma e informativa, não um alerta de falha.

Quando o app **não consegue falar com o servidor** e o tempo restante não é confiável:

- **Não** mostrar número. **Não** mostrar spinner infinito. **Não** contar a partir de um palpite.
- Mostrar texto explícito: **"Tempo restante indisponível — sem conexão com o servidor."**
- Se houver uma última estimativa conhecida, mostrá-la **claramente marcada como estimativa e desatualizada**: "Estimativa da última sincronização: ~7 min (às 14:32)", em `text.tertiary`, riscada ou com ícone de "desatualizado".
- Ação primária: **"Tentar de novo"** (re-sincronizar). Enquanto tenta: estado de loading no botão.
- Ao reconectar: reconciliar com o servidor. O tempo pode **aumentar** (ex.: servidor detectou manipulação de relógio) — a UI aceita isso sem drama, com uma linha explicando ("O tempo foi ajustado pelo servidor.").
- A cerimônia de desbloqueio **não avança** no estado `unknown`. O usuário entende que a espera é validada no servidor, não no aparelho.

### 2.4 Anatomia visual

- Número: `timerHero` (cerimônia) ou `display` (card), tabular, `text.primary`.
- Progresso: anel (`radius.full`, traço 4px, `bg.sunken` de trilha + `icon.amber` de preenchimento) OU barra linear. **O anel nunca é o único indicador** — número + rótulo textual sempre presentes.
- Rótulo: "Faltam 6 min 20 s" em `callout`, `text.secondary`.
- Cor de acento do cooldown: âmbar. Ao completar: marca (verde).

### 2.5 Acessibilidade do `Countdown`

- **Não** anunciar cada segundo (abusivo com leitor de tela). Anunciar em marcos: início, 50%, 1 min, 10 s, concluído — via `AccessibilityInfo.announceForAccessibility` (throttle).
- O nó do número: `accessibilityRole="timer"` (iOS), `accessibilityLiveRegion="polite"` (Android), `accessibilityLabel` reescrito a cada ~15–30 s como "Faltam 6 minutos e 20 segundos" (não "06:20").
- `timerHero` trava escala de fonte em 1.3× para não quebrar layout; o rótulo textual abaixo escala livre.
- Sob reduce-motion: anel estático (só o texto muda).

### 2.6 Prazo duplo — um número em destaque, o outro como contexto

Todo pedido tem dois desfechos possíveis, com prazos diferentes:

- **`partnerEndsAt`** — ~30 min após a criação. Passado esse tempo, **a aprovação do parceiro libera na hora**.
- **`autoEndsAt`** — ~48 h após a criação. Sem nenhuma aprovação, o pedido se resolve sozinho (válvula unilateral). Sem parceiro na conta, este é o único prazo.

A fricção continua de pé porque o caminho sem parceiro é ~96× mais lento — mas ninguém fica preso.

**Regra visual: nunca dois números grandes ao mesmo tempo.** Um prazo é o `timerHero`/`display`; o outro é **uma linha** de contexto em `callout` / `text.secondary`. Qual fica em destaque depende do momento:

| Momento | Destaque (número grande) | Linha de contexto |
|---|---|---|
| Primeiros 30 min, **com** parceiro | `partnerEndsAt` — "Faltam 24 min para desbloquear com a aprovação de [nome]" | "Sem aprovação, libera sozinho em ~47 h" |
| Primeiros 30 min, **sem** parceiro | `autoEndsAt` — "Libera automaticamente em ~47 h" | "Com um parceiro de confiança, a espera cai para 30 min" |
| Após 30 min, parceiro ainda não aprovou (`awaitingPartner`) | `autoEndsAt` — "Libera automaticamente em ~46 h" | "Assim que [nome] aprovar, libera na hora" + `PartnerApprovalStatus` |
| Parceiro aprovou | — (vai para `complete`) | — |

O `Countdown` recebe uma prop `dualDeadline` com os dois instantes e escolhe sozinho qual promover, pela regra acima.

### 2.7 Válvula local de 7 dias

Se o app passar **7 dias sem conseguir falar com o servidor**, ele libera o bloqueio sozinho (proteção contra o backend cair). Isso **não pode ser silencioso**: ver o componente `LocalValveNotice` (§3.22). Enquanto a contagem de 7 dias corre em segundo plano, o estado `unknown` do `Countdown` ganha uma linha discreta: "Sem conexão há N dias. Após 7 dias sem servidor, o bloqueio é liberado automaticamente."

---

## 3. Inventário de componentes-núcleo

Cada um com seus estados. `mobile` monta fluxos em cima destes sem inventar visual novo.

### 3.1 `Button`

- **Variantes:** `primary` (preenchido `bg.brand`, rótulo `text.onBrand` — branco no claro, quase-preto no escuro), `secondary` (borda `border.strong`, fundo transparente), `ghost` (só texto, `text.brand`), `destructive` (preenchido, `bg.danger`).
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

Consequência de produto: **no iOS a cerimônia inteira (cronômetro, prazo duplo, status do parceiro, estado offline) vive dentro do app AceleraLock**, não na tela de bloqueio. A `BlockScreen` do iOS é só a porta.

#### Android — overlay nosso, controle total

Overlay React Native por cima do app-alvo. Aqui a `BlockScreen` é a tela cheia descrita abaixo, com todos os estados:

- **Estados:**
  - `intro` — "Você bloqueou o Instagram." + por quê (frase do próprio usuário, se houver) + primária **"Voltar"** / secundária **"Quero desbloquear"**.
  - `cooldownActive` — `Countdown` (`running`, prazo duplo §2.6) + `PartnerApprovalStatus` + primária "Voltar".
  - `awaitingPartner` — espera de 30 min concluída, aguardando aprovação. `Countdown` mostrando `autoEndsAt` + parceiro `pending`.
  - `readyToUnlock` — condições ok → primária "Desbloquear por [janela]".
  - `unknownOffline` — `Countdown` em `unknown` (caminho principal, §2.3); explica que a validação é no servidor.
- **Regras anti-dark-pattern (as duas plataformas):** a saída sem fricção ("Voltar" / "Fechar") está sempre presente, no mesmo lugar, com o mesmo peso visual da ação de desbloqueio. Nada irreversível sem confirmação. Nenhum texto culpa o usuário. Passo atual e pendência sempre visíveis.

#### O que mantém a identidade única

Mesmo escudo, mesma paleta, mesma voz de texto, mesmos rótulos-verbo, mesmo tom sem-culpa. O usuário reconhece o AceleraLock nas duas — a diferença é só quanta tela o SO nos deixa desenhar.

### 3.5 `UnlockCeremony` (cerimônia de desbloqueio)

- Container: `radius.xl`, `elevation.3`, sobre `bg.scrim`.
- Usa `Stepper` (§3.7): passo 1 espera cronometrada → passo 2 aprovação do parceiro → passo 3 desbloqueado. Sem parceiro pareado, o passo 2 some e o passo 1 usa só `autoEndsAt`.
- `timerHero` no passo 1, com o prazo duplo de §2.6 (um número + uma linha de contexto).
- Cada passo tem: estado do passo (pendente / ativo / concluído / falhou), o que falta, e saída ("Cancelar" — volta ao estado protegido sem punição).
- **Estados globais:** `active`, `offline` (não avança, ver §2.3 — caminho principal, não erro), `partnerDenied` (ver §3.6), `localValveReleased` (ver §3.22), `sessionExpired`.

### 3.6 `PartnerApprovalStatus`

Aprovação **por-pedido de desbloqueio**. Há **um único parceiro por conta** (escolha do usuário) — sem quórum, sem lista.

- Mostra: avatar + nome do parceiro, o que se pede, quando foi pedido.
- **Estados:** `notRequested`, `pending` ("Pedido enviado — aguardando [nome]"), `approved` (verde, "Aprovado por [nome] às 14:40"), `denied` (âmbar, não vermelho — negar é escolha legítima do parceiro; "[nome] não aprovou agora"), `expired` ("O pedido expirou"), `partnerUnreachable` ("Não foi possível avisar [nome]" + "Tentar de novo").
- `denied` não é erro: tom neutro. Oferece "Pedir de novo mais tarde" e lembra que a liberação automática de 48 h (§2.6) segue de pé de qualquer forma.
- Sem parceiro pareado ainda: este componente não aparece; a cerimônia usa só `autoEndsAt`. Parear é feito via `PartnerInvite` (§3.21).

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

- Variantes: `info` (azul), `warning` (âmbar), `error` (vermelho), `success` (verde).
- Ícone + texto + ação opcional. Fundo `*.Subtle`.
- Usado para: offline, parceiro negou, sessão expirada. **Nunca toast para informação crítica que exige ação.**

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

- Confirmação bloqueante ("Remover [parceiro]?"). Título + corpo + no máximo 2 ações.
- Ação destrutiva à direita, em `destructive`; cancelar à esquerda.
- `accessibilityViewIsModal`, foco preso, primeiro foco no título.

### 3.15 `EmptyState`

- Ícone/ilustração + título + 1 frase + CTA opcional.
- Para: nenhum app bloqueado ainda, nenhum parceiro adicionado, sem histórico.
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
- **`TabBar`:** 3–4 destinos, ícone + rótulo, na base. Tab bar iOS / navigation bar Android. Item ativo em `icon.brand` + rótulo `bodyStrong`.

### 3.21 `PartnerInvite` (pareamento do parceiro — assíncrono)

O parceiro é **obrigatório no onboarding** e o aceite depende de outra pessoa abrir o app dela. Entre enviar o convite e ele ser aceito pode passar **horas** — esse intervalo precisa de UI própria, não de um spinner.

- **Estados:**
  - `none` — sem convite. CTA "Convidar parceiro" (compartilha link / código).
  - `pending` — convite enviado, aguardando aceite. Mostra para quem foi (nome/contato), quando, e um "Reenviar" / "Cancelar convite". Copy: "Convite enviado para [nome]. Você pode continuar usando o AceleraLock — o parceiro entra em ação no próximo desbloqueio." Não bloqueia o resto do app.
  - `accepted` — pareado. Vira `PartnerApprovalStatus` daqui pra frente.
  - `declined` — recusado. Tom neutro, CTA "Convidar outra pessoa".
  - `expired` — convite caducou. CTA "Enviar de novo".
- Enquanto `pending`, a cerimônia de desbloqueio funciona só com `autoEndsAt` (48 h) e diz o porquê.
- `accessibilityLiveRegion="polite"` quando o estado muda para `accepted`/`declined` com o app aberto.

### 3.22 `LocalValveNotice` (válvula local de 7 dias)

Estado **visível**, nunca silencioso, para a liberação automática por falta de servidor (§2.7).

- **Estados:**
  - `hidden` — servidor acessível nas últimas 24 h (nada a mostrar).
  - `counting` — sem servidor há ≥ 1 dia. `InlineAlert` `warning`: "Sem conexão com o servidor há N dias. Após 7 dias, seus bloqueios são liberados automaticamente." Atualiza a cada dia.
  - `released` — passou de 7 dias, bloqueios liberados pela válvula. `InlineAlert` `info` persistente: "Seus bloqueios foram liberados porque o app ficou 7 dias sem servidor. Eles voltam assim que a conexão for restabelecida." Não é falha do usuário — tom neutro.
- Aparece no topo da tela principal e dentro da `UnlockCeremony`/`BlockScreen` (Android).

### 3.23 Estados obrigatórios por tela

Toda tela declara: `loading`, `empty`, `error`, `success`/conteúdo. Tela sem estado vazio é tela incompleta. Toda ação assíncrona dá feedback visual em < 100 ms (mesmo que seja só o botão em `loading`).

---

## 4. Acessibilidade — decisões explícitas

- **Contraste:** WCAG 2.1 AA. 4.5:1 texto normal, 3:1 texto grande (≥ 24 pt, ou ≥ 18.66 pt bold) e elementos de interface / gráficos. Tabela de pares verificados em §1.2 — **todos os pares de texto do sistema passam em AA para corpo**, incluindo o botão primário no tema escuro (rótulo quase-preto sobre `brand.400`, ~5.3:1).
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

Fechadas nesta rodada (registradas no corpo): cooldown não pausa/reseta (§2.1) · `BlockScreen` são dois designs (§3.4) · um parceiro por conta (§3.6) · sem desbloqueio offline (§2.3) · dois bypasses: válvula 48 h (§2.6) e válvula local 7 dias (§2.7/§3.22) · parceiro obrigatório com pareamento assíncrono (§3.21) · contraste do botão primário escuro (§1.2) · prazos são config de servidor, layout não crava dígitos (§2.1) · push é só aviso, estado vem sempre do sync (§2.1).

Parqueadas (só se respondem com código nativo na mão; `dev` está no backend):

- **Campos exatos do `ShieldConfiguration` (iOS)** — lista real de campos, se aceita mais de um botão, se reconfigura em background. O design da §3.4 assume o pior caso (estático, campos mínimos) até haver resposta.
- **Overlay do Android (`SYSTEM_ALERT_WINDOW`)** — confiabilidade em OEMs restritivos; pode exigir plano B para a `BlockScreen` Android. `qa` já catalogou no grupo C da matriz de burla — ler antes de assumir que o overlay sempre sobe.

Ainda abertas (produto):

1. **Gamificação / streak** — existe recompensa para o polo "orgulho" (sequência, conquistas) ou só calma neutra? Define se `ProtectedCard` ganha componentes de progresso.
2. **Fonte custom** — ficamos em fonte de sistema. Se a marca (quando existir) pedir fonte própria, a escala de §1.3 é reaproveitável, mas entrelinhas precisam de reteste.
3. **Escopo de localização** — só pt-BR ou também en? Afeta folga de layout e teste de fonte ampliada.
4. **Versões mínimas de OS** (iOS / Android) — afeta APIs disponíveis (Family Controls, `SYSTEM_ALERT_WINDOW`, `accessibilityLanguage`).
5. **Alinhar registro emocional do onboarding com `mobile`** — o tom da primeira sessão precisa casar com o polo "calma e orgulho", e o onboarding agora inclui o `PartnerInvite`.
