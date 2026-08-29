# AceleraLock — Cenários executáveis para a suíte do backend (grupos A, F, J)

**Versão:** 1.0 — 2026-08-28
**Autor:** QA
**Base:** [matriz-cenarios-burla.md](./matriz-cenarios-burla.md)

Converte os grupos que o **backend Java de fato consegue segurar** — A (tempo), F (conluio social), J (perda de acesso) — em casos de teste. Os demais grupos vivem no device e só validam com build nativa.

**Nota de contrato:** escrito **antes** do contrato REST; revisado 2026-08-28 contra o modelo aprovado pelo `dev` (sem token de liberação portátil; aprovação por rota que nomeia o pedido; identidade Apple/Google, sem telefone; idade mínima de vínculo de 48 h). Os cenários descrevem o comportamento observável (estado + trilha de eventos + código de resposta), não endpoints nomeados. Quando `dev` publicar a API, mapear cada passo para a rota concreta — e se algum cenário **não couber** no contrato, é sinal de que falta algo no contrato, não de que o cenário está errado. Formato: pré-condição → ação → asserção.

Convenções:
- **Tempo do servidor** = relógio/monotônico do backend, nunca timestamp vindo do cliente.
- **Trilha** = event log auditável do usuário. Eventos adotados pelo `dev`: `UNLOCK_GRANTED_UNILATERALLY` (liberação por decurso de prazo, sem aprovação — nome sem número embutido de propósito, o prazo é configurável), `UNLOCK_APPROVED_BY_PARTNER`, `PROTECTION_INTERRUPTED`. Provisórios (confirmar no contrato): `UNLOCK_REQUESTED`, `UNLOCK_GRANTED_OFFLINE_FAILSAFE`, `PARTNER_CHANGED`, sinalização de vínculo recíproco, `ACCOUNT_DELETION_SCHEDULED`.
- Durações decididas: **30 min** (com aprovação do parceiro), **48 h** (sem aprovação, P7), **7 dias** (failsafe offline, P8).
- **Contador do failsafe (P8)** = tempo offline **acumulado e persistido**: soma de deltas monotônicos em armazenamento seguro. Nem relógio de parede (burlável, G7), nem `elapsedRealtime` puro (zera no reboot, G8). Reboot = checkpoint; zera só quando um sync com o servidor completa.

---

## Grupo A — Manipulação de tempo

### A-S1 — Relógio do cliente adiantado não encurta o cooldown
- **Pré:** usuário com bloqueio ativo; pedido de unlock criado em `T0` (tempo do servidor).
- **Ação:** cliente envia requisições de status com timestamp local `T0 + 48h` já nos primeiros minutos.
- **Asserção:** estado do pedido permanece `PENDING`. Liberação não ocorre antes de `T0 + 48h` medido pelo servidor (ou `T0 + 30min` se houver aprovação). Timestamp do cliente é ignorado / apenas logado.

### A-S2 — Ficar offline não encurta o cooldown
- **Pré:** pedido criado em `T0`; sem aprovação de parceiro.
- **Ação:** cliente não faz nenhuma chamada entre `T0` e `T0 + 47h`; volta a consultar em `T0 + 47h`.
- **Asserção:** pedido ainda `PENDING` em `T0 + 47h`; vira `GRANTED` em `T0 + 48h`, com evento `UNLOCK_GRANTED_UNILATERALLY`. O tempo offline conta a favor do usuário porque o servidor mede pelo próprio relógio — o que se quer provar é que **não** conta *contra* nem exige o cliente presente.

> **Modelo de autorização (contrato aprovado):** não há token de liberação portátil. A autorização de desbloqueio é a **lista de liberações ativas** no payload de sincronização, escopada ao device e **recalculada pelo servidor a cada leitura**. Nada para expirar, roubar ou reapresentar — os três cenários abaixo testam essa lista.

### A-S3 — Liberação vencida some sozinha da lista de sync
- **Pré:** liberação ativa para o app X, com fim previsto em `T1`.
- **Ação:** ler o payload de sync em `T1 - 1min` e em `T1 + 1min`.
- **Asserção:** antes de `T1` a lista contém X; depois de `T1` a lista **não** contém X — sem nenhuma ação do cliente, porque o servidor recalcula a lista em toda leitura. Bloqueio de X volta a valer.

