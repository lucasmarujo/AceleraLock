# AGENTS.md — AceleraLock

Guia operacional para agentes de código que entram neste repositório. O objetivo
é manter **a coerência com o que já está aqui**, não reescrever o projeto.

A fonte única da verdade sobre o *porquê* de cada decisão é
[`docs/decisoes.md`](docs/decisoes.md). Este arquivo descreve o *como* — as
convenções, comandos, armadilhas e fronteiras que tornam o trabalho de qualquer
agente previsível.

> Idioma: PT-BR. Identificadores em código seguem o idioma já existente no
> arquivo (ver `src/state/verdict.ts` com `protegido` / `pausado` e
> `core/src/main/kotlin/.../WaitingPeriod.kt` com `WaitTarget.StopProtection`).

---

## 1. TL;DR para um agente que acabou de chegar

- **O que é:** app de bloqueio de apps Android, 100% no aparelho, sem servidor.
  RN 0.86 + Expo SDK 57 + Expo Router + TS 6 para a UI; **Kotlin/JVM puro no
  `core/`** para a regra de negócio.
- **Regra de ouro:** decisão testável em JVM mora em `core/`. O que toca o
  Android é adaptador burro, e **não tem teste automatizado** — por isso o
  mínimo possível de decisão mora lá.
- **Antes de abrir PR:** `npm run verify` verde. É o mesmo conjunto que o CI
  roda (`format:check` + `lint` + `typecheck` + `test`).
- **Leia primeiro, nesta ordem:**
  1. [`README.md`](README.md) — arquitetura, restrições, comandos.
  2. [`docs/decisoes.md`](docs/decisoes.md) — o porquê de cada escolha.
  3. [`docs/design-system.md`](docs/design-system.md) — tokens e componentes.
  4. [`docs/decisao-modulos-nativos.md`](docs/decisao-modulos-nativos.md) — o
     desenho do módulo nativo.

---

## 2. Arquitetura — a fronteira que importa

Três camadas. A fronteira **`core/` × `android/` × `src/`** é a única decisão
estrutural que não pode ser quebrada sem motivo forte.

```
src/                              React Native · TypeScript
  components/                     UI compartilhada (com lógica pura testável)
    <Componente>/<logicaPura>.ts  Regras separadas do hook/JSX → testáveis
    <Componente>/<Componente>.tsx JSX, consome a lógica pura
    <Componente>/use<Hook>.ts     Hooks: leitura do nativo + estado React
  state/                          Veredito, storage de onboarding, listas
  theme/                          Tokens (claro/escuro), contextos de tema
  native/blocker.ts               Ponte tipada fina sobre o módulo nativo

native/modules/aceleralock-blocker/
  core/                           Kotlin/JVM PURO, testado em JUnit 5
    BlockDecider · WaitingPeriod · GrantWindow · BlockPolicy/PolicyReader
    ProtectionLog · ScreenTime* (Events · Sessions · Buckets · History)
  android/                        Adaptadores: Service, Detector, Overlay,
                                  ScreenTimeCollector, AceleralockBlockerModule
  src/AceleralockBlocker.types.ts Contratos TS consumidos pelo app
  index.ts                        requireNativeModule('AceleralockBlocker')
  plugins/withAceleralockBlocker.js Config plugin (CNG) do prebuild
```

**Testes só rodam onde a regra tem teste:** o `core/` é JUnit 5 puro em JVM; a
UI é `node:test` puro, sem RN renderer. A camada `android/` não tem teste de
unidade — restrição assumida do projeto, não descuido.

---

## 3. Comandos — a única forma de validar trabalho

```bash
npm run verify          # Tudo de uma vez: format + lint + typecheck + test
npm run format:check    # Só Prettier (CI roda como passo separado)
npm run lint            # Só ESLint
npm run typecheck       # Só tsc --noEmit
npm test                # Só testes JS (node --test --import tsx)
npm run test:kotlin     # Testes do core (precisa de `gradle` no PATH ou usar
                        # o wrapper baixado, ver README §Testes)
npm run android         # Development build — exige JDK 17 + Android SDK
npm run prebuild        # Regenera android/ (gitignored) via CNG
```

> **O CI roda cada passo separado** (`.github/workflows/ci.yml`). Não encadeie
> localmente num script só — o primeiro erro esconde os outros três na lista do
> GitHub.

