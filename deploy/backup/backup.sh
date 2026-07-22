#!/bin/sh
# Sauvegarde quotidienne : dump PostgreSQL (gzip, horodate) + miroir du bucket
# MinIO, tous deux ecrits sur le volume `backups` (distinct des volumes
# `pgdata`/`minio` live) ; purge des dumps PostgreSQL plus vieux que
# BACKUP_RETENTION_DAYS (7 par defaut, spec §9.3). set -e : toute commande en
# echec interrompt le script (pas d'echec avale), l'erreur remonte dans les
# logs du conteneur (voir crontab, stdout/stderr rediriges vers le PID 1).
set -eu

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p /backups/postgres /backups/minio

echo "[backup] $(date -Iseconds) — debut pg_dump (${PGDATABASE})"
# PGHOST/PGUSER/PGPASSWORD/PGDATABASE : variables libpq standard, lues
# automatiquement par pg_dump (pas d'argument -h/-U/-d a dupliquer).
pg_dump --format=plain | gzip >"/backups/postgres/${PGDATABASE}-${TIMESTAMP}.sql.gz"
echo "[backup] $(date -Iseconds) — pg_dump termine (${PGDATABASE}-${TIMESTAMP}.sql.gz)"

echo "[backup] $(date -Iseconds) — debut miroir MinIO (${S3_BUCKET})"
mc alias set backup-target "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" --api S3v4 >/dev/null
mc mirror --overwrite --remove "backup-target/${S3_BUCKET}" /backups/minio/
echo "[backup] $(date -Iseconds) — miroir MinIO termine"

echo "[backup] $(date -Iseconds) — purge des dumps PostgreSQL > ${RETENTION_DAYS}j"
find /backups/postgres -name '*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "[backup] $(date -Iseconds) — sauvegarde terminee"

# Heartbeat (supervision v1, C4.1.2) : ping UNIQUEMENT si pg_dump, mc mirror
# et la purge se sont tous termines sans erreur (set -e garantit qu'on
# n'atteint ce point qu'apres leur succes complet). BACKUP_HEARTBEAT_URL est
# OPTIONNELLE - absente ou vide, le script ne fait rien (utilisable en local
# sans sonde). Le ping ne doit JAMAIS faire echouer la sauvegarde : `|| true`.
if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
  curl -fsS --retry 3 --max-time 10 "$BACKUP_HEARTBEAT_URL" || true
fi