### A-S4 — Liberação nunca aparece no sync de outro device
- **Pré:** usuário com liberação ativa no `deviceId=A`.
- **Ação:** ler o payload de sync do `deviceId=B` da mesma conta (e de outra conta).
- **Asserção:** a liberação de A **não** aparece em B. A lista é sempre computada para o device que faz a leitura; não há artefato transferível.

### A-S5 — Liberação não sobrevive a limpar dados / reinstalar / trocar de device
- **Pré:** liberação ativa; prazo ainda não venceu.
- **Ação:** limpar dados do app / reinstalar / logar em device novo; reler o sync.
- **Asserção:** o servidor **restaura a liberação correta** (com o prazo original, não reiniciado) — ou o bloqueio, se o prazo já venceu no intervalo. O estado é do servidor; o cliente não guarda autorização própria.

### A-S6 — Duração do cooldown é absoluta, imune a fuso
- **Pré:** pedido criado; sem aprovação.
- **Ação:** cliente reporta mudança de timezone durante a espera.
- **Asserção:** liberação ocorre em `T0 + 48h` de duração real, não "às HH:MM locais". Sem antecipação nem atraso.

---

## Grupo F — Conluio social / parceiro de confiança

### F-S1 — Endpoint de aprovação exige o parceiro autenticado
- **Pré:** pedido `PENDING` do usuário U, parceiro P registrado.
- **Ação:** chamar a aprovação (a) sem auth, (b) autenticado como U, (c) autenticado como terceiro qualquer.
- **Asserção:** todos os três → `401/403`. Só P autenticado aprova.

> **Modelo de aprovação (contrato aprovado):** a aprovação é uma chamada autenticada com o **identificador do pedido na própria URL**. Não há nonce nem payload assinado a reusar — a rota nomeia o pedido. O que se testa aqui é **autorização**, não replay.

### F-S2 — Só o parceiro daquele pedido aprova aquele pedido
- **Pré:** pedido `req1` do usuário U, parceiro P; pedido `req2` de outro usuário V, parceiro Q.
- **Ação:** P (autenticado) chama a aprovação de `req2`; P chama a aprovação de um `req1` já resolvido; P chama a aprovação de um id inexistente.
- **Asserção:** aprovar pedido de que não se é o parceiro → `403/404`. Aprovar pedido já resolvido → rejeitado (estado terminal, idempotente). Id inexistente → `404`.

### F-S3 — Reapresentar a mesma chamada de aprovação é idempotente
- **Pré:** P aprova `req1` com sucesso.
- **Ação:** P repete exatamente a mesma chamada.
- **Asserção:** segunda chamada retorna o mesmo estado (`APPROVED`), sem efeito adicional, sem segundo `UNLOCK_APPROVED_BY_PARTNER` na trilha, sem alterar a janela de liberação.

### F-S4 — Parceiro na mesma instalação de aparelho é recusado no aceite *(regra nova nº1)*
- **Pré:** usuário U com `installId=1`.
- **Ação:** a conta convidada para parceiro está na mesma instalação (`installId=1`) e tenta **aceitar** o vínculo.
- **Asserção:** aceite recusado com motivo explícito. O vínculo não se forma.

### F-S5 — Vínculo de parceiro com menos de 48h não encurta o pedido, nem com aprovação *(regra nova nº2 — era o maior furo)*
- **Pré:** vínculo U↔P formado há `V0`. Pedido de desbloqueio criado em `T0 > V0`.
- **Ação:** (a) `T0 - V0 = 10h` → P aprova imediatamente. (b) `T0 - V0 = 50h` → P aprova imediatamente.
- **Asserção:** em (a), a aprovação é registrada mas **não** encurta para 30 min — o pedido só libera às 48h por decurso de prazo (`UNLOCK_GRANTED_UNILATERALLY`). Em (b), a aprovação encurta para 30 min (`UNLOCK_APPROVED_BY_PARTNER`). A fronteira é a **idade do vínculo ≥ 48h**, medida no servidor.

### F-S6 — Troca de parceiro durante cooldown ativo não zera o timer nem é atalho
- **Pré:** pedido `PENDING` há 10 h; parceiro atual P1.
- **Ação:** U troca o parceiro para P2 e pede que P2 aprove.
- **Asserção:** o contador de 48 h **não reinicia** com a troca; P2 é vínculo novo, então cai na regra de F-S5 (48h de idade antes de poder encurtar). Evento `PARTNER_CHANGED` na trilha.

