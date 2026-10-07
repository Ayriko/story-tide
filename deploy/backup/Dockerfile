# syntax=docker/dockerfile:1

# Image de sauvegarde quotidienne (pg_dump + miroir MinIO), poussee sur ghcr
# comme app/worker/migrate — le VPS ne build jamais (voir ADR-0013). Base
# postgres:16-alpine : meme version majeure que le serveur de compose.*.yml
# (pg_dump doit matcher la version du serveur cible), busybox (crond inclus)
# deja present. `mcli` (client S3 du fork Silo) recupere depuis l'image Silo.

# `mcli` tire depuis l'image du fork Silo (pgsty) : MinIO ne distribue plus
# d'image en anonyme (Docker Hub retire, quay.io en 401 depuis fin 09/2026 -
# echec CI du 2026-10-07, `unauthorized: access to the requested resource is
# not authorized`). Meme tag que les composes, epingle EN PLUS par digest
# — c'est un artefact livre, sa mise a jour doit etre un geste delibere et non
# un effet de bord d'un rebuild.

# Fork maintenu de MinIO (upstream archivé 04/2026) — voir docs/adr/0028-migration-minio-vers-silo.md
FROM docker.io/pgsty/silo:RELEASE.2026-09-03T13-18-01Z@sha256:b616a0cf8cb281e7e6bb3c9b1fb53875b4016a2878223925541c18f82d6c5ca3 AS silo

FROM postgres:16-alpine
# curl absent de la base alpine — necessaire au heartbeat de fin de
# sauvegarde (supervision v1, C4.1.2 ; voir backup.sh).
RUN apk add --no-cache curl
COPY --from=silo /usr/bin/mcli /usr/local/bin/mcli
COPY backup.sh /usr/local/bin/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh

# crond en foreground (PID 1) : le conteneur reste vivant tant que crond
# tourne, `docker compose ps` le montre sain via son etat "running".
# `-c /etc/crontabs` explicite : le repertoire par defaut de ce busybox
# (verifie via `crond -h`) est /var/spool/cron/crontabs, pas /etc/crontabs ou
# le crontab est copie ci-dessus — sans ce flag, le job ne serait jamais lu.
# `-L /dev/stdout` : busybox logue par defaut vers syslog (absent ici), donc
# silencieux dans `docker logs` sans ce flag — verifie en local (le log de
# demarrage de crond n'apparaissait pas sans lui).
CMD ["crond", "-f", "-l", "2", "-c", "/etc/crontabs", "-L", "/dev/stdout"]
