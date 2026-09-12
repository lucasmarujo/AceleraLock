# `.claude/` — configuração de agente do AceleraLock

O CI do projeto é bom, mas até aqui o único gate era o GitHub Actions: o vermelho só
aparecia **depois** do push. Esta pasta antecipa isso para o fim de cada tarefa.

```
.claude/
  settings.json              hooks + permissões (versionado)
  hooks/ci-local.mjs         o CI local — quatro modos, um arquivo
  hooks/ci-local.d.mts       tipos das funções puras, só para o tsc
  commands/verificar.md      /verificar
  commands/contar-testes.md  /contar-testes
  agents/revisor-armadilhas.md  subagente de revisão, sob demanda
  .estado-ci.json            estado entre hooks (gitignored)
```

## O ciclo

| Momento | Hook | O que faz |
| --- | --- | --- |
| Antes de `Edit`/`Write` | `--guarda-arquivo` | Nega edição em `android/`, `ios/` e `.expo/` **da raiz** — são geradas por prebuild e a edição some na próxima |
| Após `Edit`/`Write` | `--pos-edicao` | `prettier --write` só no arquivo tocado e marca qual suíte ele obriga a rodar |
| Ao parar (`Stop`) | `--stop` | Roda o que ficou pendente. Verde: segue. Vermelho: **exit 2** com o erro, e o Claude corrige |
| Antes de `Bash` | `--guarda-git` | Nega `git commit` / `git push` enquanto houver edição não verificada ou o último ciclo estiver vermelho |

O escopo é **condicional ao que foi tocado**: mexeu em `src/` roda o bloco JS
(`format:check` → `lint` → `typecheck` → `test`, separados e na mesma ordem do
`ci.yml`); mexeu em `core/**.kt` roda também `:core:test`. Sessão que só leu código não
paga nada.

O que **não** dispara ciclo, de propósito: `native/.../android/**` e
`native/.../ios/**` (não têm suíte), `android/` e `ios/` da raiz (gerados por prebuild),
`docs/`, `assets/` e prosa em geral.

Teto de **3 tentativas** vermelhas: depois disso o hook libera a parada com um aviso em
vez de girar em loop.

## Toolchain

O ramo Kotlin resolve sozinho o que esta máquina não tem no PATH: procura o `gradle` em
`~/.gradle/wrapper/dists/` (maior versão vence) e aponta `JAVA_HOME` para um JDK 17
Adoptium, que é o `jvmToolchain(17)` do `core` e o mesmo do CI. **Se não achar gradle,
avisa e segue** — não trava a sessão por falta de ferramenta.

## Comandos

- **`/verificar`** — força o ciclo inteiro (JS + Kotlin), ignorando o que está pendente.
- **`/contar-testes`** — conta as duas suítes lendo o XML do JUnit. O `core` roda com
  `testLogging { events("failed") }`, então build verde não imprime contagem — é por isso
  que os números nos docs vivem defasados.

## Proteção das pastas geradas

Editar `android/` ou `ios/` da raiz é a armadilha nº 3 do `AGENTS.md`: são geradas por
`expo prebuild` e a edição some na próxima. Até aqui isso era sustentado só por
documentação.

A regra vive no `--guarda-arquivo`, e não na lista declarativa do harness, por um motivo
concreto: este repositório tem **duas** pastas `android/` com donos opostos — a da raiz é
artefato descartável, e `native/modules/aceleralock-blocker/android/` é fonte do módulo
nativo, que precisa continuar editável. Um padrão de caminho sobre `android/` casa as
duas. Distinguir exige comparar o caminho relativo à raiz do repositório, o que só dá para
fazer em código — e está coberto por `tests/hookCiLocal.test.ts`.

## Desligar

- Um hook específico: remova o bloco dele de `settings.json`.
- Tudo, sem tocar no que está versionado: crie `.claude/settings.local.json` (gitignored)
  com `{ "hooks": {} }`.
- Ver o que está ativo: `/hooks`.

## Testes

As duas funções não-triviais do hook (`classificarCaminho` e `ehComandoDeEntrega`) são
cobertas por `tests/hookCiLocal.test.ts`, no mesmo padrão do resto do projeto — ou seja,
o próprio `npm test` verifica o hook que roda o `npm test`.