### F-S7 — Vínculo recíproco é sinalizado na trilha, não bloqueado *(regra nova nº3)*
- **Pré:** U é parceiro de P e P é parceiro de U.
- **Ação:** um aprova o pedido do outro.
- **Asserção:** a relação recíproca aparece como sinalização na trilha (auditável pelo próprio usuário e pelo parceiro). A aprovação **não** é bloqueada nem penalizada com espera extra — pode ser um casal legítimo. Só o registro precisa existir.

### F-S8 — Aprovação do parceiro leva a 30 min, não libera na hora
- **Pré:** pedido criado em `T0`; P aprova em `T0 + 5min`.
- **Ação:** consultar estado em `T0 + 6min` e em `T0 + 31min`.
- **Asserção:** em `T0 + 6min` ainda `PENDING` (aprovado, aguardando janela); em `T0 + 31min` → `GRANTED` com `UNLOCK_APPROVED_BY_PARTNER`. Aprovar não anula a fricção mínima. (Pré-requisito: vínculo com ≥ 48h de idade — ver F-S5.)

### F-S9 — Aprovação depois dos 48 h é inócua
- **Pré:** pedido já liberado unilateralmente em `T0 + 48h`.
- **Ação:** P aprova em `T0 + 49h`.
- **Asserção:** sem efeito adicional; sem novo evento de liberação; sem regressão de estado.

---

## Grupo J — Perda real de acesso (P7 / P8)

### J-S1 — Pedido sem resposta do parceiro libera em 48 h
- **Pré:** pedido criado em `T0`; parceiro nunca interage.
- **Ação:** consultar em `T0 + 47h59m` e `T0 + 48h01m`.
- **Asserção:** `PENDING` antes; `GRANTED` depois, com `UNLOCK_GRANTED_UNILATERALLY`. Tolerância de agendamento documentada (ex.: ±1 min).

### J-S2 — Parceiro removido / inexistente ainda libera em 48 h
- **Pré:** pedido criado; parceiro é removido da conta em `T0 + 1h` (ou nunca existiu).
- **Ação:** aguardar 48 h.
- **Asserção:** liberação ocorre normalmente em `T0 + 48h`. Ausência de parceiro nunca produz estado travado.

### J-S3 — Deleção de conta notifica o parceiro antes e destrava o aparelho *(regra nova nº4 — LGPD)*
- **Pré:** usuário com bloqueios ativos e parceiro P vinculado.
- **Ação:** solicitar deleção da conta (obrigação de LGPD).
- **Asserção:** **antes** de o dado ser apagado, P recebe notificação de que a conta será deletada (evento `ACCOUNT_DELETION_SCHEDULED` ou equivalente). Concluída a deleção, o servidor revoga os bloqueios do device — não fica órfão travado. Se o device estiver offline, a revogação chega no próximo contato e o failsafe de 7 dias é a rede. *Não é vetor de burla novo: desinstalar já destravava com o mesmo esforço. O requisito é que não seja silencioso.*

### J-S4 — *(movido para a suíte do `mobile`)* App crítico barrado no seletor nativo
- Não é cenário de backend: o servidor nunca sabe qual app um identificador representa (o id vira opaco antes de sair do device). A regra "discador, SMS, emergência, Ajustes, o próprio AceleraLock e serviços de acessibilidade não podem ser bloqueados" é validação do **seletor nativo**, antes de o identificador virar opaco. Entregue ao `mobile` como requisito de segurança. Ver matriz, linha J6 (reclassificada como validação de device).

### J-S5 — Motivo do pedido com texto longo / emoji / acento
- **Pré:** —
- **Ação:** criar pedido com `reason` de 5000 caracteres contendo emoji, acento e RTL.
- **Asserção:** sem `500`. Servidor valida tamanho (rejeita com `422` **ou** trunca de forma definida); armazena e devolve ao parceiro sem corromper encoding.

### J-S6 — Duplo clique em "pedir liberação" é idempotente
- **Pré:** nenhum pedido ativo.
- **Ação:** disparar dois pedidos de unlock em < 500 ms (mesmo `requestId` de cliente, ou mesma janela).
- **Asserção:** exatamente um pedido `PENDING`; segundo retorna o mesmo recurso; um único timer de 48 h; um único `UNLOCK_REQUESTED` na trilha.

