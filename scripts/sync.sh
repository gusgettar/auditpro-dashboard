#!/bin/bash
# =============================================================================
#  sync.sh — Exporta la BD del POS y sincroniza con Vercel Blob
#
#  USAGE:
#    bash sync.sh
#
#  CONFIGURACIÓN (variables de entorno o .env.local):
#    MDB_SOURCE          — Ruta al db.mdb en la PC del POS (ej: /Volumes/POS/db.mdb)
#                          Si no está seteado, usa el MDB_LOCAL existente
#    MDB_LOCAL           — Copia local del MDB (default: ~/Downloads/db.mdb)
#    BLOB_READ_WRITE_TOKEN — Token de Vercel Blob (de Vercel Dashboard → Storage → Blob)
#    PRODUCTION_URL      — URL del deploy en Vercel (ej: https://tu-app.vercel.app)
#    SYNC_SECRET         — Secret para autenticar el endpoint /api/reload
#
#  INSTALAR CRON (cada 15 minutos):
#    crontab -e
#    Agregar esta línea:
#    */15 * * * * source /ruta/a/audit-next/.env.local && /ruta/a/audit-next/scripts/sync.sh >> /ruta/a/audit-next/logs/cron.log 2>&1
# =============================================================================

set -euo pipefail

# ── Detectar directorio del proyecto ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/sync.log"

mkdir -p "$LOG_DIR"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

die() {
  log "ERROR: $*"
  exit 1
}

# ── Configuración con defaults ────────────────────────────────────────────────
MDB_SOURCE="${MDB_SOURCE:-}"
MDB_LOCAL="${MDB_LOCAL:-$HOME/Downloads/db.mdb}"
PRODUCTION_URL="${PRODUCTION_URL:-}"
SYNC_SECRET="${SYNC_SECRET:-changeme}"
BLOB_READ_WRITE_TOKEN="${BLOB_READ_WRITE_TOKEN:-}"

log "=========================================="
log "SYNC START"
log "=========================================="

# ─────────────────────────────────────────────────────────────────────────────
# PASO 1 — Copiar MDB desde la PC del POS
# ─────────────────────────────────────────────────────────────────────────────
log "[1/4] Copiando base de datos..."

if [ -n "$MDB_SOURCE" ]; then
  if [ -f "$MDB_SOURCE" ]; then
    cp "$MDB_SOURCE" "$MDB_LOCAL"
    SIZE=$(du -h "$MDB_LOCAL" | cut -f1)
    log "  MDB copiado desde $MDB_SOURCE ($SIZE)"
  else
    log "  AVISO: MDB_SOURCE=$MDB_SOURCE no encontrado, usando MDB_LOCAL existente"
  fi
else
  log "  MDB_SOURCE no configurado — usando MDB local en $MDB_LOCAL"
fi

[ -f "$MDB_LOCAL" ] || die "No se encontró MDB en $MDB_LOCAL"

# ─────────────────────────────────────────────────────────────────────────────
# PASO 2 — Exportar datos del MDB a JSON
# ─────────────────────────────────────────────────────────────────────────────
log "[2/4] Exportando datos del MDB..."

cd "$PROJECT_DIR"
python3 "$PROJECT_DIR/scripts/export_data.py" >> "$LOG_FILE" 2>&1

JSON_COUNT=$(ls "$PROJECT_DIR/data/"*.json 2>/dev/null | wc -l | tr -d ' ')
log "  Exportados $JSON_COUNT archivos JSON a data/"

# ─────────────────────────────────────────────────────────────────────────────
# PASO 3 — Subir JSON a Vercel Blob
# ─────────────────────────────────────────────────────────────────────────────
log "[3/4] Subiendo a Vercel Blob..."

if [ -n "$BLOB_READ_WRITE_TOKEN" ]; then
  BLOB_READ_WRITE_TOKEN="$BLOB_READ_WRITE_TOKEN" node "$PROJECT_DIR/scripts/upload-to-blob.js" >> "$LOG_FILE" 2>&1
  log "  Subida a Blob completada"
else
  log "  AVISO: BLOB_READ_WRITE_TOKEN no configurado — saltando subida a Blob"
  log "  (Los datos se sirven desde el filesystem local)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# PASO 4 — Invalidar caché en producción
# ─────────────────────────────────────────────────────────────────────────────
log "[4/4] Invalidando caché en producción..."

if [ -n "$PRODUCTION_URL" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${PRODUCTION_URL}/api/reload" \
    -H "Authorization: Bearer ${SYNC_SECRET}" \
    -H "Content-Type: application/json" \
    --max-time 15 \
    2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    log "  Caché invalidada OK (HTTP 200)"
  else
    log "  AVISO: /api/reload respondió HTTP $HTTP_CODE (no fatal)"
  fi
else
  log "  PRODUCTION_URL no configurado — saltando invalidación de caché"
fi

log "=========================================="
log "SYNC COMPLETADO"
log "=========================================="
echo ""
