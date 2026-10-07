# ADR-0028 — Migration de MinIO vers Silo (fork communautaire maintenu)

- **Statut** : accepté
- **Date** : 2026-10-07
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Le stockage binaire (images uploadées, ADR-0017/ADR-0023) repose sur un serveur
MinIO auto-hébergé, accédé via le port `Storage` et le SDK S3. Le code applicatif
n'a aucune dépendance au produit MinIO lui-même. En revanche, quatre surfaces
d'infrastructure tirent ses **images Docker** :

- la compose de dev ;
- les composes staging/prod (service `minio` + one-shot `minio-setup`) ;
- l'image `backup` (client `mc` copié dans `postgres:16-alpine`) ;
- le job e2e de la CI.

Chronologie de l'arrêt de la distribution communautaire :

- **mai 2025** : la console d'administration est retirée de l'édition communautaire.
- **fin 2025** : MinIO cesse de publier les images et binaires communautaires sur
  Docker Hub. Le projet bascule sur `quay.io/minio/*` (v1.5.0, commits `9fe7981`
  et `e906ddc`, échec CD du 2026-09-12 `pull access denied`).
- **25/04/2026** : le dépôt upstream `minio/minio` est archivé.
- **fin septembre 2026** : `quay.io/minio/minio` et `quay.io/minio/mc` refusent à leur
  tour les pulls anonymes.

Ce dernier point a été constaté le 2026-10-07 : le job e2e de la PR KAN-77 échoue
avec `docker: Error response from daemon: unauthorized: access to the requested
resource is not authorized` (exit 125). Une requête de manifest anonyme sur
`quay.io/v2/minio/minio` renvoie 401.

Conséquences si rien n'est fait :

- la CI e2e est rouge sur **toutes** les PR ;
- le prochain release échoue au build de l'image `backup` ;
- le prochain déploiement échoue au `docker compose pull` de staging/prod.

La prod en cours tourne sur une image en cache sur le VPS, saine mais non
reconstructible.

## Options envisagées

- **A — Silo (`pgsty/silo`), fork communautaire maintenu par Pigsty** (retenue).
  C'est un drop-in : mêmes variables `MINIO_*`, même API S3, même format de données
  sur disque (`.minio.sys`), route `/minio/health/live` conservée. La console web
  complète est incluse. Le binaire s'appelle `silo` (l'entrypoint traduit `server …`
  et `minio …`) ; le client embarqué s'appelle `mcli`, avec un lien `mc`.
  - L'image embarque `curl` et `/bin/sh`, ce qui permet de garder les healthchecks
    et le `minio-setup` en `/bin/sh -c`.
  - Elle tourne en root, comme l'image quay qu'elle remplace : aucune reprise de
    droits sur les volumes existants.
- **B — Changer de serveur S3 (RustFS, Garage, SeaweedFS)** (écartée) : migration
  des données et revalidation complète (upload, proxy de lecture, sauvegarde,
  recette) non justifiées pour un VPS mono-nœud, alors qu'un drop-in existe.
- **C — Miroir sur ghcr.io d'une image MinIO encore en cache** (écartée) : fige le
  service sur une version qui ne recevra plus aucun correctif de sécurité.
- **D — Build depuis les sources archivées de MinIO** (écartée) : même impasse que C
  côté correctifs, avec en plus une image à construire et maintenir.
- **E — Chainguard (`cgr.dev/chainguard/minio`)** (non retenue) : seul `latest` est
  gratuit, l'image n'a ni shell ni curl, et elle tourne en non-root. Il aurait fallu
  adapter les healthchecks et `minio-setup`, et reprendre les droits des volumes de
  prod.
- **F — AIStor (`quay.io/minio/aistor/*`)** (écartée) : pull anonyme possible, mais
  produit commercial. Sans fichier de licence, les opérations S3 sont refusées.

## Décision

Silo, épinglé sur **`docker.io/pgsty/silo:RELEASE.2026-09-03T13-18-01Z`**, jamais
`:latest`. Le **même tag** est utilisé partout : serveur `minio` des trois composes,
one-shot `minio-setup`, job e2e de la CI. Le client vient de **la même image**
(`mcli`), et non de `pgsty/mc`, pour deux raisons :

- `pgsty/mc` installe son binaire sous le nom `mc` ;
- `pgsty/mc` n'a pas de tag correspondant à cette release.

L'image `backup`, artefact livré, épingle en plus le digest d'index
(`@sha256:b616a0cf8cb281e7e6bb3c9b1fb53875b4016a2878223925541c18f82d6c5ca3`), selon
la même convention que l'ancien `mc@sha256`.

Ne changent **pas** :

- le nom de service et hostname `minio`, et `S3_ENDPOINT: minio` ;
- les variables `MINIO_ROOT_*` ;
- le volume de données `minio` / `minio_data` ;
- le code applicatif (SDK S3).

Seules les références d'image et les appels `mc` → `mcli` sont modifiés.

## Conséquences

- **Dépendance à un fork tiers** (Pigsty, AGPL-3.0) : la santé du projet est à
  surveiller (rythme de releases, correctifs de sécurité). La montée de version est un
  geste délibéré, sur les quatre références à la fois. Le tag est à aligner avec le
  digest de `deploy/backup/Dockerfile`.
- **Données portables** : le format sur disque reste celui de MinIO. Vérifié le
  2026-10-07 sur le volume de dev : les 8 objets existants sont relus à l'identique
  (clés, tailles, etags) sans migration, et une sauvegarde complète
  (`pg_dump` + `mcli mirror`) réussit avec l'image `backup` reconstruite.
- **Outillage** : `mc` → `mcli` dans les scripts (`minio-setup`, `backup.sh`, CI).
  `mcli` lit toujours `MC_HOST_<alias>`.
- **Si Silo cessait d'être maintenu** : réévaluer Garage ou RustFS (option B), cette
  fois avec migration des données.

## Rollback

Retaguer vers l'image MinIO encore en cache (`quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`
sur le VPS) en revenant sur les commits de cette migration. Ce n'est possible que tant
que l'image n'a pas été purgée localement : elle n'est plus tirable. Les données
étant au même format, le retour ne demande aucune opération sur les volumes.

## Compétence(s) servie(s)

C2.2.1 (architecture : le port `Storage` isole l'application du produit, seul
l'outillage d'infrastructure change), C2.1.1 (chaîne CI/CD rétablie).