---

## 4. Convenções de código — TS/React Native

### 4.1 Estrutura de pastas

- Cada componente em `src/components/<Nome>/` tem o arquivo do componente
  (`<Nome>.tsx`) e, quando tem regra de negócio, o arquivo de lógica pura
  (`<nome>.ts`) ao lado. **Lógica pura nunca importa `react-native`** — é o
  que a torna testável por `node --test`.
- Hooks ficam em `use<Nome>.ts` no mesmo diretório do componente.
- Alias `@/*` → `src/*` (ver `tsconfig.json`). Use nos imports de UI.

### 4.2 Separação obrigatória: lógica pura × componente × hook

Padrão observado em `src/components/Countdown/`, `src/state/verdict.ts` e
`src/components/Onboarding/`:

```ts
// countdownStatus.ts — regra pura, zero import nativo
export type CountdownStatus = ...;
export function deriveCountdownStatus(remainingMs: number): CountdownStatus { ... }

// useCountdown.ts — hook: leitura do nativo + interpolação + lifecycle
export function useCountdown(readRemainingMs: RemainingMsReader) { ... }

// Countdown.tsx — só JSX, consome o hook e desenha a partir do snapshot
```

Quando for adicionar regra nova: comece pelo `<logica>.ts`. O teste vem junto.
Só depois pluga no hook, e por último no componente.

### 4.3 Estilo e formatação

- Prettier manda (`.prettierrc`): `singleQuote`, `printWidth: 100`, `tabWidth: 2`,
  `semi: true`, `trailingComma: 'es5'`, `arrowParens: 'always'`, `endOfLine: auto`.
- ESLint só cuida do que o Prettier **não cobre** (`eslint-config-expo`). Não
  adicione regras de estilo no `eslint.config.js` — é a guerra de duas
  ferramentas pelo mesmo arquivo.
- Prettier **ignora `*.md`** de propósito (`.prettierignore`): prosa escrita à
  mão tem diff enorme sem ganho de leitura.
- Sem comentários óbvios. Quando um comentário for o *porquê* (e não o
  *o quê*), fica no topo do trecho relevante — em PT-BR, com vocabulário do
  produto.

### 4.4 TypeScript

- `strict: true`. Sem `any` implícito, sem retorno implícito.
- Tipos compartilhados com o nativo ficam em
  `native/modules/aceleralock-blocker/src/AceleralockBlocker.types.ts` e são
  reexportados por `src/native/blocker.ts` — **não duplique** esses tipos.
- A ponte é fina: `src/native/blocker.ts` apenas tipa o `requireNativeModule`
  e reexporta os tipos públicos. Sem lógica, sem transformação.
- Os métodos do módulo que existem pra documentar que lança (ex.: `stop()`)
  têm tipo de retorno `never` no contrato, não `void` — preserve.

### 4.5 Estado e navegação

- O veredito é resolvido em **cinco valores** (`src/state/verdict.ts`):
  `loading`, `plataforma-nao-suportada`, `onboarding-incompleto`, `pausado`,
  `protegido`. **São cinco, não três, de propósito** — cada um existe para
  não contar mentira.
- `app/_layout.tsx` mapeia cada valor num grupo de rotas via `Stack.Protected`.
  Não reintroduza gating manual nas telas.
- Rotas são agrupadas por veredito em `app/(veredito)/...`. Não mova arquivo
  entre grupos sem atualizar o `Stack.Protected` correspondente.
- O estado ativo (`protectionActive`) é **flag persistida nativa**, não
  "serviço está no ar" — serviço morto por OOM não é pausa do usuário.

### 4.6 Tema e tokens

- Toda cor vem de `src/theme/tokens.ts`. Sem hex solto em componente.
- `surfaces.*` é sempre o trio `{ fill, onFill, pressedFill }` juntos —
  nome que promete par sem tipo que imponha o par é convenção com cara de
  garantia.
- A regra dos temas é do **sistema**, não coincidência:
  - `surfaces.brand` inverte `fill`/`onFill` entre claro e escuro.
  - Texto de marca (`textBrand`) e o `borderBrand` usam o turquesa adaptado
    a cada lado pra fechar WCAG.
- Mudança de marca em `tokens.ts` exige tocar `colors.xml` do módulo nativo
  **na mesma passada** — não há lint que alcance isso (ver README §Marca).

