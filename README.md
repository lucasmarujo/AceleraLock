# AceleraLock

App React Native (Expo) que ajuda o usuário a trancar os apps que tiram o tempo
dele. **Roda 100% no aparelho do usuário.** Não há backend, não há cadastro,
não há autenticação, não há nuvem, não há parceiro, não há servidor.

---

## Leia isto antes de qualquer coisa

Duas restrições explicam quase todas as decisões estranhas deste repositório. Sem
elas, o código parece rigor gratuito.

**1. No iOS o identificador do app nunca sai do aparelho.** O Family Controls
devolve `ApplicationToken`, e o `bundleIdentifier` é `nil` por design para tudo
que vem do `FamilyActivityPicker`. Não é escolha de modelagem: a plataforma não
deixa. É por isso que o alvo de bloqueio é uma referência opaca, e não um nome
de pacote.

**2. Sem servidor, o relógio do aparelho é do dono do aparelho.** Quem quer
burlar adianta a hora. Por isso **toda defesa de tempo aqui é monotônica** —
espera e concessão contam `elapsedRealtime`, nunca hora de parede, e não existe
"instante de fim" para comparar em lugar nenhum do caminho de decisão.

### O teto: desinstalar derrota tudo

Este produto é **fricção, não prisão**, e a diferença é deliberada.

- **Desinstalar** o app sempre está disponível e apaga a configuração.
- **Force-stop** pelas Configurações é ainda mais barato: dois toques, e o app
  entra no *stopped state*, onde o Android não entrega mais broadcast nenhum —
  nem `BOOT_COMPLETED`. A proteção fica desligada atravessando reboot, até a
  pessoa abrir o app de novo.

Não há defesa contra isso sem Device Admin, que foi **vetado**: app que impede a
própria remoção cai em *Deceptive Behavior* do Google Play e, pior, vira malware
aos olhos de quem instalou.

A resposta do produto é **medir e mostrar**, não impedir. Quem usa isto é alguém
que pediu ajuda contra o próprio impulso, não um invasor de quem o app se
defende — e para essa pessoa um lapso invisível é o que faz a ferramenta falhar
em silêncio.

**Se você for abrir uma issue propondo impedir a desinstalação, leia
`docs/decisoes.md` antes.** A resposta já está lá, com o porquê.

---

## Rodar

```bash
npm install
npm run typecheck
npm test               # 24 testes JS puros, sem emulador
npm run android        # precisa de development build; Expo Go não serve
```

Expo Go não roda foreground service nem overlay — o app exige `prebuild` e
development build.

### Testes do core Kotlin

O `core/` é Kotlin puro, sem dependência de Android, e roda em JVM. **Ele não
tem `gradlew` próprio**, e o `gradle` não costuma estar no PATH. O caminho que
funciona hoje é a distribuição que o wrapper do Gradle já baixou:

```bash
cd native/modules/aceleralock-blocker
JAVA_HOME="<caminho do JDK 21>" \
  "$HOME/.gradle/wrapper/dists/gradle-<versão>-bin/*/gradle-<versão>/bin/gradle" \
  :core:test --console=plain
```

O `build.gradle.kts` do core usa `testLogging { events("failed") }`, então
**build verde não imprime contagem nenhuma**. Para saber quantos testes rodaram,
leia `core/build/test-results/test/*.xml` — não confie no console.

---

## Estrutura

```
app/                       Rotas (expo-router).
src/
  components/              Componentes React compartilhados.
  native/                  Ponte TS fina sobre o módulo nativo Android.
  state/                   Estado local, sem store global.
  theme/                   Tokens e tema (claro/escuro).
native/
  modules/aceleralock-blocker/
    core/                  Kotlin puro, testado em JVM. É onde mora a regra:
                           decisão de bloqueio, espera, concessão, leitura da
                           política, registro de interrupção.
    android/               Adaptadores Android: serviço de poll, detecção de
                           app em primeiro plano, overlay, ponte Expo.
  plugins/                 Config plugin que liga o core ao prebuild.
assets/brand/              Mark do escudo (SVG + VectorDrawable Android).
docs/                      Produto, design system, decisões e QA.
backend.bkp/               Histórico: backend Spring Boot e infra Docker/blue-
                           green da arquitetura com servidor. Não roda.
```

