# AceleraLock — infraestrutura

VPS único, Docker, blue-green disparado por GitHub Actions. Sem staging: é
escolha deliberada, e ela tem consequência — **o smoke através do proxy é a
única verificação antes de tráfego real.**

Blue-green aqui protege contra **deploy ruim**, não contra o VPS cair. É uma
máquina só.

---

## Pré-requisitos do host

Ubuntu LTS, Docker Engine com plugin `compose`, e um usuário `deploy` sem sudo,
dono de `/srv/aceleralock`.

### NTP é requisito de correção, não higiene de sysadmin

O `CorrectedClock` do aparelho é imune a manipulação do relógio local **porque**
ancora no `serverTime` que este backend emite, somado a um monotônico. Quem
emite `serverTime` é este host. **VPS com relógio errado envenena silenciosamente
todo aparelho que ancorar contra ele** — as janelas de bloqueio passam a abrir na
hora errada, sem sintoma, sem erro, e sem nada que o cliente possa detectar. O
cliente confia no `serverTime` por construção; é a premissa que sustenta o
mecanismo inteiro.

```bash
timedatectl show -p NTPSynchronized --value    # tem que responder: yes
```

Se responder `no`: `sudo timedatectl set-ntp true` e verifique de novo antes de
qualquer deploy.

Azul e verde compartilham o relógio do kernel, então **não existe deriva entre as
cores**. O risco é o host, um só.

### DNS

O domínio precisa estar resolvendo para o IP do VPS **antes** do primeiro
`docker compose up` do proxy — o Caddy só emite certificado com o DNS no ar.

---

## Provisionamento (uma vez, à mão)

```bash
sudo mkdir -p /srv/aceleralock/{secrets,pgdata,backups,caddy/data,caddy/config}
sudo chown -R deploy:deploy /srv/aceleralock
git clone <repo> /srv/aceleralock/repo
ln -s /srv/aceleralock/repo/infra /srv/aceleralock/infra
cp /srv/aceleralock/infra/Caddyfile /srv/aceleralock/infra/upstream.caddy /srv/aceleralock/caddy/
docker network create aceleralock
```

`/srv/aceleralock/.env`, com permissão `600`:

```
DB_PASSWORD=<senha forte>
DB_USERNAME=aceleralock
POSTGRES_PASSWORD=<a mesma senha>
APPLE_AUDIENCE=<client id iOS>
GOOGLE_AUDIENCE=<client id Android>
SITE_DOMAIN=<dominio>
ACME_EMAIL=<email para o Let's Encrypt>
```

Sobe o que fica fora do ciclo de deploy:

```bash
docker compose -f /srv/aceleralock/infra/docker-compose.db.yml up -d
docker compose -f /srv/aceleralock/infra/docker-compose.proxy.yml up -d
```

O `deploy.sh` nunca referencia esses dois arquivos.

---

## A chave de assinatura

`SecurityConfig.signingKey()` carrega um PEM PKCS#8 e deriva o `kid` do
thumbprint — determinístico, então **azul e verde produzem o mesmo `kid` para o
mesmo arquivo**. É isso que faz um token emitido pelo azul continuar válido no
verde. Sem chave persistida, a troca de cor deslogaria a base inteira, com o
bloqueio caindo junto.

Sem `ACELERALOCK_SIGNING_KEY_PATH` e com `SPRING_PROFILES_ACTIVE=prod`, a
aplicação **falha no boot** em vez de gerar uma chave em silêncio.