### 4.7 Acessibilidade

- Rótulo visual **pode** mudar a cada tick; rótulo de leitor de tela **não**:
  use `roundToAnnouncementBucket` (15s) antes de chamar
  `formatRemainingForScreenReader` (ver `countdownStatus.ts`).
- Botão: `accessibilityRole="button"` + `accessibilityState={{ disabled, busy }}`
  + `hitSlop` mínimo de 4 — padrão já implementado em `Button.tsx`. Reuse.
- `useReducedMotion` é respeitado onde houver animação (ver
  `OnboardingFlow.tsx`). Animação nova precisa lidar com isso.

---

## 5. Convenções de código — Kotlin (módulo nativo)

### 5.1 Onde mora cada coisa

- **`core/` é Kotlin/JVM puro.** Não importa `android.*`. Não importa
  `SharedPreferences` direto — quem quer persistência recebe `KeyValueStore`,
  e o relógio recebe `MonotonicClock` / `WallClock`. Isso é o que permite
  testar a regra em JVM.
- **`android/` é adaptador.** Pode importar `android.*` e tem permissão de
  fazer I/O, lifecycle, broadcast. **Não tem teste automatizado** — decisões
  de produto que exijam teste moram no `core/`.
- A interface com o JS é em `AceleralockBlockerModule.kt`. Toda função
  exposta no módulo precisa ter o tipo correspondente em
  `src/AceleralockBlocker.types.ts` e ser reexportada por `index.ts` e
  `src/native/blocker.ts`.

### 5.2 Estilo

- `jvmToolchain(17)`. Não subir sem motivo.
- Sem dependência nova no `core/`. O `build.gradle.kts` é deliberadamente
  magro (`kotlin("test")` + JUnit Jupiter 5.11.4). Estado atual é
  intencional, não limitação.
- `testLogging { events("failed") }` está configurado de propósito — **build
  verde não imprime contagem**. Para contar testes, leia
  `core/build/test-results/test/*.xml`, não o console.

### 5.3 Padrão dos testes

- JUnit 5 com `@Test` + `@DisplayName` em **português**, descrevendo o
  cenário, não o nome do método. Categorias observadas:
  - `feliz: <comportamento>`
  - `barreira <N>: <garantia>` — referência à barreira de burla que o teste
    sustenta (ver `docs/qa/matriz-cenarios-burla.md`).
  - `regressao: <sintoma>` — quando o teste existe pra evitar retorno de bug.
- Dobra de teste vive em `core/src/test/.../TestDoubles.kt`:
  `FakeMonotonicClock`, `InMemoryStore`, `FakeWallClock`. **Não** mock de
  framework Android — esse é o ponto.
- `FakeMonotonicClock.reboot()` zera o relógio (boot de verdade zera
  `elapsedRealtime`). Use pra cobrir cenários de reboot explicitamente.

### 5.4 Tempo — a regra que não pode quebrar

A regra do produto (ver `docs/decisoes.md` e comentários no `core/`):

> Toda defesa de tempo é **monotônica**. Esperas e concessões contam
> `elapsedRealtime`. **Não existe instante de fim** para comparar em lugar
> nenhum do caminho de decisão.

Consequências operacionais:

- Não introduza `System.currentTimeMillis()` / `LocalDateTime.now()` em lógica
  que decide espera, concessão ou bloqueios.
- **Exceção única, decidida pelo usuário:** o horário livre por app
  (`ScheduleExceptions`) lê a hora local — e só vale com hora **e** fuso
  automáticos e com o modo restrito desligado. Não estenda isso a espera ou
  concessão. Ver `docs/decisoes.md`, "Horários livres por app".
- `WaitingPeriod`: deltas monotônicos somados e persistidos. Reboot
  **congela** a espera (conservador: espera demora mais, nunca menos).
- `GrantWindow`: saldo que só diminui. Reboot **encerra** a concessão.
  Reciclagem de processo **desconta** o tempo fora do ar (foi uso legítimo).
- "Criação do serviço" **não é sinônimo de boot** — o cursor persistido é o
  que distingue as duas sem ambiguidade. Preserve essa distinção.
- Tela de bloqueio não pode vazar contexto de um alvo pra outro — use
  `WaitingPeriod.pendingUnlockFor(packageName)`, não `pending()` cru.

---

## 6. Padrão de testes — JS

