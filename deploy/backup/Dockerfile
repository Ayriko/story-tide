# syntax=docker/dockerfile:1

# Image de sauvegarde quotidienne (pg_dump + miroir MinIO), poussee sur ghcr
# comme app/worker/migrate — le VPS ne build jamais (voir ADR-0013). Base
# postgres:16-alpine : meme version majeure que le serveur de compose.*.yml
# (pg_dump doit matcher la version du serveur cible), busybox (crond inclus)
# deja present. `mc` (client MinIO) recupere depuis l'image officielle.

# `mc` (client MinIO) tire depuis quay.io/minio, le registre officiel du
# projet : le namespace minio/* de Docker Hub n'est plus accessible en
# anonyme (echec CD du 2026-09-12, `pull access denied`). Epingle par digest
# et non par `latest` — c'est un artefact livre, sa mise a jour doit etre un
# geste deliberer et non un effet de bord d'un rebuild.

FROM quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727 AS mc

FROM postgres:16-alpine
# curl absent de la base alpine — necessaire au heartbeat de fin de
# sauvegarde (supervision v1, C4.1.2 ; voir backup.sh).
RUN apk add --no-cache curl
COPY --from=mc /usr/bin/mc /usr/local/bin/mc
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
