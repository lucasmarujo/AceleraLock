#!/usr/bin/env bash
#
# Blue-green de uma cor so por vez, num VPS so.
#
# O proxy NAO decide saude de cor nenhuma: ele aponta para onde upstream.caddy
# mandar. Quem decide e este script. Nenhum `sleep` decide coisa alguma aqui —
# ele so existe como intervalo entre sondagens; o que decide e o estado do
# healthcheck e o resultado do smoke.
#
# Codigos de saida:
#   0  cor nova no ar e verificada
#   1  deploy falhou (nunca trocou, ou trocou e voltou sozinho)
#   3  o rollback tambem falhou — intervencao humana necessaria
#
set -euo pipefail

IMAGE_REF="${1:?uso: deploy.sh ghcr.io/<owner>/aceleralock-backend:<sha>}"

ROOT=/srv/aceleralock
UPSTREAM="$ROOT/caddy/upstream.caddy"
APP_COMPOSE="$ROOT/infra/docker-compose.app.yml"
BACKUP_DIR="$ROOT/backups"

HEALTH_TIMEOUT_SECONDS=180
HEALTH_POLL_SECONDS=3
SMOKE_ATTEMPTS=3
SMOKE_POLL_SECONDS=2
DUMP_TIMEOUT_SECONDS=120
CURL_TIMEOUT_SECONDS=10

EXIT_DEPLOY_FAILED=1
EXIT_ROLLBACK_FAILED=3

# Gancho de teste: abre uma janela entre o `caddy reload` e o smoke para o QA
# conseguir matar o script exatamente nesse instante (cenario 4e). Em producao
# vale 0 e nao muda nada.
SMOKE_DELAY_SECONDS="${SMOKE_DELAY_SECONDS:-0}"

set -a
# shellcheck disable=SC1091
. "$ROOT/.env"
set +a
: "${SITE_DOMAIN:?SITE_DOMAIN ausente em $ROOT/.env}"
BASE_URL="https://$SITE_DOMAIN"

SWITCHED=0
FINISHED=0

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

current_color() { grep -o 'app-[a-z]\+' "$UPSTREAM" | head -1; }

other_color() { [ "$1" = "app-blue" ] && echo app-green || echo app-blue; }

container_of() { echo "aceleralock-${1#app-}"; }

compose() { IMAGE="$IMAGE_REF" docker compose -f "$APP_COMPOSE" "$@"; }

wait_healthy() {
    local container deadline status
    container="$(container_of "$1")"
    deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))
    while [ "$(date +%s)" -lt "$deadline" ]; do
        status="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo ausente)"
        case "$status" in
            healthy) log "$container healthy"; return 0 ;;
            unhealthy) log "$container unhealthy"; return 1 ;;
        esac
        sleep "$HEALTH_POLL_SECONDS"
    done
    log "$container nao ficou healthy em ${HEALTH_TIMEOUT_SECONDS}s"
    return 1
}

# Duas asserticoes, ambas sem credencial nenhuma:
#
# 1. GET /v1/time -> 401 COM o header de tempo do servidor. O ServerTimeFilter roda
#    em HIGHEST_PRECEDENCE e escreve o header antes do chain.doFilter, entao ele sai
#    ate na resposta negada. 401 com header prova que a aplicacao respondeu; 401 sem
#    header significa que quem respondeu foi o proxy, e isso e falha.
#    (Invariante travada por TokenScopeIntegrationTest.anonymousIsRejectedEverywhere.)
#
# 2. POST /v1/auth/refresh com token aleatorio -> 401, e nao 5xx. O token e aleatorio
#    DE PROPOSITO. NAO troque por um refresh token real: apresentar o mesmo refresh
#    duas vezes e o sinal de reuso que faz o backend revogar a familia inteira
#    (RefreshTokenService.java:88). O smoke passaria a deslogar uma conta a cada
#    deploy — derrubando o bloqueio junto — e ninguem suspeitaria do smoke.
#    Token aleatorio nao existe no banco: nao grava evento de auditoria, e ainda
#    prova conectividade com o Postgres pelo caminho da aplicacao.
smoke_once() {
    local headers status
    headers="$(mktemp)"
    status="$(curl -sS --max-time "$CURL_TIMEOUT_SECONDS" -o /dev/null -D "$headers" \
        -w '%{http_code}' "$BASE_URL/v1/time" || echo 000)"
    if [ "$status" != "401" ]; then
        log "smoke: GET /v1/time devolveu $status, esperado 401"
        rm -f "$headers"
        return 1
    fi
    if ! grep -qi '^x-aceleralock-server-time:' "$headers"; then
        log "smoke: 401 sem X-Aceleralock-Server-Time — quem respondeu nao foi a aplicacao"
        rm -f "$headers"
        return 1
    fi
    rm -f "$headers"

    status="$(curl -sS --max-time "$CURL_TIMEOUT_SECONDS" -o /dev/null -w '%{http_code}' \
        -X POST "$BASE_URL/v1/auth/refresh" \
        -H 'Content-Type: application/json' \
        -d "{\"refreshToken\":\"$(head -c 24 /dev/urandom | base64 | tr -d '/+=')\"}" || echo 000)"
    if [ "$status" != "401" ]; then
        log "smoke: POST /v1/auth/refresh devolveu $status, esperado 401"
        return 1
    fi
    return 0
}

