# AceleraLock — backend

Serviço Spring Boot que sustenta conta, dispositivos registrados, perfis de
bloqueio, alvos opacos, vínculo de parceiro, a cerimônia de desbloqueio e a
trilha de auditoria antiviolação.

---

## ⚠️ Bloqueante de produção — chave RSA em memória

`SecurityConfig.signingKey()` **gera um par RSA novo a cada boot**. Em instância
única de desenvolvimento funciona. Em produção não:

- todo `accessToken` emitido vira inválido em qualquer restart;
- com mais de uma instância, um token emitido por A é rejeitado por B.

**Não subir para produção sem chave persistida** (arquivo montado como secret,
KMS, ou vault), carregada em vez de gerada. É o único item conhecido que impede
deploy real. O refresh token não sofre disso — é opaco e vive no banco.

---

## Rodar

Requisitos: **JDK 21+** e **Docker** (só para os testes, que sobem Postgres via
Testcontainers). Maven não precisa ser instalado — o wrapper baixa sozinho.

```bash
./mvnw test                 # 81 testes; precisa de Docker
./mvnw package              # gera target/aceleralock-backend-0.1.0-SNAPSHOT.jar
./mvnw spring-boot:run      # precisa de Postgres em localhost:5432
```

Postgres para desenvolvimento:

```bash
docker run --rm -p 5432:5432 \
  -e POSTGRES_DB=aceleralock \
  -e POSTGRES_USER=aceleralock \
  -e POSTGRES_PASSWORD=aceleralock \
  postgres:17-alpine
```

Sobrescreva com `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. O schema é aplicado
pelo Flyway (`db/migration`); o Hibernate roda em `ddl-auto: validate` e falha
no boot se o schema divergir — de propósito.

Login exige `APPLE_AUDIENCE` / `GOOGLE_AUDIENCE` (os client ids do app). Sem
eles a validação de audience é pulada, o que só é aceitável em desenvolvimento.
Push (FCM) degrada para log quando não há credencial configurada.

### Versão do Java

O `pom.xml` está em `<java.version>21</java.version>`. Nada no código usa
recurso de linguagem acima do baseline anterior (17); a troca é só de
plataforma.

---

## Invariantes que o código sustenta

Quatro decisões atravessam o serviço inteiro. Mexer nelas sem entender quebra o
produto, não só o teste.

1. **O alvo de bloqueio é opaco.** O servidor nunca conhece `bundleId` nem
   `packageName` — no iOS o token da Apple nunca sai do aparelho, por design.
   Um alvo é uma referência escopada ao device com rótulo opcional do usuário.
   `FAIL_ON_UNKNOWN_PROPERTIES` está ligado justamente para que um cliente que
   mande `bundleId` receba **400** em vez de o campo entrar sem ninguém notar.

2. **O tempo é autoritativo no servidor.** `Clock` é um bean injetado; não há
   `Instant.now()` solto no domínio. Nenhum prazo é calculado pelo cliente:
   toda resposta com vencimento leva `(serverTime, ...EndsAt)` no mesmo payload.
   `UnlockRequestService.evaluate(...)` é o **único** ponto que decide estado, e
   é chamado por todo caminho de leitura e escrita — então uma concessão sem o
   servidor é impossível por construção, não por regra escrita.

3. **Perfil é da conta, alvo é do device.** A regra viaja entre aparelhos; a
   seleção de apps não viaja (o token da Apple é do device). Por isso a
   associação vive em `PUT /v1/devices/{id}/profiles/{id}/targets`, e não no
   payload de perfil — assim o snapshot de sync é sempre resolvível pelo device
   que o pediu, por construção e não por filtro defensivo.

4. **Evidência de segurança grava em transação separada.** Revogação de família
   de refresh token e evidência de adulteração do failsafe usam
   `REQUIRES_NEW`, porque o código que as grava lança exceção logo em seguida —
   e na mesma transação a exceção desfaria a própria gravação. Já aconteceu
   duas vezes aqui. **Toda regra que persiste algo e depois lança tem essa
   forma**, e um teste que só confirma a exceção não prova nada: teste o efeito
   seguinte (o token seguinte, o registro seguinte).

---

## Estrutura

Organizado por feature, não por camada. Pacote base `com.aceleralock`.

| Pacote | Responsável por |
|---|---|
| `account` | conta e `sync_version` (relógio lógico do sync); deleção de conta |
| `auth` | Sign in with Apple/Google, emissão de JWT, rotação de refresh token |
| `device` | registro de aparelho, alvos opacos, token de push |
| `profile` | perfis, janelas de bloqueio, trava de redução de cooldown |
| `partner` | convite, aceite, revogação, idade mínima do vínculo |
| `unlock` | a cerimônia: máquina de estados e avaliação preguiçosa |
| `sync` | snapshot completo com ETag |
| `audit` | trilha append-only e reconciliação do failsafe |
| `time` | `TimeAuthority`, filtro de headers de tempo |
| `push` | FCM; o payload nunca carrega decisão nem prazo |
| `config` | segurança, escopos de token, guard de device, propriedades |

Números de negócio (cooldown padrão, válvula unilateral, duração da concessão,
idade mínima do parceiro, `failsafeDays`, limite de devices, limiar de skew)
ficam em `UnlockProperties` e mudam por configuração, sem deploy de código.

---

## Autenticação

Sem senha. Dois escopos de token, e é isso que faz o primeiro login funcionar
sem abrir brecha:

| Token | Emitido por | TTL | Alcança |
|---|---|---|---|
| `device:register` | `POST /v1/auth/sessions` | 5 min | só `POST /v1/devices` |
| `api` | `POST /v1/devices` e `/v1/auth/refresh` | 15 min | todo o resto |

`SecurityConfig` não tem nenhum `permitAll`. As duas rotas fora do JWT não são
anônimas: uma exige `id_token` validado contra o JWKS do provedor, a outra
exige posse de refresh token válido.

Refresh token é opaco, guardado só como hash SHA-256, e rotaciona a cada uso.
Reuso de um token já consumido revoga a **família inteira** — salvo dentro de
30 s quando o sucessor ainda não foi usado, que é a resposta perdida na rede e
não um ataque.

Recurso de outra conta responde **404, nunca 403**: 403 confirmaria que o id
existe.

---

## Cerimônia de desbloqueio

Duas condições, ambas obrigatórias: cooldown decorrido **e** aprovação do
parceiro. Ordem indiferente. A aprovação não é um estado — é o campo
`approved_at`.

```
                  ┌── cancelar (dono, só em PENDING) ──────► CANCELLED
                  │
                  ├── negar (parceiro ACTIVE) ─────────────► DENIED
   PENDING ───────┤
                  ├── approved_at != null
                  │   AND now >= cooldown_ends_at ────────► GRANTED
                  │
                  └── now >= unilateral_ends_at ──────────► GRANTED
                                │                            (unilateral)
                                └── now > grant_ends_at ───► CONSUMED