Gere a chave você mesmo, no host:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out /srv/aceleralock/secrets/jwt-signing-key.pem
chmod 0400 /srv/aceleralock/secrets/jwt-signing-key.pem
chown deploy:deploy /srv/aceleralock/secrets/jwt-signing-key.pem
```

**Guarde uma cópia fora do VPS.** Chave que só existe na máquina que ela protege
não é backup.

### Não rotacione a chave em produção

Enquanto o cliente não tratar 401, **trocar a chave é incidente, não manutenção**.

`TokenRotator.accessTokenAt` (`app/modules/aceleralock-blocker/core/src/main/kotlin/com/aceleralock/blocker/core/TokenRotator.kt:38-49`)
compara `now` com `accessExpiresAt` e devolve o token em cache. Não existe
nenhum caminho que reaja a código de resposta. Então uma chave nova torna os
tokens inválidos **sem** que estejam expirados: o rotator segue entregando o
mesmo token morto até a expiração natural (15 min), o servidor segue devolvendo
401, e o sync do nativo falha nesse intervalo inteiro, em toda a base ao mesmo
tempo — alimentando o contador de failsafe offline com um deploy nosso.

Isso não é superstição: é o estado atual do cliente. A regra cai quando o app
tratar 401, e não antes.

---

## Deploy

O GitHub Actions chama, em merge para `master`:

```bash
/srv/aceleralock/infra/deploy.sh ghcr.io/<owner>/aceleralock-backend:<sha>
```

Sequência: backup → sobe a cor inativa → espera `healthy` → aponta o proxy →
smoke **através do proxy** → mantém a cor antiga de pé.

**O proxy não decide saúde de cor nenhuma.** O Caddy aponta para onde o
`upstream.caddy` mandar; quem decide é o `deploy.sh`. Cor que apodrece *depois*
do switch fica servindo erro até alguém agir — limitação conhecida de um VPS só.

| Saída | Significado |
|---|---|
| `0` | cor nova no ar e verificada |
| `1` | falhou: ou nunca trocou, ou trocou e **voltou sozinha** |
| `3` | o rollback também falhou — as duas cores ficam de pé, intervenção humana |

Falha antes do switch: a cor nova é parada e o `upstream.caddy` **não é tocado**.
Falha no smoke depois do switch: o rollback dispara **sozinho, sem operador**, e
o script sai `1` mesmo tendo revertido — CI não pinta de verde um deploy que
voltou atrás. Há `trap` no `EXIT`, então runner morto no meio cai no mesmo
caminho.

A cor antiga só é parada no deploy **seguinte**. É isso que torna o rollback uma
troca de linha em vez de um rebuild.

### Remedir o `start_period` no primeiro deploy

O `HEALTHCHECK --start-period=60s` do `backend/Dockerfile` veio de boot medido em
máquina de desenvolvimento (pior de três: 26,2 s). **Um VPS de vCPU compartilhada
boota mais devagar.** Meça no host e ajuste `start-period` e
`HEALTH_TIMEOUT_SECONDS` (`deploy.sh`) se necessário:

```bash
docker logs aceleralock-blue 2>&1 | grep 'Started AceleralockApplication'
```

---

## Migrations: expand primeiro, contract em outro deploy

Azul e verde falam com o **mesmo** Postgres ao mesmo tempo. Toda migration é
aditiva: coluna nova sempre `NULL` ou com `DEFAULT`. Nada de `DROP`, `RENAME`,
`SET NOT NULL` ou mudança de tipo no mesmo deploy do código que usa o campo. O
contract vira uma migration em deploy separado, depois que nenhuma instância da
cor antiga existe mais.

Pergunta a responder antes de escrever qualquer migration: **a cor antiga
continua funcionando com este schema?** Se a resposta não for sim, é contract, e
é outro deploy.

Detalhe do `ddl-auto: validate`: coluna extra não incomoda a cor antiga, mas
coluna `NOT NULL` sem default quebra o INSERT dela na hora.

### O rollback devolve o código e não devolve o schema

A cor nova já rodou o Flyway antes de ficar `healthy`. Voltar o `upstream.caddy`
não desfaz migration nenhuma. **O rollback só é seguro porque toda migration é
expand-only. Uma migration destrutiva torna o rollback impossível** — e o momento
em que você vai querer relaxar essa regra é exatamente o momento em que vai
precisar do rollback.

### `CREATE INDEX CONCURRENTLY` quebra a premissa

No Postgres, DDL é transacional: migration que falha reverte inteira e não deixa
rastro. `CONCURRENTLY` é a exceção — não roda dentro de transação. Se falhar no
meio, o Flyway grava `success = false` no `flyway_schema_history` e **recusa toda
migration seguinte**, inclusive a correção urgente de outra coisa. Sobra também
um índice inválido no banco.

O estrago não é o deploy que falhou; é que o **próximo não sai**. Reconhecer:

```sql
SELECT version, description, success FROM flyway_schema_history WHERE NOT success;
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

Sair de lá, nesta ordem: **derrubar o índice inválido** (`DROP INDEX
CONCURRENTLY <nome>;`), depois **`flyway repair`** para apagar a linha falha do
histórico. Só então tente de novo.

Não há guarda-corpo automático de propósito: `repair` automático esconderia uma
migration quebrada, que é pior do que o pipeline parado. O `deploy.sh` já detecta
o estado — Flyway falhando impede o boot, a cor nunca fica `healthy`, o proxy
não é tocado. O que faltava era saber como sair, e é isso que está escrito aqui.

---

## Backup

Diário via systemd timer, retenção de 14 dias, mais um dump disparado pelo
próprio `deploy.sh` antes de cada switch (teto de 120 s; se estourar, o deploy
**aborta antes de tocar em qualquer coisa** em vez de seguir sem backup).

`/etc/systemd/system/aceleralock-backup.service`:

```ini
[Service]
Type=oneshot
User=deploy
ExecStart=/srv/aceleralock/infra/backup.sh
```

`/etc/systemd/system/aceleralock-backup.timer`:

```ini
[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now aceleralock-backup.timer
```

**Teste o restore mensalmente**, num banco descartável — backup sem restore
testado é fé, não backup:

```bash
docker exec -i aceleralock-postgres createdb -U aceleralock restore_teste
docker exec -i aceleralock-postgres pg_restore -U aceleralock -d restore_teste < backups/<dump>
docker exec -i aceleralock-postgres dropdb -U aceleralock restore_teste
```

Se o dump do deploy começar a estourar os 120 s com frequência, a resposta é
migrar para base backup + WAL — **nunca** apagar a rede de proteção porque ela
ficou lenta.

---

## Segredos

| Segredo | Onde vive | Observação |
|---|---|---|
| Chave de assinatura | `/srv/aceleralock/secrets/jwt-signing-key.pem`, `0400`, montada read-only | Só o **caminho** vira variável de ambiente. O conteúdo nunca — env aparece em `docker inspect` e em dump de crash. |
| Senha do banco | `/srv/aceleralock/.env`, `0600`, via `env_file` | **Aparece em `docker inspect` no host.** Resíduo conhecido e aceito: host e banco são o mesmo trust boundary. |
| `GHCR_TOKEN`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` | GitHub Actions secrets | `docker login --password-stdin`, nenhum `echo` de secret, `known_hosts` fixo. |

O actuator sobe na porta **8081**, publicada só em loopback do host
(`127.0.0.1:18080` para o azul, `127.0.0.1:18081` para o verde). Não é alcançável
pela internet — por isso o `SecurityConfig` não precisa abrir exceção nenhuma
para o health check.

Credencial do Firebase: **não configure ainda.** Não existe bean
`FirebaseMessaging` no backend; `PushDispatcher` degrada para log. Montar o
secret hoje não liga push nenhum.

---

## O que este desenho não cobre

- **Alta disponibilidade.** Uma máquina só.
- **Rotação de chave.** Chave única, sem JWKS. Ver a regra acima.
- **Staging.** Escolha deliberada; o smoke é a única barreira.
- **Métricas e APM.** Só `health` está exposto.
