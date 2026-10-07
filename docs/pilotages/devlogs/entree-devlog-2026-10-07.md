### Session — 2026-10-07 — Migration MinIO → Silo (images quay.io en 401)

**Thèmes abordés :**
- Diagnostic de l'échec e2e de la PR KAN-77 : `quay.io/minio/*` refuse les pulls anonymes. Le repli quay de la v1.5.0 est mort.
- Mesure de l'impact : CI e2e (maintenant), build de l'image `backup` (prochain release), `compose pull` staging/prod (prochain déploiement), dev sur machine neuve.
- Évaluation des remplaçants (AIStor, Chainguard), puis bascule sur **Silo** (`pgsty/silo`), le fork proposé par Aymeric.
- Inventaire exhaustif des références MinIO, puis modifications chirurgicales sur les composes, l'image backup, la CI et la doc (ADR-0028).
- Vérifications réelles : relecture du volume existant, sauvegarde complète, simulation des étapes CI, e2e.
- Fin de session : merge de la PR Silo (#36), puis merge de `main` dans la branche KAN-77 (conflit `CHANGELOG.md` résolu), merge de la PR KAN-77 (#35), et commit `docs(pilotage)` des devlogs et captures sur `main`.

**Décisions prises :**
- **Silo (`docker.io/pgsty/silo:RELEASE.2026-09-03T13-18-01Z`) partout, jamais `:latest`.** Drop-in : mêmes `MINIO_*`, même API S3, même format disque, `curl`/`sh` présents, root comme avant. Écartés : changer de serveur (RustFS/Garage/SeaweedFS : migration de données non justifiée en mono-nœud) ; miroir ghcr d'une image en cache ou build des sources archivées (aucun correctif de sécurité) ; Chainguard (seul `latest` gratuit, sans shell ni curl, non-root à reprendre sur les volumes de prod) ; AIStor (licence obligatoire, S3 refusé sans). — Aymeric.
- **Client `mcli` pris dans l'image Silo, et non `pgsty/mc`.** `pgsty/mc` installe son binaire sous le nom `mc` et n'a aucun tag `2026-09-03T13-18-01Z`. On a donc une seule image et un seul tag partout. — Proposé par Claude, tranché par Aymeric.
- **Épinglage : tag dans les composes et la CI, `tag@digest` dans `deploy/backup/Dockerfile`** (artefact livré, convention de l'ancien `mc@sha256`). — Proposé par Claude, tranché par Aymeric.
- **Rien n'est renommé :** service et hostname `minio`, `S3_ENDPOINT`, variables `MINIO_*` et volume de données restent tels quels (les objets existants sont relus sans migration). — Aymeric (brief).
- **Docs historiques non réécrites** (ADR 0007/0013/0017/0023, spec Bloc 2, devlogs, cahier, anciennes entrées du CHANGELOG). Seuls les docs vivants sont annotés : README, `CLAUDE.md`, glossaire, architecture, maintenance des dépendances.

**Éléments notables / appris (gotchas) :**
- **`unauthorized: access to the requested resource is not authorized`** (exit 125, `docker run quay.io/minio/minio`) → MinIO a fermé les pulls anonymes sur quay.io fin 09/2026, après Docker Hub. → Silo. Vérification sans Docker : manifest anonyme `quay.io/v2/minio/minio/manifests/latest` → 401.
- **Le brief supposait `mcli` dans `pgsty/mc`**, or le `Dockerfile.goreleaser` de `pgsty/mc` copie son binaire sous `/usr/bin/mc`. `mcli` (+ lien `mc`) ne se trouve que dans l'image `pgsty/silo`. On l'a repéré en lisant les Dockerfiles avant d'écrire le diff : sinon, `minio-setup` et la sauvegarde auraient cassé au premier lancement.
- **L'entrepoint Silo traduit `server …` et `minio …` en `silo server …`.** `command: server /data --console-address ":9001"` reste valide.
- **`mcli mb --ignore-existing` affiche « Bucket created successfully » même quand le bucket existe déjà**, comme l'ancien `mc`. Vérifié : dates de création et nombre d'objets inchangés. Ce n'est pas une recréation.
- **Client Prisma généré périmé en changeant de branche** : `tsc` rouge sur `main` (7 erreurs `missing the following properties … contentVersion, scannedVersion`), parce que `src/generated/prisma` (non versionné) avait été généré depuis la branche KAN-77. → `npx prisma generate` après chaque changement de branche qui touche `schema.prisma`. **Candidat skill.**
- **`npx playwright test --repeat-each=3`** fait collisionner les e-mails `Date.now()` entre workers (`UniqueConstraintViolation` à l'inscription, puis timeout `waitForURL`). C'est un artefact de la répétition, pas un bug. Pour répéter, ajouter `--workers=1`.
- **Flake `folder-organization.spec.ts`** (glisser-déposer, `treeitem` introuvable après le glisser) observé une fois dans la suite complète, non reproduit seul. Sans lien avec le stockage, non traité dans ce lot.
- **`git rev-parse --short main origin/main`** échoue (`fatal: Needed a single revision`) : `--short` n'accepte qu'une révision. Ça a interrompu une chaîne `&&` avant la création de la branche.
- **Conflit `CHANGELOG.md` au merge de `main` dans KAN-77** : les deux branches ajoutaient une entrée sous `[Unreleased]` (« Modifié » Silo, « Corrigé » KAN-77). Le fichier sur disque était passé `UU` **sans marqueurs et sans aucune des deux entrées**, vidé au moment de la résolution. Les deux versions ont été récupérées depuis l'index git (`git show :2:CHANGELOG.md` = branche courante, `:3:` = branche fusionnée) et les deux entrées conservées dans l'ordre Keep a Changelog. Chaque ligne a été vérifiée contre l'index, ainsi que le reste du fichier à partir de `[1.5.0]` sur les deux côtés. **Candidat skill** (conflit de CHANGELOG `[Unreleased]` entre branches parallèles).
- **Collage multi-lignes dans PowerShell 5.1 : seule la première ligne s'exécute.** Les commandes `git add` / `git commit` rendues en blocs ont été partiellement perdues au collage : `entree-devlog-2026-10-07.md` n'est pas parti dans le commit `docs` de la PR Silo et a rejoint le commit `docs(pilotage)` sur `main`. → Règle désormais appliquée (mémoire Claude) : une seule ligne par étape, commandes chaînées par `;` (`&&` n'existe pas en PowerShell 5.1).

**Commandes utiles de la session :**
- `docker compose -f docker-compose.dev.yml exec minio sh -c 'mcli alias set local http://127.0.0.1:9000 story_tide change-me-story-tide && mcli ls local'` — lister les buckets via le client embarqué de Silo.
- `mcli ls --recursive --json local/<bucket>` (avant/après, en comparant `key`/`size`/`etag`) — prouver qu'un changement de serveur relit les données à l'identique.
- `docker run --rm --network host --entrypoint mcli -e MC_HOST_local="http://<user>:<pass>@localhost:<port>" docker.io/pgsty/silo:<tag> mb --ignore-existing local/<bucket>` — provisionner un bucket sans fichier de config (étape CI).
- `docker run --rm --network story-tide_default -e PGHOST=postgres … --entrypoint sh <image-backup> -c /usr/local/bin/backup.sh` — exécuter une sauvegarde réelle contre la stack de dev.
- `curl -s "https://hub.docker.com/v2/repositories/<org>/<repo>/tags?page_size=15"` et `curl -sI … /v2/<repo>/manifests/<tag>` (header `docker-content-digest`) — vérifier un tag et relever son digest sans Docker.
- `git show :2:<fichier>` / `git show :3:<fichier>` — lire la version « nous » / « eux » d'un fichier en conflit pendant un merge, même quand la copie de travail a été abîmée.

**Livrables produits :**
- `docker-compose.dev.yml`, `deploy/compose.staging.yml`, `deploy/compose.prod.yml` : `minio` et `minio-setup` passent sur `pgsty/silo:<tag>` ; `mc` → `mcli` ; commentaire fork + ADR au-dessus de chaque image.
- `deploy/backup/Dockerfile` (`FROM pgsty/silo:<tag>@sha256:b616a0cf…`, `COPY /usr/bin/mcli`) et `deploy/backup/backup.sh` (`mcli alias/mirror`).
- `.github/workflows/ci.yml` : démarrage Silo + bucket via `--entrypoint mcli`. Plus `.env.e2e.example` (mention).
- Docs : `docs/adr/0028-migration-minio-vers-silo.md` (+ index), CHANGELOG `[Unreleased]` › Modifié, annotations dans README, `CLAUDE.md`, glossaire, architecture, maintenance des dépendances.
- Vérifications :
  - dev Silo `healthy`, console :9001 en 200 ;
  - 8/8 objets identiques avant/après (clés, tailles, etags) ;
  - `minio-setup` `Exited (0)` ;
  - image backup reconstruite, `mcli` version `RELEASE.2026-09-03T07-13-05Z` ;
  - `backup.sh` complet `EXIT=0` (`pg_dump` + miroir de 49,67 Kio) ;
  - étapes CI simulées en local (health + `mb`) ;
  - configs compose staging/prod valides.
- Gates : lint ✅ · typecheck ✅ (après `prisma generate`) · format:check ✅ · tests ✅ 578/578 · couverture 98,8 % · e2e 16/17 (✅ `image-upload.spec.ts` sur Silo ; ❌ 1 flake `folder-organization`, hors lot) · build ✅.
- Commits (exécutés par Aymeric) : `a0d0903 chore(deploy): bascule MinIO vers le fork Silo dans les composes et l'image backup`, `53f50ef fix(ci): demarre Silo a la place de MinIO pour le job e2e`, `f43f134 docs: ADR-0028 migration MinIO vers Silo, CHANGELOG et mentions` → PR #36 mergée (`85afce4`).
- Merge `origin/main` → `fix/kan-77-renvois-scan-status` (`ab5f6c1`, conflit CHANGELOG résolu), puis PR #35 KAN-77 mergée (`5d3df07`).
- `8e5d821 docs(pilotage): devlogs 2026-10-04 (KAN-77) et 2026-10-07 (Silo), captures de supervision du 2026-09-12` sur `main`.

**Avancement certification :**
- C2.1.1 / C4.x (chaîne CI/CD) : CI e2e, build de l'image backup et `compose pull` rétablis.
- C2.2.1 Architecture : le port `Storage` isole l'application, aucune ligne de code applicatif touchée. ADR-0028.
- Maintenance des dépendances : surface d'images de base mise à jour dans `docs/maintenance-dependances.md`.

**À faire / suite :**
- RC staging avant toute prod, qui couvre les deux lots :
  - Silo : `compose pull`, `minio-setup` `Exited (0)`, relecture des objets existants, upload réel, déclenchement manuel d'une sauvegarde ;
  - KAN-77 : migration `20261004120000_kan77_entity_scan_versions` via le conteneur `migrate`, puis TST-ENT-019.
- Jira : poster le commentaire KAN-77 et faire avancer le ticket ; créer ou rattacher un ticket pour la migration Silo (la PR #36 n'en cite aucun).
- Ouvert : le flake du glisser-déposer `folder-organization.spec.ts` est à suivre (ticket ?). `--repeat-each` demande `--workers=1`.
- Idée à faire : évaluer Garage ou RustFS si Silo cesse d'être maintenu (surveiller le rythme de releases `pgsty/silo`).
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-10-07 | **MinIO servi par Silo (`pgsty/silo:RELEASE.2026-09-03T13-18-01Z`), `mcli` pris dans la même image** | RustFS/Garage/SeaweedFS ; miroir ghcr ; build depuis les sources archivées ; Chainguard ; AIStor ; `pgsty/mc` | Drop-in (API, variables, format disque), images publiques maintenues, pas de migration de données ; un seul tag partout |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-10-07 | `docker: Error response from daemon: unauthorized: access to the requested resource is not authorized` (pull `quay.io/minio/minio`) | MinIO a fermé les pulls anonymes sur quay.io fin 09/2026 (après Docker Hub) | Bascule sur `docker.io/pgsty/silo:<tag>` (ADR-0028) |
| 2026-10-07 | `tsc` : `missing the following properties … contentVersion, scannedVersion` sur `main` | Client Prisma généré depuis une autre branche | `npx prisma generate` après un changement de branche |
| 2026-10-07 | `UniqueConstraintViolation` à l'inscription en `--repeat-each` | E-mails `Date.now()` identiques entre workers parallèles | `--repeat-each` avec `--workers=1` |
| 2026-10-07 | `CHANGELOG.md` en `UU` sans marqueurs, les deux entrées `[Unreleased]` disparues | Copie de travail vidée pendant la résolution du conflit | Récupérer les deux versions avec `git show :2:` / `:3:`, puis garder les deux entrées (Modifié puis Corrigé) |
| 2026-10-07 | Collage d'un bloc de commandes git dans PowerShell : seule la 1re ligne s'exécute | Comportement du collage multi-lignes dans PowerShell 5.1 | Une seule ligne par étape, commandes chaînées par `;` |

Cette mise à jour du devlog n'est pas encore commitée.
