# AceleraLock — Roteiro executável: infra blue-green (cenários 1, 2, 4, 6, 7 + relógio)

**Versão:** 1.2 — 2026-08-29
**Autor:** QA
**Status:** escrito **contra o plano do `dev`, não contra código** — os arquivos de infra (`infra/deploy.sh`, `infra/README.md`) já existem, comitados pelo `dev`, mas ele **ainda não rodou o próprio smoke** (falta host Linux com `/srv/aceleralock`). Este roteiro segue não executado. Pronto para rodar assim que o `dev` avisar que passou no smoke dele.
**Fonte:** descrição do plano recebida por mensagem do `dev` em 2026-08-29 (cenários 2, 4 e 7), mais o requisito de relógio de host levantado pelo `supervisor` a partir da validação do módulo core Android (`e3b86d8`), mais os dois acréscimos do `supervisor` de 2026-08-29 (cenário 1 como passada independente, cenário 6 do Flyway envenenado), mais a atualização do `dev` de 2026-08-29 (gancho `SMOKE_DELAY_SECONDS`, contrato real do smoke, `SigningKeyTest`, `TokenScopeIntegrationTest`, suíte backend em 85 testes).

Formato por cenário: **pré-condição → passo a passo → o que observar → o que reprova**. Quem executar não precisa ter lido a conversa que originou este documento — só este arquivo.

---

## Glossário do desenho (para não precisar re-derivar)