### J-S7 — Failsafe offline: cliente reporta após 7 dias sem servidor
- **Pré:** device sem contato com o servidor por ≥ 7 dias de tempo offline acumulado (comprovado por gap de heartbeat); cliente já se auto-liberou localmente via P8.
- **Ação:** device reconecta e reporta o evento com a duração offline acumulada.
- **Asserção:** servidor grava `UNLOCK_GRANTED_OFFLINE_FAILSAFE`, **notifica o parceiro**, e reconcilia o estado (não re-bloqueia retroativamente o período). Parâmetro `offlineFailsafeDays` foi servido pelo servidor anteriormente e é o valor usado.

### J-S8 — Failsafe offline reivindicado com menos de 7 dias de silêncio é recusado
- **Pré:** gap de heartbeat real de 2 dias.
- **Ação:** cliente (adulterado) reporta `UNLOCK_GRANTED_OFFLINE_FAILSAFE` alegando 7 dias.
- **Asserção:** servidor cruza com o próprio registro de último heartbeat; gap < `offlineFailsafeDays` → evento marcado como suspeito / rejeitado; `PROTECTION_INTERRUPTED` + alerta ao parceiro. Backend nunca aceita a alegação do cliente como verdade — a última prova real de conectividade é a do servidor.

### J-S9 — `offlineFailsafeDays` vem do servidor, não do binário
- **Pré:** cliente com valor cacheado = 7.
- **Ação:** servidor passa a servir outro valor (ex.: mudança operacional para 10); cliente sincroniza.
- **Asserção:** novo valor passa a reger o failsafe no próximo ciclo; nenhuma versão do app precisa ser publicada. Sem sincronização recente, o cliente usa o último valor cacheado (nunca "sem limite").

---

## Modelo de tempo do failsafe — cenários de device (validação nativa, não backend)

Estes dois vivem no cliente nativo (grupo do `mobile`), mas ficam catalogados aqui porque são a contraparte de J-S8 e o que uma implementação ingênua erra. Backend só participa na reconciliação.

### T-S1 — Adiantar o relógio +7 dias **não** dispara o failsafe (= G7 da matriz)
- **Pré:** device sem rede; bloqueio ativo; contador offline em ~1 dia.
- **Ação:** adiantar o relógio do sistema em +7 dias; observar por alguns minutos reais.
- **Asserção:** failsafe **não** dispara. O contador soma deltas monotônicos e ignora o salto do relógio de parede. Ao reconectar, backend não recebe nenhum `UNLOCK_GRANTED_OFFLINE_FAILSAFE` prematuro (cruzamento de J-S8).

### T-S2 — Reiniciar o aparelho no meio da janela **não** zera o contador (= G8 da matriz)
- **Pré:** device sem rede; bloqueio ativo.
- **Ação:** manter offline por 7 dias reais, reiniciando o aparelho a cada 1–2 dias (padrão de quem reinicia o celular ~1x/semana). Não tocar no relógio.
- **Asserção:** cada reboot é tratado como checkpoint — o tempo offline acumulado persiste em armazenamento seguro e continua somando após o boot. Aos 7 dias acumulados reais, o failsafe dispara. **Falha esperada da implementação ingênua** (`elapsedRealtime` puro): o contador reinicia a cada boot e o failsafe nunca chega. Ao reconectar, backend registra o `UNLOCK_GRANTED_OFFLINE_FAILSAFE` e o concilia com seu gap de heartbeat (~7 dias), aceitando-o (contraste com J-S8, onde o gap era curto).

---

## Cobertura que falta e depende do contrato

- Nomes finais dos eventos provisórios listados no topo.
- Como o servidor identifica "mesma instalação" para F-S4 (`installId`? attestation do device?) e por quanto tempo esse dado é retido.
- Idade do vínculo (F-S5): o servidor mede a partir do convite, do aceite, ou do primeiro sync com o vínculo ativo? Fixar o marco.
- Política de rate limit dos endpoints de pedido/aprovação (relacionado a J-S6 e H8 da matriz).
- Semântica de reconciliação do estado quando device volta de um gap longo (J-S7): quem ganha, cliente ou servidor, e em quais campos.
- Janela entre `ACCOUNT_DELETION_SCHEDULED` e o apagamento efetivo (J-S3): existe período de carência? O parceiro pode ver antes de sumir.
