### Session — 2026-07-12 — CI GitHub Actions, réconciliation ADR externes, Dockerfile multi-stage + worker

**Thèmes abordés :**
- Réconciliation de 3 ADR générées dans une session Claude externe (+ import d'un skill projet `pgboss-singleton-dedup`) dans le journal ADR existant, sans doublon ni collision de numérotation.
- Étape 7 (CI GitHub Actions) et étape 10 (README quickstart) du punch-list d'init.
- Clarification du modèle de branches git (trunk-based vs dev/staging) avant le premier commit routé en PR.
- Étape 8 (dernière du punch-list) : Dockerfile multi-stage (app + worker), squelette `src/worker/index.ts`, choix de l'image de base et de la version Node.

**Décisions prises :**
- Doublons ADR (Prisma 7, pg-boss) : fusionner le meilleur des deux dans les fichiers déjà committés (0005/0006) plutôt que d'adopter la numérotation externe ou de jeter les apports — tranché par Aymeric (AskUserQuestion). Nouveau sujet réel (exclusion couverture wrappers SDK) ajouté en 0007.
- Modèle de branches : confirmé trunk-based (`main` + `feat/*` courtes + PR ; environnements staging/prod promus par **tags**, pas par des branches longues `dev`/`staging`) — déjà acté spec §9.1-9.3 (Bloc 1), simple clarification avec Aymeric qui a ensuite choisi de router désormais les commits via `feat/*` + PR plutôt que direct sur `main`.
- A11y automatisée (axe) : tentative `jest-axe` dans le job test Vitest, **abandonnée** — incompatibilité runtime avec Vitest 4. Fallback pré-décidé au plan : ne pas bloquer la CI, reporter l'audit axe pleine-page à un futur job Playwright smoke.
- Image Docker de base : `node:24-slim` (Debian/glibc) plutôt qu'Alpine — Aymeric a explicitement demandé de vérifier avant de valider. Recherche faite (WebSearch) : Prisma 7 + driver adapter documenté fragile sur musl encore en 2025-2026, esbuild/tsx (moteur de `tsx`) même friction musl. Node bump 20→24 : Node 24 est l'Active LTS (EOL avril 2028) contre Node 22 en Maintenance (EOL avril 2027), et pg-boss exige `>=22.12`. Alignement Node 24 sur dev/CI/Docker. Décision tracée en ADR-0008.
- Exécution du worker en conteneur : `CMD ["node", "--import", "tsx", ...]` plutôt que `npm run worker`, pour que le process PID 1 du conteneur reçoive directement `SIGTERM` (arrêt gracieux pg-boss) — vérifié en conditions réelles.

**Éléments notables / appris (gotchas) :**
- `Failed to load config file "/app"... PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` pendant `npm ci` en build Docker → `postinstall: prisma generate` résout `DATABASE_URL` via `prisma.config.ts` même sans connexion réelle ; masqué en local par `dotenv`/`.env`. Corrigé en passant un placeholder inline sur le `RUN`, jamais figé en couche `ENV`.
- `npm warn EBADENGINE ... pg-boss@12.25.1 required: {node:'>=22.12.0'} current: {node:'v20.20.2'}` sur `node:20-slim` → signal déclencheur de tout l'alignement Node 20→24.
- `TypeError: expectAssertion.call is not a function` sur `expect(await axe(container)).toHaveNoViolations()` → le matcher `jest-axe` dépend d'internals Jest absents sous Vitest 4 (les types `@types/jest-axe` n'augmentent d'ailleurs que le namespace Jest, pas `vitest.Assertion`). Abandon propre (uninstall, revert, zéro trace dans `package.json`/lockfile).
- **`kill -TERM <pid>` sous Git Bash/Windows ne délivre pas de vrai `SIGTERM` JS-visible** à un process `node.exe` natif (exit 143 au lieu de l'exit 0 attendu, testé à la fois via `npm run worker` et via `node --import tsx` direct — les deux semblaient "casser" alors que seul le premier était réellement en cause). Le test faisant foi a dû être fait **dans le vrai conteneur Linux** (`docker stop`) → exit 0 confirmé. *Candidat skill* : ne jamais valider un comportement de signal Unix (SIGTERM/SIGINT) via `kill` sous Git Bash/Windows, toujours vérifier dans l'environnement Linux cible (conteneur ou CI).
- Après un `git stash` + changement de branche, 5 fichiers sont réapparus modifiés côté `format:check` (drift CRLF/LF pur, confirmé par `git diff` vide sur `vitest.config.ts`) — corrigé via `prettier --write`, fichier exclu du commit car aucun changement de contenu réel.
- Après le merge de la PR #1, la branche locale `feat/ci-workflow` restait *stale* (merge non fast-forward) alors que du travail non committé (Docker) était dessus — récupéré sans perte via stash → fast-forward de `main` sur `origin/main` → nouvelle branche → stash pop.

**Commandes utiles de la session :**
- `docker build --target app -t X .` / `--target worker` — builder une cible précise d'un Dockerfile multi-stage.
- `docker run -d --name X --network story-tide_default -e VAR=... IMAGE` puis `docker logs`, `docker exec X whoami`, `docker stop X`, `docker inspect X --format '{{.State.ExitCode}}'` — séquence complète de smoke-test conteneur (abonnement, utilisateur non-root, arrêt gracieux réel).
- `git stash push -u -m "..."` puis `git checkout main && git merge --ff-only origin/main` puis `git checkout -b <branche>` puis `git stash pop` — récupération propre quand du travail non committé traîne sur une branche déjà mergée/stale.
- `curl -s "https://api.github.com/repos/<owner>/<repo>/commits/<sha>/check-runs"` — statut CI d'un commit/PR via l'API GitHub quand `gh` CLI n'est pas installé dans le shell.

**Livrables produits :**
- **PR #1 (mergée)** : `.github/workflows/ci.yml`, `vitest.config.ts` (reporters json/json-summary), `README.md` (quickstart), `docs/ci.md`, `docs/qualite-performance.md`, `docs/accessibilite-rgaa.md`, `docs/README.md`, `CHANGELOG.md`. Commentaire de couverture PR vérifié fonctionnel (100/100/88,9/100).
- **Commit direct main (réconciliation ADR)** : `docs/adr/0005-pg-boss-jobqueue.md`, `0006-prisma-7.md` enrichis, `0007-exclusion-couverture-wrappers-sdk.md` créé, `docs/adr/README.md`, `.claude/skills/pgboss-singleton-dedup/SKILL.md` importé.
- **PR #2 (ouverte, CI verte, non mergée)** : `Dockerfile`, `.dockerignore`, `next.config.ts` (`output: "standalone"`), `src/worker/index.ts` (squelette), `package.json`/`package-lock.json` (Node `engines>=24`, `tsx` en dépendance, `@types/node@24`), `.github/workflows/ci.yml` (node-version 24), `docs/architecture.md`, `docs/ci.md`, `docs/README.md`, `docs/adr/README.md`, `docs/adr/0008-node-24-slim-debian.md`, `README.md`, `CHANGELOG.md`.
- Gates en fin de session : lint ✅ 0 warning · typecheck ✅ · tests ✅ 30/30 · couverture 100 %/100 %/88,9 %/100 % (statements/branches/fonctions/lignes, seuil 80 % actif) · build ✅ (`next build` + 2 images Docker) · CI PR #2 : ✅ success (1 annotation informative sans rapport, dépréciation Node 20 des runners GitHub Actions).

**Avancement certification :**
- **C2.1.2** (CI) : pipeline réel posé et vert, `docs/ci.md` à jour.
- **C2.1.1** (qualité/perf) : rapport de couverture + commentaire de PR réellement en place (plus une cible), `docs/qualite-performance.md` à jour.
- **C2.2.1** (architecture) : point d'entrée worker existe (squelette branché sur le port `JobQueue`), Dockerfile multi-stage app+worker conforme à la spec (`node:*-slim`, non-root), `docs/architecture.md` à jour.
- **C2.4.1** (justification des choix) : ADR-0007 et ADR-0008 rédigés, journal ADR réconcilié sans doublon, `docs/adr/README.md` à jour.
- **C2.2.3** (a11y) : tentative honnêtement documentée comme non aboutie plutôt que passée sous silence (`docs/accessibilite-rgaa.md`).
- **C2.2.4** / traçabilité solo (parade Bloc 3) : premier cycle réel `feat/*` → PR → CI → merge exercé deux fois.

**À faire / suite :**
- **Merger PR #2** (Docker multi-stage + worker + Node 24) — CI verte, en attente de décision Aymeric.
- Prochaine étape logique explicitement nommée par Aymeric : **bloc produit de la semaine** — moteur Aho-Corasick maison (`src/lib/linker`, TDD) puis branchement réel dans le handler stub du worker, relations AUTO, surlignage, backlinks, garde-fous (ignore/homonymes).
- Audit axe pleine-page toujours à outiller (probable futur job Playwright smoke).
- `docs/cd.md` et les manuels (déploiement/utilisation/mise-à-jour) restent volontairement non commencés — VPS pas encore commandé (~13-15 juillet).
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-12 | **`node:24-slim` (Debian/glibc) plutôt qu'Alpine pour les images Docker** | Alpine (musl) | Prisma 7 + driver adapter documenté fragile sur musl (2025-2026) ; esbuild/tsx même friction ; Node 24 = Active LTS (EOL 2028) vs Node 22 Maintenance (EOL 2027), requis par pg-boss `>=22.12` |
| 2026-07-12 | **Modèle git confirmé trunk-based : `main` + `feat/*` + PR, environnements promus par tags** | Gitflow (branches `dev`/`staging` longues) | Déjà acté spec §9.1-9.3 (Bloc 1) : staging/prod = 2 stacks Compose sur le même VPS, promues par tags `X.Y.Z(-rc.N)`, pas par des branches — clarifié avec Aymeric avant le premier commit routé en PR |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-12 | `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` pendant `npm ci` (build Docker) | `postinstall: prisma generate` résout `DATABASE_URL` via `prisma.config.ts`, non fournie en contexte Docker (masqué en local par dotenv) | Placeholder `DATABASE_URL` inline sur le `RUN npm ci` (build-only, jamais en couche `ENV`) |
| 2026-07-12 | `npm warn EBADENGINE ... pg-boss@12.25.1 required: {node:'>=22.12.0'}` sur `node:20-slim` | Image Node trop ancienne pour pg-boss 12 | Bascule Node 20→24 (Active LTS) sur dev/CI/Docker |
| 2026-07-12 | `TypeError: expectAssertion.call is not a function` sur `expect(await axe(container)).toHaveNoViolations()` | Matcher `jest-axe` dépend d'internals Jest absents sous Vitest 4 | Abandon assumé (fallback prévu) : audit axe reporté à un futur job Playwright smoke |
| 2026-07-12 | `kill -TERM <pid>` sous Git Bash/Windows ne déclenche pas `process.on("SIGTERM")` sur un `node.exe` natif (exit 143 au lieu de 0) | Windows ne relaie pas les signaux POSIX comme Linux ; test local non probant | Vérifié dans le vrai conteneur Linux (`docker stop`) → exit 0 confirmé ; ne plus tester les signaux via Git Bash |

---

⚠️ Tout est committé et pushé ; **PR #2 (Docker multi-stage + worker + Node 24) reste ouverte, non mergée** en fin de session.