- **Topologia:** um VPS único, duas cores (azul/verde) como containers Docker. **O proxy (Caddy) não decide saúde de nada** — ele só aponta para onde `upstream.caddy` mandar. Quem decide saúde e troca é o `deploy.sh`.
- **Healthcheck:** `HEALTHCHECK` do container, endpoint `http://localhost:8081/actuator/health/readiness` (porta de management, 8081 — **não** a 8080 da aplicação). Publicada só em loopback do host: `127.0.0.1:18080` (azul), `127.0.0.1:18081` (verde). Não alcançável de fora do VPS.
- **Critério "healthy":** corpo com `"status":"UP"` no *readiness* (que inclui o banco; o *liveness* não).
- **Parâmetros do HEALTHCHECK:** `--interval=5s --timeout=3s --start-period=60s --retries=3`. Durante o `start-period`, sonda que falha não conta para `retries`.
- **Gate do `deploy.sh`:** `docker inspect --format '{{.State.Health.Status}}'` em polling até `healthy`, teto de 180 s.
- **Smoke pós-switch (corrigido pelo `dev` — `GET /v1/time` NÃO é 200):** duas asserções, através do proxy (domínio público): `GET /v1/time` sem autenticação (a rota exige `SCOPE_api`) deve dar **`401` com o header `X-Aceleralock-Server-Time` presente na resposta**; `POST /v1/auth/refresh` com token aleatório deve dar `401`. O caso interessante é `401` **sem** o header — significa que quem respondeu foi o Caddy (proxy caiu para uma resposta genérica), não a aplicação atrás dele. Backend trava essa invariante em `TokenScopeIntegrationTest.anonymousIsRejectedEverywhere`.
- **Gancho de teste no próprio script:** `SMOKE_DELAY_SECONDS` (env var, padrão `0` em produção) insere um `sleep` determinístico só entre `point_proxy_to` (troca do `upstream.caddy` + `caddy reload`) e a chamada de `smoke`, para abrir uma janela de reação sem precisar de firewall. Existe especificamente para o cenário 4e — comentário no script avisa para não remover achando que é sobra.
- **Códigos de saída do `deploy.sh`:** `0` = ok; `1` = falhou antes do switch, ou reverteu sozinho com sucesso; `3` = rollback também falhou (as duas cores ficam de pé).
- **Segredos:** chave de assinatura RSA em `/srv/aceleralock/secrets/jwt-signing-key.pem` (`0400`, dono `deploy`, montada **read-only** nas duas cores); só o **caminho** vai em env (`ACELERALOCK_AUTH_SIGNING_KEY_PATH`), nunca o conteúdo. Senha do banco em `/srv/aceleralock/.env` (`0600`), consumida via `env_file:` — **aparece em `docker inspect` do host, aceito, não é achado**.
- **CI:** `GHCR_TOKEN`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST` como repository secrets; `docker login --password-stdin`; `known_hosts` fixo.

---

## Cenário 1 — token emitido pelo azul continua válido no verde

Esta é a asserção que justifica o plano inteiro: é ela que prova que montar a mesma chave RSA nas duas cores resolveu o bloqueio original (`SecurityConfig.signingKey()` gerando RSA nova a cada boot). O `dev` roda o próprio smoke antes de entregar, mas esta especificamente não fica só com quem escreveu o script — se estiver errada, todo deploy desloga a base inteira e derruba o bloqueio de proteção junto, a pior falha possível para este produto. Passada independente da QA, não delegável ao smoke do autor.

**Pré-condição:** azul ativa e emitindo tokens normalmente. Verde ainda não promovida.

**Passo a passo:**
1. Autenticar (ou usar uma sessão de teste já existente) e obter um token de acesso assinado pela cor azul. Anotar o `kid` do header do JWT.
2. Rodar o deploy normal, promovendo verde (chave RSA montada read-only nas duas cores, conforme cenário 7).
3. Com o proxy já apontando para verde, fazer uma chamada autenticada usando o token emitido por azul (ex.: qualquer rota protegida, ou o próprio `POST /v1/auth/refresh` com o refresh token da sessão).
4. Confirmar que a assinatura é validada com sucesso (não é só "não deu erro de rede" — conferir que a rota reconheceu a identidade do token).

**Ângulo adversarial — não basta funcionar logo depois do deploy:**
5. Reiniciar (`docker restart`) o container da cor verde já promovida.
6. Repetir os passos 3-4 pós-restart: (a) com um token novo, emitido por verde depois do restart; (b) com o token original, emitido por azul antes de tudo (se ainda dentro da validade).
7. Comparar o `kid` emitido por verde antes e depois do restart.

**Observar:** aceitação do token de azul por verde (antes e depois do restart de verde); `kid` de verde antes e depois do restart; `kid` de verde comparado ao `kid` de azul.

**Reprova se:** o token emitido por azul for rejeitado por verde em qualquer momento; o `kid` de verde mudar entre antes e depois do restart (sinal de que a chave não está vindo do PEM em disco de forma estável a cada boot, e sim de algo que sobreviveu em memória por acaso — cache, singleton, etc.); ou o `kid` de verde divergir do de azul em algum ponto.

---

## Cenário 2 — proxy não troca com cor doente

### 2a — gate básico: cor que nunca fica `healthy`

**Pré-condição:** azul ativa e servindo o domínio público. Verde (cor inativa) será subida propositalmente quebrada (ex.: banco errado na `DATABASE_URL`, ou porta de management não respondendo).

**Passo a passo:**
1. Antes de iniciar, anotar mtime + hash (`sha256sum`) de `upstream.caddy`.
2. Iniciar um loop de requisições contínuas pelo domínio público (`GET /v1/time` sem autenticação, a cada ~500 ms) rodando em paralelo, logando código de status **e** presença do header `X-Aceleralock-Server-Time` de cada resposta, com timestamp.
3. Disparar `deploy.sh` apontando para subir a cor verde quebrada.
4. Acompanhar `docker inspect --format '{{.State.Health.Status}}'` do container verde a cada poucos segundos até o script encerrar (sucesso, falha, ou teto de 180 s).
5. Ao script encerrar, parar o loop de requisições.

**Observar:**
- `upstream.caddy`: mtime e hash **idênticos** aos do passo 1, do início ao fim.
- O loop de requisições: toda resposta é `401` **com** o header `X-Aceleralock-Server-Time` presente, do início ao fim — isso prova que quem respondeu sempre foi o azul (a aplicação), nunca uma resposta genérica do Caddy. Não "voltou rápido depois de uma falha", e sim **nenhuma anomalia em nenhum ponto**.
- Código de saída do `deploy.sh`: `1`.
- Container verde: `docker compose stop` (não fica de pé rodando quebrado).
- Log do `deploy.sh` diz claramente que não trocou por falta de `healthy`.

**Reprova se:** `upstream.caddy` mudar de conteúdo ou mtime em algum momento; **qualquer** requisição do loop retornar diferente de `401`, ou `401` **sem** o header `X-Aceleralock-Server-Time` (sinal de resposta vinda do Caddy, não da aplicação), ou timeout/conexão recusada (mesmo uma só medição); ou o `deploy.sh` sair com código `0`.

### 2b — adversarial: cor fica `healthy` e apodrece antes do smoke

Este é o ângulo que o próprio `dev` pediu para atacar — não está coberto por 2a porque o gate de saúde já passou; quem tem que pegar é o smoke do cenário 4. Está aqui como ponte entre os dois cenários.

**Pré-condição:** azul ativa. Verde sobe normal.

**Passo a passo:**
1. Iniciar o loop de requisições pelo domínio, igual a 2a.
2. Disparar `deploy.sh`.
3. Assim que `docker inspect` do container verde reportar `healthy` (monitorar em polling apertado, ex. a cada 200 ms), **imediatamente** derrubar o banco que a cor verde usa (ex. `docker stop` do Postgres, ou bloquear a porta via `iptables` no container/rede da cor verde) — o objetivo é que o banco morra **depois** de `healthy` e **antes** de o smoke (cenário 4) concluir.
4. Deixar o `deploy.sh` seguir até o fim.

**Observar:**
- Se `deploy.sh` já reescreveu `upstream.caddy` para verde antes do banco cair: o smoke pós-switch (`GET /v1/time`, `POST /v1/auth/refresh`) deve **detectar** a falha — com o banco fora, esperado é `5xx`/timeout em vez do `401` normal (ou um `401` sem o header, se o processo caiu e é o Caddy respondendo) — e disparar o rollback automático do cenário 4.
- Resultado esperado no fim: azul voltou a responder, `upstream.caddy` aponta para azul de novo, saída do script conforme 4b (rollback bem-sucedido → ainda assim `exit 1`).

**Reprova se:** o `deploy.sh` terminar com `upstream.caddy` apontando para a cor verde apodrecida (banco fora) e sem disparar rollback — nesse caso o gate de 2 e o smoke de 4 têm um buraco entre eles: uma cor pode ficar `healthy`, ser promovida, e morrer sem que nada reaja.

---

## Cenário 4 — rollback pós-switch

**Gatilho: automático, dentro do próprio `deploy.sh`, sem intervenção humana.** (Isso mudou depois do ajuste do supervisor — não confundir com um rollback manual.)

Sequência esperada: sobe cor inativa → espera `healthy` → reescreve `upstream.caddy` + `caddy reload` → smoke através do proxy (`GET /v1/time` → `401` com header; `POST /v1/auth/refresh` com token aleatório → `401`) → se falhar → rollback automático.

### 4a — smoke falha, rollback dispara e recupera

**Pré-condição:** azul ativa e saudável. Verde vai subir `healthy` (passa no readiness), mas será configurada para falhar no smoke especificamente — por exemplo, uma flag/env que faz `GET /v1/time` ou `POST /v1/auth/refresh` responder `500` (ou omitir o header `X-Aceleralock-Server-Time`) só na cor verde, sem afetar o readiness.

**Passo a passo:**
1. Loop de requisições pelo domínio, igual a 2a.
2. Disparar `deploy.sh`.
3. Deixar seguir até `healthy` → switch → smoke → falha → rollback.

**Observar:**
- `upstream.caddy` troca para verde no momento do switch, e troca **de volta** para azul quando o rollback dispara (mtime/conteúdo mudam duas vezes).
- Durante a janela em que `upstream.caddy` apontou para verde, o loop de requisições pode (e deve) registrar as falhas do smoke em si — isso é esperado, não é o que reprova aqui.
- Depois do rollback: as respostas voltam a ser `401` com o header presente, de forma estável, servidas pelo azul, e o smoke é **revalidado no azul** antes do script terminar.
- Container verde é parado.

**Reprova se:** o script terminar com `upstream.caddy` ainda apontando para verde depois de o smoke ter falhado; ou o azul não for revalidado antes de o script encerrar.

### 4b — código de saída é 1 mesmo com rollback bem-sucedido

**Pré-condição:** mesma de 4a.

**Passo a passo:** repetir 4a, capturando explicitamente `$?` do `deploy.sh`.

**Observar:** código de saída do processo.

**Reprova se:** o código de saída for `0`. Rollback bem-sucedido não pode fazer o CI ficar verde num deploy que voltou atrás — isso é o ponto que "passa despercebido" segundo o próprio `dev`, então merece asserção explícita, não inferência pelo comportamento.

### 4c — schema não volta: migration destrutiva quebra a promessa de expand-only

O rollback do 4a devolve **código**, não devolve **banco**. Isso só é seguro porque a regra do projeto é migration expand-only (aditiva, coluna nullable/com default, nunca `DROP`/`RENAME`/`SET NOT NULL` no mesmo deploy). Este caso testa o que acontece quando essa regra é violada de propósito — é um teste de **documentar o estrago**, não de "passar".

**Pré-condição:** azul ativa com dado real de teste (ex.: uma linha cuja coluna será afetada). Antes de rodar, preparar uma migration Flyway **descartável**, só para este teste, que viola expand-only (ex.: `ALTER TABLE ... DROP COLUMN` ou `SET NOT NULL` numa coluna com linhas nulas). Este arquivo de migration não faz parte do plano de infra — é instrumentação do teste, criada e removida por quem executa o roteiro, não um artefato definitivo do projeto.

**Passo a passo:**
1. Anotar o schema e uma amostra de dados antes.
2. Subir a cor verde com a migration destrutiva incluída.
3. Fazer o smoke falhar por outro motivo independente (ex.: mesmo truque do 4a) para forçar o rollback.
4. Depois do rollback, inspecionar o schema e os dados no Postgres.

**Observar e documentar (não é pass/fail no sentido usual):**
- O schema **fica** com a alteração destrutiva aplicada mesmo após o código voltar para azul (coluna sumida, ou constraint aplicada).
- Se o azul (código antigo) quebra ao rodar contra o schema alterado — registrar exatamente como quebra (erro de coluna inexistente, etc.) e em qual operação.

**O que isso reprova:** nada, no sentido de bug — é o comportamento esperado do desenho ("rollback devolve código, não devolve banco"). O objetivo declarado pelo `dev` é justamente ver o estrago: **se o estrago não aparecer**, é sinal de que a regra de expand-only está sendo vendida como mais crítica do que realmente é, e isso também é para reportar.

### 4d — rollback do rollback: as duas cores caem

**Pré-condição:** verde configurada para falhar o smoke (como 4a) **e** azul também indisponível no momento do rollback (ex.: parar o container azul logo antes de disparar o deploy).

**Passo a passo:**
1. Derrubar (ou impedir de responder) tanto azul quanto verde antes/durante o smoke.
2. Disparar `deploy.sh` (ou deixar o fluxo de 4a chegar ao ponto de tentar restaurar azul).
3. Capturar código de saída e o log.

**Observar:**
- Código de saída: deve ser `3`, **distinto** do `1` de 4b.
- Log deve indicar explicitamente para qual cor o `upstream.caddy` está apontando naquele instante.
- As duas cores continuam de pé (nenhum `docker compose stop` das duas) — para permitir diagnóstico manual.
- Script **não insiste** em tentar de novo sozinho.

**Reprova se:** o código de saída for `1` (confundível com "rollback simples, ok") em vez de `3`; a mensagem de log não disser a cor correta; ou alguma das duas cores for derrubada automaticamente.

### 4e — trap no EXIT: matar o script no instante mais cruel

O `dev` já deixou o gancho pronto no script para este cenário especificamente — não precisa de `iptables`/`tc netem`, e a janela fica determinística em vez de probabilística.

**Pré-condição:** verde saudável, prestes a passar por `caddy reload`.

**Passo a passo:**
1. Rodar `deploy.sh` com `SMOKE_DELAY_SECONDS=30` (ou outro valor confortável) na env:
   ```bash
   SMOKE_DELAY_SECONDS=30 /srv/aceleralock/infra/deploy.sh <imagem>
   ```
   Isso insere um `sleep` de 30 s determinístico exatamente entre o `point_proxy_to` (proxy já apontando para a cor nova) e a chamada de `smoke` — o pior instante do desenho: switch feito, validação ainda não rodou.
2. Monitorar o log até ver a mensagem de `caddy reload` concluído (o script entra na janela do `sleep` logo em seguida).
3. Dentro dos 30 s de janela, enviar `SIGTERM` ao processo do `deploy.sh` (ou `Ctrl-C`, ou matar o processo pai simulando um runner de CI morto).
4. Capturar código de saída e log completo.

**Comportamento esperado, conforme o `dev`:** o `trap` no `EXIT` detecta `SWITCHED=1`, dispara o rollback, para a cor nova, e o script sai com **`1`**. Repetir o mesmo teste com o azul também indisponível nesse instante (combinar com a configuração de 4d) para conferir que, se o rollback também falhar dentro dessa janela, o código de saída é **`3`** com as duas cores de pé — as duas variantes valem a pena testar.

**Observar:**
- `upstream.caddy` termina apontando para uma cor coerente com uma decisão completa: azul, se o rollback rodou; ou (no caso degradado) o log identifica corretamente para qual cor está apontando.
- Código de saída: `1` no caso normal, `3` se o azul também não respondeu nesse instante.
- Nenhum processo `docker` órfão nem lock de deploy preso impedindo a próxima tentativa.

**Reprova se:** depois de matar o script nessa janela, `upstream.caddy` ficar num estado que não corresponde a nenhuma decisão válida do fluxo (ex.: continua apontando pra verde sem verde ter sido validado pelo smoke); o código de saída não for `1` (ou `3` na variante degradada); ou uma tentativa de deploy subsequente travar por lock não liberado. Repetir sempre com `SMOKE_DELAY_SECONDS=0` (ou sem a variável) numa rodada de controle, para confirmar que o valor não muda nada em produção.

### 4f — medir o tempo de recuperação

**Pré-condição:** mesma de 4a.

**Passo a passo:** repetir 4a com o loop de requisições timestampado; identificar o timestamp da primeira falha do smoke e o timestamp da primeira resposta `200` estável do azul pós-rollback.

**Observar:** delta entre os dois timestamps.

**Reprova se:** nada tecnicamente — não é pass/fail, é a métrica que diz se o rollback é rede de proteção (recupera em segundos) ou teatro (leva minutos). Registrar o número no relatório de execução; comparar com o teto de 180 s do gate de 2 para dar contexto.

---

## Cenário 6 — Flyway envenenado por `CREATE INDEX CONCURRENTLY` falho

Interação entre duas decisões já aprovadas separadamente, que ninguém tinha olhado combinadas. No Postgres, DDL é transacional — uma migration que falha normalmente reverte inteira e não deixa rastro, e é por isso que "migration falha" parece um cenário tranquilo à primeira vista. **Menos numa exceção**, e a exceção é exatamente o que a regra de expand-only empurra a usar: migration aditiva numa tabela viva, com as duas cores rodando ao mesmo tempo, mais cedo ou mais tarde precisa de índice — e índice em tabela viva sem travar escrita é `CREATE INDEX CONCURRENTLY`, que **não roda dentro de transação**. Se falhar no meio, o Flyway grava uma linha com `success = false` no `flyway_schema_history` e, a partir daí, **recusa toda migration futura** até alguém rodar `flyway repair` manualmente. Um índice mal formado não derruba um deploy — envenena o pipeline inteiro, e o próximo deploy (que pode ser a correção urgente de outra coisa) não sai.

**Requisito de documentação, não só de teste:** o `supervisor` está levando isso ao `dev` em paralelo como item do `infra/README.md`, antes de virar teste — o roteiro abaixo pressupõe que exista alguma resposta documentada para conferir contra.

**Pré-condição:** ambiente de teste descartável com o schema atual. Preparar uma migration Flyway descartável que dá `CREATE INDEX CONCURRENTLY` num índice **único** sobre uma coluna com valor duplicado de propósito (garante a falha).

**Passo a passo:**
1. Rodar o deploy normal com essa migration incluída na cor que vai subir.
2. Deixar a migration falhar (esperado — é o objetivo).
3. Inspecionar `flyway_schema_history`: confirmar a linha com `success = false`.
4. **Sem nenhuma intervenção manual** (sem rodar `flyway repair` nem tocar o histórico), tentar um segundo deploy limpo — outra migration válida, independente da primeira, simulando "a correção urgente de outra coisa" chegando logo depois.

**Observar:** se o segundo deploy passa normalmente, é recusado pelo Flyway, ou trava esperando alguma ação.

**Reprova se:** o `infra/README.md` (ou runbook equivalente) não tiver um passo documentado para esse estado — quem roda `flyway repair`, com que acesso, em que condição. **O achado é a ausência do runbook, não o comportamento do Flyway** — recusar rodar sobre um histórico sujo é o Flyway fazendo o certo, e não deve ser reportado como bug.

---

## Cenário 7 — segredo não vaza

### 7a — chave privada não aparece em lugar nenhum

**Pré-condição:** deploy normal (azul e verde de pé, ao menos uma troca de cor já ocorrida).

**Passo a passo:** buscar o conteúdo (ou qualquer fragmento reconhecível — cabeçalho PEM, base64 de trechos da chave) da chave privada em:
1. Log do workflow do GitHub Actions (execução completa, não só o resumo).
2. `docker inspect` de ambas as cores (variáveis de ambiente, mounts, labels).
3. `docker history` da imagem de cada cor (camada por camada — é o lugar clássico de segredo assado sem querer).
4. `docker logs` de ambas as cores, cobrindo o boot completo.
5. Saída do `caddy reload`.

**Observar:** presença/ausência de qualquer trecho da chave em cada um dos cinco lugares.

**Reprova se:** **um único match** em qualquer um dos cinco — critério é binário, não "a maior parte está limpa".

### 7b — resíduo aceito, não é achado

**Pré-condição:** mesma de 7a.

**Passo a passo:** conferir que a senha do banco aparece em `docker inspect` do host (via `env_file:`).

**Observar:** presença da senha do banco em `docker inspect`.

**O que fazer com isso:** **registrar como aceito no relatório**, não como achado — é resíduo conhecido, host e banco compartilham o mesmo trust boundary por decisão de arquitetura. Reportar como achado novo aqui seria ruído.

### 7c — adversarial: `kid` idêntico entre as cores

Não é um teste de vazamento — é o oposto: verificar que o segredo está **igualmente** disponível nas duas cores, porque se não estiver, o blue-green não cumpre o que existe para resolver.

**Pré-condição:** azul e verde de pé simultaneamente.

**Passo a passo:**
1. Confirmar (via mount/hash do arquivo dentro de cada container, sem extrair o conteúdo) que `/srv/aceleralock/secrets/jwt-signing-key.pem` é o **mesmo arquivo** (mesmo hash) montado nas duas cores.
2. Obter o `kid` que cada cor está usando para assinar (ex.: endpoint JWKS público, ou campo `kid` de um token recém-emitido por cada cor) e comparar.

**Observar:** hash do arquivo de chave e `kid` emitido, azul vs. verde.

**Reprova se:** o hash do arquivo divergir entre as cores, **ou** o `kid` divergir — mesmo que a chave em si não tenha vazado. Se divergir: um token emitido pelo azul não valida no verde, e a base inteira desloga no switch. Esse é o bloqueio de origem que motivou o plano — se ele reaparecer aqui, é o achado mais importante do roteiro inteiro.

**Nota:** o backend já tem `SigningKeyTest.sameFileYieldsSameKeyOnBothColors`, provando por unidade que dois carregamentos do mesmo PEM dão o mesmo `kid` e o mesmo módulo. Isso **não substitui** este passo — o teste unitário prova a função de carregar a chave; 7c prova o *mount* real nas duas cores do ambiente (é o Cenário 1 que prova a consequência ponta a ponta, com token de verdade).

---

## Cenário QA-1 — cor com relógio deslocado (achado do `supervisor`, elevado a requisito)

`CorrectedClock` (módulo core, `app/modules/aceleralock-blocker/core/`) ancora a hora do device em `serverTime` vindo do backend + `elapsedMillis` monotônico do próprio device — e por construção **confia** em `serverTime`. Se o container que serve essa hora estiver com o clock deslocado, todo device que ancorar contra ele é corrompido silenciosamente, sem sintoma no cliente até a janela de bloqueio abrir na hora errada. Como as duas cores rodam no mesmo VPS e compartilham o relógio do kernel do host, o risco real é o **host**, não uma cor divergindo da outra — deriva *entre* cores não existe por construção.

**Mecanismo (revisado com o `dev`):** nada de `libfaketime`/`LD_PRELOAD` dentro do container — a imagem final é `eclipse-temurin:21-jre-alpine` com só o jar, e instalar ferramenta de manipulação de tempo nela (mesmo numa imagem derivada) é superfície desnecessária para um cenário que não precisa disso. Como o risco real é o host, não a cor, reproduzir deslocando o relógio de uma **VM descartável inteira** (não o VPS de produção) reproduz o risco melhor do que isolar por processo.

**Pré-condição:** VM Linux descartável, não o VPS de produção, com uma cor subida normalmente.

**Passo a passo:**
1. Deslocar o relógio do sistema da VM inteira (`date -s` / `timedatectl set-time`, com o serviço de NTP desativado para não ele se auto-corrigir) em algo grande e inequívoco (ex.: +6 h) para não confundir com jitter de rede.
2. Fazer uma requisição normal de sync/autenticação contra essa cor.
3. Ler o header `X-Aceleralock-Server-Time` da resposta.

**Observar:**
- Se o valor do header refletir a hora deslocada (não a hora real) sem nenhum campo de alerta, flag, ou log de anomalia no lado do servidor.
- Se existir *qualquer* sinal de defesa: comparação contra NTP, alarme, rejeição da resposta, etc.

**Reprova se (isto é, o que documentar como achado):** o backend serve `X-Aceleralock-Server-Time` deslocado **sem nenhum sinal**. Importante: isso **não** é uma falha do roteiro nem um "teste que não rodou direito" — "não há defesa" é o resultado válido e esperado de se documentar, exatamente como o `supervisor` registrou: NTP no host é pré-requisito de correção do produto, e este cenário é a forma de verificar que, se o host falhar, nada no software pega o erro.

---

## Perguntas em aberto antes de rodar de verdade

Ambas as pendências da v1.1 foram resolvidas pelo `dev` em 2026-08-29:

1. ~~4e (trap/kill no instante certo): mecânica de atraso via firewall.~~ **Resolvido:** `SMOKE_DELAY_SECONDS` é um gancho no próprio `deploy.sh`, feito para este cenário. Ver 4e.
2. ~~QA-1 (relógio por processo): `libfaketime` na imagem.~~ **Resolvido:** nem `libfaketime`, nem imagem derivada — deslocar o relógio de uma VM descartável inteira, já que o risco real é o host e as cores não divergem entre si. Ver Cenário QA-1.

Nenhuma pendência de mecânica restante. Falta só o `dev` confirmar que rodou o próprio smoke ponta a ponta (aguardando host Linux com `/srv/aceleralock`) para esta QA rodar a passada adversarial.
