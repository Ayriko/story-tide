### Session — 2026-07-18 — KAN-10 : chaîne CD complète (Traefik/Let's Encrypt, compose prod/staging, GitHub Actions → ghcr → SSH → VPS)

**Thèmes abordés :**
- Mise en place de la chaîne CD complète pour KAN-10 (dernier maillon P0 avant la recette).
- Décision de topologie staging/prod sur le VPS unique (validée avec Aymeric via 4 questions fermées).
- Infra Docker (`deploy/`) : nouveau stage `migrate`, Traefik partagé, deux compose auto-contenus, sauvegardes conteneurisées.
- Workflow `.github/workflows/cd.yml` (build+push ghcr, déploiement SSH gaté par environment GitHub).
- Vérification réelle (pas seulement supposée) des images Docker `migrate`/`backup` — Docker Desktop démarré en cours de session, bug `crond` trouvé et corrigé.
- Documentation au fil de l'eau : ADR-0013, `docs/cd.md`, `docs/manuels/deploiement.md`, OWASP, cahier de recettes, CHANGELOG, spec.

**Décisions prises :**
- Deux fichiers compose séparés (`compose.prod.yml`/`compose.staging.yml`), auto-contenus, + un Traefik partagé (seul titulaire des ports 80/443 et de l'`acme.json`) — plutôt qu'un compose unique paramétré. Justification : topologie explicite à la lecture ; risque de dérive entre les deux fichiers assumé et documenté (ADR-0013), pas nié. Tranché par Aymeric (question fermée).
- Image `migrate` dédiée (nouveau stage Docker `FROM deps`) + service Compose one-shot (`depends_on: condition: service_completed_successfully`) — plutôt qu'une étape SSH `docker compose run --rm migrate`. Justification : migrations rejouables à la main sans sortir du fichier compose versionné. Tranché par Aymeric.
- Packages ghcr **publics** — plutôt que privés avec PAT posé sur le VPS. Justification : zéro secret ghcr côté serveur, le code source reste privé indépendamment. Tranché par Aymeric.
- Gate de mise en production via **GitHub Environment `production`** (reviewer requis) — plutôt qu'un déploiement prod automatique sur tag. Justification : barrière humaine côté GitHub Actions (pas sur le VPS) avant toute mise en ligne réelle, staging reste automatique. Tranché par Aymeric.

**Éléments notables / appris (gotchas) :**
- `busybox crond` (image `postgres:16-alpine`, base de `deploy/backup/Dockerfile`) ne lisait jamais le crontab copié dans `/etc/crontabs/root` : le répertoire par défaut de CE build busybox est `/var/spool/cron/crontabs` (vérifié via `crond -h`, pas une supposition), pas `/etc/crontabs` comme sur d'autres distributions Alpine. Corrigé par `-c /etc/crontabs` explicite dans le `CMD`. Trouvé en testant réellement le conteneur (`docker run` + `crontab -l`), pas en lisant la doc de loin.
- Corollaire : `docker logs` restait muet au démarrage de `crond` — `-S` (log vers syslog) est le défaut busybox, silencieux sans démon syslog dans un conteneur minimal. Corrigé par `-L /dev/stdout` explicite.
- `docker run --entrypoint /usr/local/bin/backup.sh ...` échouait sous Git Bash Windows avec `stat C:/Program Files/Git/usr/local/bin/backup.sh: no such file or directory` — MSYS réécrit tout chemin commençant par `/` en chemin Windows avant de le passer à Docker. Contournement : préfixer la commande avec `MSYS_NO_PATHCONV=1`.
- L'orphelin Windows du worker e2e (déjà documenté dans la skill `windows-orphan-node-e2e-cleanup`) s'est reproduit une fois de plus après un run e2e complet et vert (5/5) : 3 process `node`/`tsx` liés au worker sont restés vivants après le teardown Playwright. Confirmé via `CreationDate` (horodatage collé au run), nettoyé via `taskkill //PID <pid> //F //T`. Rien de nouveau à ajouter à la skill, juste une récidive attendue — pas de piège inédit cette fois.
- Docker Desktop n'était pas démarré en tout début de session : le premier `docker build --target migrate` a échoué (`failed to connect to the docker API`) ; repris plus tard dans la session une fois le daemon up, sans bloquer le reste du travail (docs/YAML avancés en parallèle).

**Commandes utiles de la session :**
- `docker build --target <stage> -t <nom>:check .` — vérifier qu'un nouveau stage Docker (ici `migrate`) compile avant de le pousser en CD.
- `docker compose -f deploy/compose.prod.yml --env-file deploy/.env.prod.example config` — valider la syntaxe et l'interpolation de variables d'un compose avec des placeholders, sans jamais démarrer de conteneur.
- `docker inspect <image> --format '{{.Config.Cmd}} | User={{.Config.User}}'` — vérifier `CMD` et l'utilisateur non-root d'une image sans la lancer.
- `MSYS_NO_PATHCONV=1 docker run --entrypoint /usr/local/bin/backup.sh ...` — éviter le path-mangling MSYS sous Git Bash Windows sur les chemins passés à `--entrypoint`/`--volume`.
- `wmic process where "name='node.exe'" get ProcessId,CommandLine,CreationDate` — lister les process node avec horodatage de création (distinguer un orphelin de CE run d'un résidu d'un run précédent).
- `taskkill //PID <pid> //F //T` — tuer l'arborescence complète d'un process orphelin sous Windows (le `//T` est ce qui manque à `worker.kill()`).

**Livrables produits :**
- `Dockerfile` : nouveau stage `migrate` (`FROM deps`, `prisma migrate deploy`), ajout chirurgical, `app`/`worker` inchangés.
- `deploy/traefik/` : `compose.traefik.yml` (seul titulaire 80/443), `traefik.yml` (résolveur LE staging actif par défaut, bascule prod commentée), `dynamic/middlewares.yml` (`secure-headers`, `www-to-apex`), `.env.example`.
- `deploy/compose.prod.yml` + `deploy/compose.staging.yml` : 6 services chacun (migrate/app/worker/postgres/minio/backup — backup optionnel en staging), aucun `ports:` hors Traefik (garde-fou ufw/Docker), réseaux `internal`+`web` isolés par projet Compose.
- `deploy/backup/` : `Dockerfile` (`postgres:16-alpine` + `mc` + busybox `crond`), `backup.sh` (`pg_dump` gzip + `mc mirror` + purge > 7 j), `crontab`. **Vérifié en conditions réelles** contre des conteneurs PostgreSQL/MinIO jetables (dump produit, miroir MinIO fonctionnel, purge sans erreur).
- `deploy/.env.prod.example`, `deploy/.env.staging.example`, `deploy/traefik/.env.example` — placeholders uniquement.
- `.gitignore` : négations ajoutées pour les nouveaux `.env*.example` (vérifié via `git check-ignore -v`).
- `.github/workflows/cd.yml` : job `build-push` (matrix app/worker/migrate/backup → ghcr public) + job `deploy` (SSH, `environment` staging/production selon le tag `-rc.`, `--wait` sur les healthchecks).
- Docs : `docs/adr/0013-deploiement-vps-unique.md` (+ index `README.md`), `docs/cd.md` rempli (était un stub), `docs/manuels/deploiement.md` rempli avec l'état serveur exact du 18/07 (était un stub), `docs/securite-owasp.md` (A02/A05/A08 étendus), `docs/cahier-recettes.md` (`TST-SEC-009` à `TST-SEC-012`, statut ⬜ à faire — exécution réelle sur staging à venir), `CHANGELOG.md` (Ajouté + Sécurité), `docs/spec-technique-bloc2.md` §9.3 (note d'état honnête : repo prêt, exécution VPS restante — pas de **Fait** prématuré).
- Branche `feat/cd-vps` créée depuis `main`, `push -u` fait immédiatement (règle mémorisée). **Rien committé** — fichiers listés et message de commit fournis à Aymeric en fin de session.
- Gates : lint ✅ (0 warning) · typecheck ✅ · tests ✅ (249/249, couverture 98.52 %, inchangée — aucun `src/` touché) · build ✅ · e2e ✅ (5/5, 1.1 min) · builds Docker `migrate`/`backup` ✅ (vérifiés réellement, bug `crond` trouvé et corrigé en cours de route, pas après coup).