- Runner: `node --test --import tsx` (ver `package.json` script `test`).
- Imports: `import { test } from 'node:test'`, `import assert from 'node:assert/strict'`.
- Descrições de teste em **português**, descrevendo o cenário:
  `'feliz: alvo fora da lista nao e bloqueado'`,
  `'barreira 2: app critico nunca recebe overlay'`,
  `'regressao: concessao de outro pacote nao afeta decisao de outro alvo'`.
- Cobertura mínima esperada: feliz + barreiras de burla + regressões
  conhecidas. A matriz completa está em
  [`docs/qa/matriz-cenarios-burla.md`](docs/qa/matriz-cenarios-burla.md).
- Não mock de RN renderer. Se a lógica precisar de hook, extraia para
  função pura primeiro (padrão `countdownStatus.ts` × `useCountdown.ts`).
- Arquivos de teste ficam em `tests/*.test.ts`, espelhando o caminho em
  `src/`. Não espalhe teste dentro de `src/`.

---

## 7. Regras de PR

- **Conventional Commits** em PT-BR quando fizer sentido no subject
  (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `build:`, `ci:`).
  Use escopo quando ajudar (`feat(countdown): ...`). `BREAKING CHANGE:` no
  rodapé quando o contrato quebrar.
- Toda implementação vem com teste. Sem exceção.
- Mudança em regra de produto (espera, concessão, veredito, overlay) →
  atualize a entrada correspondente em `docs/decisoes.md`. Decisão sem
  motivo vira decisão que alguém desfaz em seis meses.
- Mudança em cor/contraste/tema → revalide WCAG e cubra com teste em
  `tests/tokens.test.ts`.
- Mudança em token de animação → mantenha os valores em
  `src/theme/tokens.ts` alinhados com `docs/design-system.md §1.7`.
- Não altere `package.json` / `package-lock.json` sem motivo versionado. O
  `.npmrc` existe pra carregar `legacy-peer-deps` necessário.
- Não toque `android/` diretamente — é gerado por `expo prebuild` via
  config plugin (`native/plugins/`). Customização nativa **vive no plugin**.

---

## 8. Armadilhas reais — não caia nestas

1. **`Date.now()` em qualquer caminho de tempo.** Quebra a regra monotônica
   do produto.
2. **Adicionar biblioteca de UI.** `StyleSheet` do RN resolve o inventário
   inteiro (ver `docs/decisoes.md` §Design system).
3. **Mexer em `android/` à mão.** Vai pro prebuild e some.
4. **Tentar impedir a desinstalação / usar Device Admin.**
   Foi vetado: app que impede a própria remoção cai em *Deceptive Behavior*
   do Google Play e vira malware aos olhos de quem instalou. A resposta do
   produto é **medir e mostrar**, não impedir. AccessibilityService existe
   **só** no `SiteAccessibilityService`, para ler a barra de endereço de
   navegadores listados — não estenda o uso dele para detectar app ou
   impedir qualquer coisa. `docs/decisoes.md` tem a resposta completa.
5. **Salvar concessão encerrada** ("pra histórico"). Cada liberação já obtida
   viraria chave permanente resgatável com relógio favorável.
6. **Permitir esperas em paralelo.** A fricção custaria trinta minutos uma
   vez, não uma vez por decisão. Um pedido por vez, de propósito.
7. **Tratar `null` de medição como `0`**. Dia sem leitura de tempo de tela é
   `null`; `0` é "não usou o celular". Mostrar os dois iguais é mentira.
8. **Adicionar um método novo no módulo nativo sem tipo em
   `AceleralockBlocker.types.ts`**, sem entrada em `index.ts` e sem reexport
   em `src/native/blocker.ts`. Os três andam juntos.
9. **Reduzir espera sem cumprir a espera vigente.** Aumentar vale na hora;
   reduzir esperaria — sem essa assimetria, "edita pra 1min e pede de novo"
   é o atalho que anula a fricção.
10. **Testar a camada `android/` emulador.** A premissa do projeto é testar
    regra em JVM (`core/`) e o mínimo de decisão no `android/`. Emulador não
    é caminho.
11. **Confiar no log do CI para contar testes Kotlin.** Build verde não
    imprime contagem — leia `core/build/test-results/test/*.xml`.