A separação `core/` × `android/` não é cerimônia: o `core` não importa nada de
Android, então a regra tem teste de verdade em JVM. O que está em `android/` é
adaptador, e **não tem teste** — por isso o mínimo possível de decisão mora lá.

---

## O veredito decide a tela raiz

`src/state/verdict.ts` resolve em cinco valores: `loading`,
`onboarding-incompleto`, `pausado`, `protegido` e `plataforma-nao-suportada`.
`app/_layout.tsx` mapeia cada um num grupo de rotas.

Vale entender por que são cinco e não três: **cada valor existe porque
representar aquela situação com um valor vizinho produzia uma mentira.** iOS não
é "permissão pendente", é recurso inexistente. `loading` não é
"onboarding-incompleto". `pausado` é quem desligou de propósito, e não quem teve
o serviço morto pelo sistema.

---

## As decisões contraintuitivas

Todas com o porquê em [`docs/decisoes.md`](docs/decisoes.md). As que mais
confundem quem chega:

- **Desbloquear exige esperar**, em tempo monotônico acumulado. Impulso dura
  segundos; a espera derrota o impulso, não a pessoa.
- **Um pedido por vez.** Esperas em paralelo fariam a fricção custar trinta
  minutos uma vez, e não uma vez por decisão.
- **Desligar a proteção passa pela mesma espera**, e mudar a duração da espera
  também. Fricção com porta dos fundos é encenação.
- **Cancelar é livre.** Desistir de desbloquear é o resultado desejado; cancelar
  caro empurraria a pessoa a esperar por teimosia.
- **A concessão não é uma lista, é um saldo que só diminui.** Concessão
  encerrada é apagada, não arquivada — guardada, cada liberação já obtida
  viraria uma chave permanente.
- **Reboot encerra a concessão e preserva a espera.** As políticas são opostas
  pelo mesmo critério conservador.
- **A fonte única da lista de bloqueados é o nativo.** O serviço decide com o
  app fechado, e o `AsyncStorage` é inalcançável sem JS rodando.

A ponte TS fica em `src/native/blocker.ts` e o módulo em
`native/modules/aceleralock-blocker/`. As assinaturas mudam; leia os arquivos em
vez de confiar numa lista aqui — foi exatamente essa lista que apodreceu na
versão anterior deste README.

---

## O que não funciona ainda

**Nada disto jamais rodou num Android.** Todo o verde deste repositório é regra
testada em JVM; a integração é território não pisado. A camada `android/` nunca
compilou uma vez sequer — a primeira `expo prebuild` será a primeira vez que
esse código existe de verdade.

Além disso:

- **iOS não tem módulo nativo.** A decisão registrada é adaptar
  `react-native-device-activity`; hoje o app trata iOS como plataforma não
  suportada.
- **O entitlement da Apple para Family Controls não foi solicitado.**
- **Não existe tela de seleção de apps.** `setBlockedPackages` funciona no
  nativo; falta quem a chame.
- **Sobrevivência do serviço em fabricante agressivo não foi medida.** Há
  watchdog e receiver de boot, e nenhum deles foi visto funcionando.
- **`performance.now()` no Hermes** não foi verificado em aparelho.

O inventário completo, com o porquê de cada um, está no fim de
[`docs/decisoes.md`](docs/decisoes.md).

---

## Contribuindo

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`,
  `chore:`, `build:`, `ci:`), com escopo quando ajudar.
- **Toda implementação vem com teste.** No `core`, JUnit 5 com `@DisplayName`
  descrevendo o cenário em português — categoria e comportamento, não o nome do
  método. No JS, `node:test` puro.
- **Regra em Kotlin puro, adaptador burro.** Se a decisão der para testar em
  JVM, ela pertence ao `core`.
- **Leia `docs/decisoes.md` antes de desfazer algo que pareça estranho.** Boa
  parte do que parece rigor gratuito é consequência das duas restrições do topo.

---

## Licença

MIT — ver [`LICENSE`](LICENSE).