smoke() {
    local attempt
    for attempt in $(seq 1 "$SMOKE_ATTEMPTS"); do
        if smoke_once; then
            log "smoke ok na tentativa $attempt"
            return 0
        fi
        sleep "$SMOKE_POLL_SECONDS"
    done
    return 1
}

point_proxy_to() {
    echo "reverse_proxy $1:8080" > "$UPSTREAM"
    docker exec aceleralock-caddy caddy reload --config /etc/caddy/Caddyfile
    log "proxy apontado para $1"
}

backup_database() {
    mkdir -p "$BACKUP_DIR"
    local destino="$BACKUP_DIR/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).dump"
    if timeout "$DUMP_TIMEOUT_SECONDS" docker exec aceleralock-postgres \
            pg_dump -U aceleralock -Fc aceleralock > "$destino"; then
        log "backup em $destino"
        return 0
    fi
    rm -f "$destino"
    log "pg_dump estourou ${DUMP_TIMEOUT_SECONDS}s — deploy abortado antes de tocar em qualquer coisa."
    log "Rode o dump a mao fora da janela:"
    log "  docker exec aceleralock-postgres pg_dump -U aceleralock -Fc aceleralock > dump"
    log "Se isso virar rotina, a resposta e migrar para base backup + WAL, NAO apagar o backup."
    return 1
}

rollback_to() {
    local previous="$1"
    log "revertendo para $previous"
    if ! point_proxy_to "$previous"; then
        log "FALHA AO REVERTER: nao consegui recarregar o proxy"
        return 1
    fi
    if ! smoke; then
        log "FALHA AO REVERTER: $previous tambem nao passa no smoke"
        return 1
    fi
    log "revertido para $previous"
    return 0
}

on_exit() {
    local code=$?
    [ "$FINISHED" = "1" ] && exit "$code"
    log "interrompido antes de concluir (codigo $code)"
    if [ "$SWITCHED" = "1" ]; then
        if rollback_to "$CURRENT"; then
            compose stop "$TARGET" || true
            FINISHED=1
            exit "$EXIT_DEPLOY_FAILED"
        fi
        log "AS DUAS CORES FICAM DE PE. Proxy aponta para: $(current_color)"
        FINISHED=1
        exit "$EXIT_ROLLBACK_FAILED"
    fi
    compose stop "$TARGET" || true
    FINISHED=1
    exit "$EXIT_DEPLOY_FAILED"
}

CURRENT="$(current_color)"
TARGET="$(other_color "$CURRENT")"
trap on_exit EXIT
trap 'exit 1' INT TERM

log "no ar: $CURRENT | subindo: $TARGET | imagem: $IMAGE_REF"

backup_database

compose pull "$TARGET"
compose up -d --force-recreate "$TARGET"

if ! wait_healthy "$TARGET"; then
    log "$TARGET nunca ficou saudavel — proxy intocado, $CURRENT segue servindo"
    compose stop "$TARGET" || true
    FINISHED=1
    exit "$EXIT_DEPLOY_FAILED"
fi

point_proxy_to "$TARGET"
SWITCHED=1

sleep "$SMOKE_DELAY_SECONDS"

if ! smoke; then
    log "smoke falhou com $TARGET no ar — revertendo sozinho"
    if rollback_to "$CURRENT"; then
        compose stop "$TARGET" || true
        log "revertido. Saindo != 0 de proposito: deploy que voltou atras nao e deploy verde."
        FINISHED=1
        exit "$EXIT_DEPLOY_FAILED"
    fi
    log "AS DUAS CORES FICAM DE PE para diagnostico. Proxy aponta para: $(current_color)"
    FINISHED=1
    exit "$EXIT_ROLLBACK_FAILED"
fi

log "$TARGET no ar e verificado. $CURRENT fica de pe ate o proximo deploy (e o que torna o rollback barato)."
FINISHED=1
exit 0
