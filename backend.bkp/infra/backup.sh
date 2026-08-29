#!/usr/bin/env bash
#
# Backup diario, chamado pelo systemd timer (ver infra/README.md).
# Backup sem restore testado e fe, nao backup: o README manda testar o restore
# mensalmente num banco descartavel.
#
set -euo pipefail

ROOT=/srv/aceleralock
BACKUP_DIR="$ROOT/backups"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"
destino="$BACKUP_DIR/diario-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker exec aceleralock-postgres pg_dump -U aceleralock -Fc aceleralock > "$destino"
printf 'backup em %s (%s)\n' "$destino" "$(du -h "$destino" | cut -f1)"

find "$BACKUP_DIR" -name 'diario-*.dump' -mtime "+$RETENTION_DAYS" -delete
