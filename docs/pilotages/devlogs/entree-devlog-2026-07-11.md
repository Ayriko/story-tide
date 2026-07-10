### Session — 2026-07-11 — Scaffold Story Tide (durcissement → auth → ports infra → tests)

**Thèmes abordés :**
- Durcissement du squelette create-next-app (tsconfig strict, Prettier, `src/env.ts` Zod)
- `docker-compose.dev.yml` (Postgres + MinIO, healthchecks, bucket auto-créé)
- Schéma Prisma v1 (World/Entity/Relation/LinkIgnore) + migration `init`
- Better Auth (email+mdp, Server Actions, pages `/login` `/register` accessibles) + fix repopulation des champs
- Ports `JobQueue` (pg-boss) et `Storage` (S3/MinIO) + fakes mémoire
- Vitest + Testing Library + seuil de couverture actif + premiers tests

**Décisions prises :**
- **Prisma 7** (générateur `prisma-client`, adapter-pg, `prisma.config.ts`) plutôt que Prisma 6 (`prisma-client-js` classique) — version la plus récente, actée par Aymeric malgré la friction du client émis dans `src/generated/` — question posée explicitement (AskUserQuestion), tranchée par Aymeric.
- Bucket MinIO dev auto-créé par un service one-shot `minio-setup` (vs création manuelle) — tranché par Aymeric.
- Auth via **Server Actions + Zod** à la frontière plutôt que les méthodes client `authClient.*` idiomatiques — respecte la règle de couches du CLAUDE.md, proposition non contestée.
- Mot de passe **jamais** ré-affiché après une erreur de login/register (nom/email oui) — convention GitHub/GitLab, tranché par Aymeric (AskUserQuestion) suite à son retour manuel sur le bug de reset des champs.
- Policy pg-boss **`short`** sur les queues créées par l'adaptateur (au lieu de la policy par défaut `standard`) — nécessaire pour que `singletonKey` fasse réellement du dedup, découvert par vérification réelle (voir gotchas).
- Couverture Vitest : **exclusion** des wrappers fins de SDK externes (`pg-boss-adapter.ts`, `s3-adapter.ts`, `auth.ts`) du calcul — vérifiés par script d'intégration manuel, pas par unit test ; question posée explicitement (AskUserQuestion), tranchée par Aymeric. Étendu ensuite par moi-même (même justification, signalé mais non re-demandé) aux deux composition roots `queue/index.ts`/`storage/index.ts`.