```

**Não existe estado sem saída.** Parceiro que some, bloqueia contato, perde o
celular ou é revogado: em 48 h o pedido se resolve sozinho. A fricção continua
de pé porque o caminho unilateral é 96× mais lento que os 30 min do caminho
aprovado — e quando ele dispara, o parceiro é notificado.

Revogar o parceiro **não** libera pedido pendente: se liberasse, revogar seria
o botão de burlar.

Reduzir o cooldown de um perfil só passa a valer depois de decorrido o cooldown
vigente (`pending_cooldown_minutes` + `cooldown_effective_at`); aumentar vale na
hora. Sem essa assimetria, "edita para 1 minuto e pede de novo" seria o atalho.

---

## Testes

81 testes: unitários com `Clock.fixed` para a lógica de tempo, integração com
Testcontainers contra Postgres 17 real. Sem H2 — ele mente sobre `timestamptz`,
sobre constraint e sobre índice parcial, e o produto depende dos três.

```bash
./mvnw test -Dtest='UnlockRequestStateMachineTest'   # máquina de estados, rápido
./mvnw test -Dtest='*IntegrationTest'                # precisa de Docker
```

O container do Postgres é singleton do JVM (iniciado em bloco estático, sem
`@Testcontainers`): a anotação para o container ao fim de cada classe, e a
segunda classe encontraria a conexão recusada.

Testes que existem por causa de um bug real encontrado, e que devem continuar
existindo: reuso de refresh token revoga a família **e o token seguinte para de
valer**; evidência de adulteração sobrevive ao rollback da transação externa
(com um teste de controle mostrando que um evento comum *não* sobrevive);
sync do device B não devolve alvo do device A; nenhuma resposta contém
`bundleId`/`packageName`.

---

## Contrato

Prefixo `/v1`. Campo novo é aditivo dentro dele; quebra de contrato abre `/v2`
e mantém `/v1` no ar — o app é instalado, não recarregado.

Toda resposta, **304 inclusive**, carrega `X-Aceleralock-Server-Time` e
`X-Aceleralock-Clock-Skew-Seconds`. O device manda `X-Aceleralock-Device-Time`;
divergência acima de 60 s vira evento na trilha, não erro — é evidência.

```
POST   /v1/auth/sessions · /v1/auth/refresh · DELETE /v1/auth/sessions
POST   /v1/devices · DELETE /v1/devices/{id} · PUT /v1/devices/{id}/push-token
GET    /v1/time
GET|POST /v1/profiles · PUT|DELETE /v1/profiles/{id}
PUT    /v1/devices/{d}/profiles/{p}/targets
POST   /v1/devices/{d}/targets · DELETE /v1/devices/{d}/targets/{t}
GET    /v1/devices/{d}/sync                    (ETag = syncVersion)
POST   /v1/devices/{d}/events                  (lote, idempotente)
POST   /v1/partners/invites · POST /v1/partners/invites/{code}/accept
GET    /v1/partners · DELETE /v1/partners/{linkId}
GET    /v1/partners/unlock-requests
POST   /v1/devices/{d}/unlock-requests
GET|DELETE /v1/unlock-requests/{id}
POST   /v1/unlock-requests/{id}/approve · /deny
DELETE /v1/accounts/me
```

`activeGrants` no payload de sync é a **única** autorização de desbloqueio que
existe: lista vazia significa bloquear. O enforcement não tem outra fonte.