**Avancement certification :**
- C2.1.1 (architecture/CD) : chaîne CD complète câblée côté repo (ADR-0013, `cd.yml`, `deploy/`) — reste l'exécution VPS (bring-up Traefik, tags, approbation) pour clore réellement KAN-10.
- C2.2.3 (sécurité) : OWASP A02 (TLS bout en bout Traefik/LE), A05 (gotcha ufw/Docker documenté et mitigé, en-têtes `secure-headers`), A08 (provenance ghcr limitée au workflow, VPS ne build jamais) — `docs/securite-owasp.md` étendu avec preuves de code, pas de TODO muet.
- C2.3.1 (recette) : `TST-SEC-009` à `TST-SEC-012` ajoutés au cahier de recettes, à exécuter réellement sur staging (statut ⬜ assumé, pas maquillé en ✅).
- C2.4.1 (traçabilité/doc) : ADR-0013 rédigé, `docs/cd.md` et `docs/manuels/deploiement.md` remplis (anciens stubs), spec mise à jour sans sur-déclarer l'avancement.

**À faire / suite :**
- Aymeric : relire le diff, committer KAN-10 (liste de fichiers + message conventionnel déjà fournis en fin de session), ouvrir la PR `feat/cd-vps`.
- Aymeric sur le VPS : générer les secrets réels, poser `deploy/.env.prod`, `deploy/.env.staging`, `deploy/traefik/.env` (jamais dans le repo), `docker network create web` + `docker volume create traefik_letsencrypt`, bring-up Traefik en résolveur LE **staging** d'abord.
- Aymeric sur GitHub (Settings → Environments) : configurer `staging` (aucun reviewer) et `production` (reviewer = Aymeric).
- Premier tag `v1.0.0-rc.1` → vérifier `staging.storytide.fr` en HTTPS (certificat LE staging, non fiable navigateur — attendu) → exécuter `TST-SEC-009` à `TST-SEC-012` pour de vrai.
- Bascule Let's Encrypt en prod (vider/recréer `traefik_letsencrypt`, éditer `caServer` dans `traefik.yml`) → tag `v1.0.0` → approuver l'environment `production` dans l'onglet Actions → `storytide.fr` en ligne.
- Ne marquer KAN-10 **Fait** dans la spec qu'après ces étapes réelles — actuellement noté « repo prêt, VPS restant » (§9.3).
- Reporter cette entrée dans `dev-log.md` (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (KAN-10 → en cours/à valider, **pas** Done tant que `storytide.fr` n'est pas réellement en ligne).

---

## Décisions techniques (session KAN-10)

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-18 | Deux compose séparés (prod/staging) + Traefik partagé | Compose unique paramétré | Topologie explicite à la lecture, risque de dérive assumé et documenté (ADR-0013) |
| 2026-07-18 | Image `migrate` dédiée + service Compose one-shot | Étape SSH `docker compose run --rm migrate` | Rejouable à la main sans sortir du compose versionné |
| 2026-07-18 | Packages ghcr publics | Packages privés + PAT posé sur le VPS | Zéro secret ghcr côté serveur |
| 2026-07-18 | Gate prod via GitHub Environment (reviewer requis) | Déploiement prod automatique sur tag | Barrière humaine côté GitHub, VPS reste 100 % automatisé |

## Erreurs rencontrées & Solutions (session KAN-10)

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-18 | `crond` (busybox, image `postgres:16-alpine`) ne lisait jamais `/etc/crontabs/root` | Répertoire par défaut de ce build busybox = `/var/spool/cron/crontabs` (confirmé via `crond -h`), pas `/etc/crontabs` | `-c /etc/crontabs` explicite dans le `CMD` |
| 2026-07-18 | Aucune sortie dans `docker logs` au démarrage de `crond` | `crond` logue vers syslog par défaut (`-S`), absent d'un conteneur minimal | `-L /dev/stdout` explicite dans le `CMD` |
| 2026-07-18 | `docker: ... stat C:/Program Files/Git/usr/local/bin/backup.sh: no such file or directory` sur `docker run --entrypoint /usr/local/bin/backup.sh` | Git Bash (MSYS) réécrit tout chemin commençant par `/` en chemin Windows avant de le transmettre | `MSYS_NO_PATHCONV=1` en préfixe de la commande |
| 2026-07-18 | 3 process `node`/`tsx` orphelins après un run e2e complet et vert | `worker.kill()` (Windows) ne tue que le wrapper shell, pas l'arborescence (déjà documenté, skill `windows-orphan-node-e2e-cleanup`) | `taskkill //PID <pid> //F //T`, confirmé via `CreationDate` |

⚠️ Rien n'a été committé à la clôture de cette session : tout le travail KAN-10 (`Dockerfile`, `deploy/`, `.github/workflows/cd.yml`, docs) reste à stager et committer par Aymeric — liste de fichiers et message de commit fournis en fin de session.