**Éléments notables / appris (gotchas) :**
- `.gitignore` généré par create-next-app contenait `docs` et `CLAUDE.md` en fin de fichier → ces fichiers n'ont **jamais été trackés** malgré la consigne "déjà committé". Trouvé via `git ls-files | grep -E "^(docs/|CLAUDE.md)"` (vide). Corrigé par Aymeric en tout premier lieu.
- Prisma 7 : `Error code: P1012 ... The datasource property 'url' is no longer supported in schema files`. Le générateur `prisma-client` déplace la connexion vers `prisma.config.ts` et exige un adapter (`@prisma/adapter-pg` + `new PrismaPg({connectionString})` passé au `PrismaClient`). Non anticipé par la doc synthétisée (Context7 en quota dépassé) — confirmé via web fetch/search ciblés.
- **pg-boss `singletonKey` ne déduplique PAS avec la policy par défaut `standard`** (elle ne l'utilise que pour le throttle/debounce). Découvert en conditions réelles : un script jetable montrait un 2e `enqueue()` avec la même clé renvoyer un nouvel id au lieu de `null`. Corrigé en créant les queues avec `{ policy: "short" }`. **Candidat skill** : ce piège se reproduira à coup sûr au moteur de liaison auto (usage réel de `singletonKey`) si non documenté.
- **React 19 réinitialise les champs non contrôlés d'un `<form action={formAction}>` dès que l'action se résout, même en cas d'erreur** (pas seulement en succès, contrairement à ce que suggère une lecture rapide de react.dev). Confirmé par issues GitHub #29034 et #31649. Corrigé en renvoyant les valeurs soumises (hors mot de passe) dans l'état de l'action et en les réappliquant via `defaultValue`.
- Vitest : `src/env.ts` exécute `loadEnv()` au chargement du module ; sous Next.js `.env` est auto-chargé, pas sous Vitest → crash à l'import (`Variables d'environnement invalides : DATABASE_URL: Invalid input...`). Corrigé par `import "dotenv/config"` dans `vitest.setup.ts`.
- Vitest + Testing Library sans `test.globals: true` : pas d'`afterEach` global trouvé par RTL → pas d'auto-cleanup du DOM entre tests → `TestingLibraryElementError: Found multiple elements with the role "button"`. Corrigé par `afterEach(() => cleanup())` explicite dans le setup.
- TypeScript : Next.js type globalement `NodeJS.ProcessEnv.NODE_ENV` en union littérale (`'development'|'production'|'test'`), ce qui bloquait les tests simulant une valeur absente/invalide. `loadEnv` assoupli vers `Record<string, string | undefined>`.
- Extension Chrome de pilotage navigateur en panne sur **deux sessions consécutives** (timeout de script même sur `example.com`) — bascule systématique sur curl + psql pour la vérification réelle, documentée comme fallback établi.
- Windows/Node : crash `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` après `process.exit(0)` en fin de script de vérification pg-boss — artefact libuv au teardown, survient APRÈS que le script a loggé son succès complet ; sans rapport avec le code applicatif.

**Commandes utiles de la session :**
- `npx tsx --env-file=.env <script>.ts` — exécuter un script TS jetable avec les vraies env vars chargées, sans ts-node ; pratique pour vérifier une intégration (pg-boss, MinIO) en conditions réelles avant de committer.
- `npx @better-auth/cli generate --config src/lib/auth.ts -y` — génère/complète les modèles Prisma requis par Better Auth (source de vérité pour les `@unique` non documentés).
- `curl -s "https://hub.docker.com/v2/repositories/<image>/tags?page_size=25&ordering=last_updated"` — lister les tags Docker Hub récents pour épingler une image datée plutôt que `latest`.
- `docker compose -f docker-compose.dev.yml ps -a` — voir aussi les conteneurs one-shot déjà sortis (ex. `minio-setup`), invisibles avec `ps` seul.

**Livrables produits :**
- Commits : `c1dcacb` (durcissement), `9e3a850` (compose dev), `f750efe` (Prisma v1 + migration), `0485d55` (doc env), `f1bdd45` (Better Auth + pages, fix repopulation champs inclus), `2471829` (ports JobQueue/Storage), `0f5dc36` (Vitest + tests).
- État des gates en fin de session : lint ✅ (0 warning) · typecheck ✅ · format ✅ · build (dev + prod) ✅ · tests ✅ (30/30) · couverture `src/lib` : lignes 100 % · branches 100 % · fonctions 88,9 % · statements 100 % (seuil 80 % actif sur les 4 métriques, wrappers SDK et composition roots exclus).

**Avancement certification :**
- **C2.2.1** (architecture) : couches respectées (aucun Prisma importé hors `src/db`/`src/lib`), ports & adapters posés pour queue et storage. `/docs/architecture.md` **non mis à jour** (TODO toujours en place).
- **C2.2.2** (tests) : Vitest configuré, seuil de couverture bloquant actif et respecté sur le périmètre testé. `/docs/tests-unitaires.md` **non mis à jour**.
- **C2.2.3** (sécu/RGAA) : mesures codées (hash scrypt, cookies HttpOnly, message générique anti-énumération, labels natifs + `aria-describedby`/`aria-invalid`, focus visible vérifié manuellement) mais **`/docs/securite-owasp.md` et `/docs/accessibilite-rgaa.md` non remplis** cette session.
- **C2.4.1** (ADR) : plusieurs décisions structurantes non tracées en ADR (Prisma 7, policy pg-boss, exclusions de couverture) — **aucun ADR rédigé** cette session.
- **C2.1.2** (CI) : pas commencé.

**À faire / suite :**
- Étape 7 (prochaine demandée par Aymeric, reportée) : CI GitHub Actions — lint → typecheck → tests+couverture bloquante → build + job a11y axe-core.
- Étapes 8-10 restantes du plan de session initial : Dockerfile multi-stage, remplissage des docs/ADR (architecture, tests-unitaires, securite-owasp, ci, manuels/deploiement + ADR linker/stack + CHANGELOG.md racine), README lancement 3 commandes — **rien fait sur ce lot, à ne pas perdre**.
- Question ouverte : l'extension Chrome de pilotage navigateur est en panne depuis 2 sessions — à vérifier côté environnement si Aymeric veut des vérifications visuelles automatisées.
- Reporter cette entrée dans dev-log.md (hors repo) + redéposer dans le projet Claude.
- Mettre à jour le board Jira (stories touchées → bonne colonne).

---

**Décisions techniques**

| Date | Décision | Alternatives | Justification |
|---|---|---|---|
| 2026-07-11 | **Prisma 7** (générateur `prisma-client`, adapter-pg, `prisma.config.ts`) | Prisma 6 (`prisma-client-js` classique) | Version la plus récente actée avec Aymeric malgré la friction (client émis dans `src/generated`, `url` retiré du schéma) |
| 2026-07-11 | **Policy pg-boss `short`** sur les queues créées par l'adaptateur | Policy par défaut `standard` | `standard` n'applique `singletonKey` qu'au throttle, pas au dedup permanent — `short` = 1 job en attente max par clé, requis par spec §4.4.3 |
| 2026-07-11 | **Server Actions + Zod** pour l'auth (pas d'appel client Better Auth) | `authClient.signIn`/`signUp` idiomatiques | Respecte la frontière Zod+session imposée par l'architecture en couches |
| 2026-07-11 | **Exclusion des wrappers SDK fins** du calcul de couverture Vitest | Tout compter dans `src/lib`, tolérer un seuil rouge | Wrappers vérifiés par intégration manuelle réelle ; seuil reste honnête sur le code réellement unit-testable |

**Erreurs rencontrées & Solutions**

| Date | Symptôme (message exact) | Cause | Solution |
|---|---|---|---|
| 2026-07-11 | `Error code: P1012 ... The datasource property 'url' is no longer supported in schema files` | Prisma 7 retire `url` du bloc `datasource`, déplacé vers `prisma.config.ts` + adapter obligatoire | `prisma.config.ts` (`datasource.url` via env) + `@prisma/adapter-pg`, `new PrismaPg({connectionString})` en `adapter` du `PrismaClient` |
| 2026-07-11 | 2e `queue.enqueue(..., {singletonKey})` renvoie un nouvel id au lieu de `null` | Policy de queue par défaut pg-boss (`standard`) n'applique le dedup `singletonKey` qu'au throttle | `createQueue(name, { policy: "short" })` |
| 2026-07-11 | Champs de formulaire vides après une erreur de Server Action | React 19 réinitialise les champs non contrôlés d'un `<form action>` dès résolution de l'action, même en erreur (issues React #29034/#31649) | Renvoyer les valeurs soumises (hors mdp) dans l'état, réappliquer via `defaultValue` |
| 2026-07-11 | `TestingLibraryElementError: Found multiple elements with the role "button"` | Sans `test.globals: true`, RTL ne trouve pas d'`afterEach` global → pas d'auto-cleanup DOM | `afterEach(() => cleanup())` explicite dans `vitest.setup.ts` |

⚠️ Rien en attente de commit — tout ce qui est décrit ci-dessus est déjà committé, confirmé par Aymeric à chaque étape.