12. **"Consertar" o encerramento da concessão no boot.** Reabriria o flanco
    "desligar o aparelho pra preservar o saldo" — indistinguível de reboot
    legítimo.

---

## 9. Estado atual — onde mexer não cai em terreno não pisado

Itens onde a integração nunca rodou num aparelho de verdade:

| Item | Estado |
| --- | --- |
| Regra de bloqueio, espera e concessão (`core/`) | ✅ testada em JVM |
| Agregação de tempo de tela (`core/`) | ✅ testada em JVM |
| Onboarding, seleção de apps, telas | ✅ implementados |
| CI | ✅ verde |
| Camada `android/` compilando | ✅ compila (`./android/gradlew :aceleralock-blocker:compileDebugKotlin`) |
| **Sobrevivência do serviço em fabricante agressivo** | ⚠️ **não medida** |
| **Force-stop verificado em aparelho** | ⚠️ **não medido** |
| `performance.now()` no Hermes | ⚠️ não verificado em aparelho |
| Build do APK no CI | ⚠️ desativado (sem assinatura) |
| iOS | ⚠️ implementado (Swift + Family Controls), **sem teste e fora do CI** |
| Bloqueio de sites: regra (`SiteMatcher`, `core/`) | ✅ testada em JVM |
| **Bloqueio de sites: view ids da barra de endereço e filtro web do iOS** | ⚠️ **não validados em aparelho** |

Antes de mexer na camada `android/`: leia
[`docs/qa/roteiro-validacao-aparelho.md`](docs/qa/roteiro-validacao-aparelho.md).

---

## 10. Mapa rápido: "onde fica X?"

| Procurando | Onde |
| --- | --- |
| Veredito da tela raiz | `src/state/verdict.ts` + `src/state/useProtectionVerdict.ts` |
| Mapeamento veredito → rotas | `app/_layout.tsx` |
| Tokens de cor/espaço/typography | `src/theme/tokens.ts` |
| Tema do React Navigation | `src/theme/navigationTheme.ts` |
| Preferência claro/escuro | `src/theme/ThemePreferenceContext.tsx` + `preferenciaTema.ts` |
| Ponte fina pro módulo nativo | `src/native/blocker.ts` |
| Tipos do contrato nativo | `native/modules/aceleralock-blocker/src/AceleralockBlocker.types.ts` |
| Regra de bloqueio | `core/.../BlockDecider.kt` |
| Espera e concessão | `core/.../WaitingPeriod.kt`, `core/.../GrantWindow.kt` |
| Política persistida | `core/.../BlockPolicy.kt`, `core/.../PolicyReader.kt` |
| Agregação de tempo de tela | `core/.../ScreenTime*.kt` |
| Adapter de overlay/foreground/service | `android/.../BlockerService.kt`, `OverlayPresenter.kt`, `ForegroundAppDetector.kt` |
| Config plugin (CNG) | `native/plugins/withAceleralockBlocker.js` |
| Marca/ícones | `assets/icon-square-1024.png` (lojas), `assets/icon-1024.png` (app), `assets/android/adaptive/` |
| Porquê de cada decisão | `docs/decisoes.md` |
| Cenários de burla | `docs/qa/matriz-cenarios-burla.md` |
| Roteiro de validação em aparelho | `docs/qa/roteiro-validacao-aparelho.md` |
| Histórico Spring Boot (não roda) | `backend.bkp/` |

---

## 11. Quando parar e perguntar

Pergunte antes de mexer quando:

- A mudança propaga regra nova pra fora do `core/` (UI *e* `android/`). O
  lugar natural dela é o `core/`.
- Você está prestes a introduzir abstração nova (factory, interface com uma
  implementação, configuração de valor que nunca muda).
- A "correção" colide com uma barreira de burla em
  `docs/qa/matriz-cenarios-burla.md`. As barreiras estão lá de propósito.
- A mudança envolve tempo e você cogitou `Date.now()` /
  `System.currentTimeMillis()` em caminho de decisão.
- Você está adicionando dependência nova. Provavelmente existe algo no
  projeto que já cobre, ou não precisa.

---

> Lembrete final: o repositório é a fonte da verdade. Antes de "limpar" algo
> que pareça estranho, abra `docs/decisoes.md` — boa parte do que parece
> rigor gratuito é consequência das duas restrições do topo do `README.md`:
> *o identificador do app nunca sai do aparelho* e *o relógio é do dono*.