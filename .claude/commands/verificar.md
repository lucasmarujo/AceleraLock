---
description: Roda o CI local inteiro (JS + core Kotlin) e corrige o que estiver vermelho
allowed-tools: Bash(node .claude/hooks/ci-local.mjs:*), Read, Edit, Grep, Glob
---

Resultado do ciclo completo — os mesmos passos que `.github/workflows/ci.yml` roda:

!`node .claude/hooks/ci-local.mjs --verificar`

Se o resultado acima for **VERDE**, apenas confirme em uma linha e pare.

Se for **VERMELHO**, corrija a causa e rode `/verificar` de novo até fechar. Regras:

- Corrija a **causa**, não o sintoma. Teste que falhou por regra nova errada não se
  conserta mexendo no teste.
- `formatacao` é o único passo com correção automática segura: `npm run format`.
- Antes de mexer em regra de negócio, confira se o comportamento esperado está em
  `docs/decisoes.md` — o teste provavelmente está certo e a implementação errada.
