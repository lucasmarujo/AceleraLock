---
description: Conta os testes das duas suites lendo o XML do JUnit, não o console
allowed-tools: Bash(node .claude/hooks/ci-local.mjs:*)
---

!`node .claude/hooks/ci-local.mjs --contar`

O `core` roda com `testLogging { events("failed") }`, então **build verde não imprime
contagem nenhuma** — é por isso que os números no `README.md` e nos docs de QA vivem
defasados. Os valores acima vêm dos atributos `tests`/`failures`/`errors` do XML do
JUnit e da contagem de `test(` em `tests/*.test.ts`.

Se o usuário pediu para atualizar a documentação, use estes números.
