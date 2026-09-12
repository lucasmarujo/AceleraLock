# CLAUDE.md — AceleraLock

As convenções, comandos, armadilhas e fronteiras deste repositório estão no
`AGENTS.md`, importado abaixo. Este arquivo guarda **só o que não está lá ou está
lá desatualizado** — duas fontes repetindo o mesmo conteúdo divergem em seis meses.

@AGENTS.md

---

## Sincronias sem lint que as alcance

Três pares de arquivos precisam mudar **na mesma passada**. Nenhum deles quebra o CI
quando dessincroniza — é revisão humana ou nada.

**1. Regra do `core/` ↔ espelho Swift.** `native/modules/aceleralock-blocker/ios/Core/*.swift`
é uma reimplementação manual do `core/` Kotlin (`BlockDecider`, `WaitingPeriod`, `GrantWindow`,
`PolicyReader`, `ScreenTime*`) e **não tem um único teste**. O `core/` tem 81. Mudou regra de
um lado, espelhe no outro — divergência ali atravessa o CI inteiro em silêncio.

**2. Cor de marca.** `src/theme/tokens.ts` é a fonte da verdade, e a mudança propaga para
**quatro** outros lugares, não um:

| Arquivo | O que carrega |
| --- | --- |
| `native/.../android/src/main/res/values/colors.xml` | cópia manual, tema claro |
| `native/.../android/src/main/res/values-night/colors.xml` | cópia manual, tema escuro |
| `src/theme/navigationTheme.ts` | três hex literais (`#F6F7F8`, `#04141c`, `#03c3bf`) |
| `app.json` | splash (claro e escuro) e adaptive icon |

Mudou cor, revalide contraste e cubra em `tests/tokens.test.ts`.

**3. Método novo no módulo nativo.** São **cinco** arquivos, não três:
`src/AceleralockBlocker.types.ts` → `index.ts` → `src/native/blocker.ts` →
`AceleralockBlockerModule.kt` → `AceleralockBlockerModule.swift`.

## Correções ao que a documentação afirma

- **`docs/decisoes.md` diz que o lint bloqueia hex literal fora de `tokens.ts`. Não bloqueia.**
  `eslint.config.js` é `eslint-config-expo/flat` puro, sem nenhuma regra de cor. É convenção
  sustentada por revisão — e `src/theme/navigationTheme.ts` já a viola hoje, com justificativa
  no próprio arquivo.
- **Contagens de teste nos docs estão defasadas.** `README.md` diz 141; o real é 96 JS + 81
  Kotlin. Use `/contar-testes` antes de escrever qualquer número — build verde do `core` não
  imprime contagem (`testLogging { events("failed") }`).

## Toolchain desta máquina

- **`gradle` não está no PATH.** A distribuição utilizável é a que o wrapper já baixou, em
  `~/.gradle/wrapper/dists/gradle-9.3.1-bin/*/gradle-9.3.1/bin/gradle.bat`.
- **JDK 17** (`C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot`) — bate com o
  `jvmToolchain(17)` do `core` e com o Temurin 17 do CI. O `JAVA_HOME` do ambiente aponta
  para o JBR do Android Studio; não confie nele.
- O hook em `.claude/hooks/ci-local.mjs` resolve os dois sozinho. Se precisar rodar à mão,
  `/verificar` faz o ciclo inteiro.

## O CI roda sozinho ao fim da tarefa

`.claude/hooks/ci-local.mjs` roda no `Stop` o mesmo conjunto que o GitHub Actions, limitado
ao que a sessão tocou, e devolve o erro para você corrigir enquanto estiver vermelho.
`git commit` e `git push` ficam bloqueados até fechar.

**Não rode `npm run verify` à mão "por precaução" no fim de cada tarefa** — é trabalho pago
duas vezes. Use `/verificar` quando quiser forçar o ciclo completo antes da hora.

Detalhes e como desligar: `.claude/README.md`.
