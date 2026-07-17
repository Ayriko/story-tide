# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit [SemVer](https://semver.org/lang/fr/) — pas encore de tag posé à ce
stade (`[Unreleased]`).

## [Unreleased]

### Sécurité

- Contenu de fiche (Tiptap) : borne de taille (1 Mo) appliquée **avant** tout
  `JSON.parse` sur l'action de sauvegarde (mitigation DoS, OWASP A04).
- Contenu de fiche : validation des **valeurs** d'attributs côté serveur, en plus
  de la structure — `image.src`/`link.href` doivent être des URL `http`/`https`
  valides (rejet de `javascript:`/`data:`/chaînes non-URL) ; `image.alt` exigé
  non vide côté serveur (la règle RGAA n'était imposée que côté UI, contournable
  par appel direct de l'action). OWASP A03. (`tiptap-content.ts`,
  `TST-SEC-005` à `TST-SEC-008`)

### Ajouté

- Durcissement du squelette : `tsconfig.json` strict complet
  (`noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames`, etc.), Prettier +
  ESLint alignés, validation Zod des variables d'environnement (`src/env.ts`),
  `.env.example`.
- `docker-compose.dev.yml` : PostgreSQL + MinIO (healthchecks, volumes nommés,
  bucket dev auto-créé par un service `minio-setup`).
- Schéma Prisma v1 (`World`, `Entity` avec `aliases[]`/`plainText`, `Relation` avec
  `origin` MANUAL/AUTO, `LinkIgnore`) et première migration.
- Authentification email + mot de passe (Better Auth, adapter Prisma, sessions en
  base) : Server Actions + Zod, pages `/login` et `/register` accessibles (labels
  natifs, erreurs reliées aux champs, focus visible, navigation clavier).
- Ports d'infrastructure `JobQueue` (adaptateur pg-boss + fake mémoire) et `Storage`
  (adaptateur S3/MinIO + fake mémoire), suivant le patron ports & adapters.
- Vitest + Testing Library, seuil de couverture bloquant (80 % sur `src/lib` +
  `src/services`), premiers tests (`env.ts`, schémas Zod auth, fakes mémoire
  queue/storage, `LoginForm`).
- Documentation : ADR 0001-0008 (ligatures du linker, full Next.js, Tiptap, Better
  Auth, pg-boss, Prisma 7, exclusion de couverture des wrappers SDK, base Docker
  `node:24-slim`), premiers scénarios du cahier de recettes (`TST-AUT-*`,
  `TST-SEC-001`), mapping OWASP partiel, dossier RGAA partiel.
- Skill projet `.claude/skills/pgboss-singleton-dedup/` : documente le piège
  `singletonKey` (ne déduplique pas avec la policy pg-boss par défaut) et la
  correction (policy `short`), avec la procédure de vérification par script
  d'intégration réel avant commit.
- CI GitHub Actions (`.github/workflows/ci.yml`) : trois jobs **parallèles et
  indépendants** — `quality` (format, lint, typecheck), `test` (couverture
  bloquante 80 %, artefact + commentaire de PR), `build` (`next build`). Isolés
  pour qu'un échec de format/lint ne masque plus jamais le calcul de la
  couverture (incident du 2026-07-15 : un job unique interrompu avant
  `test:coverage` faisait planter en ENOENT les étapes de rapport `if:
  always()` faute de dossier `coverage/`). Voir `docs/ci.md`.
- README avec démarrage rapide (compose dev, migrations, `npm run dev`) et tableau
  des scripts npm, à la place du gabarit `create-next-app`.
- `Dockerfile` multi-stage (`node:24-slim`, non-root) : cible `app` (Next.js en
  sortie `standalone`) et cible `worker` (squelette `src/worker/index.ts`, souscrit
  à la file `entity-linking` via le port `JobQueue`, arrêt gracieux `SIGTERM`).
  `.dockerignore` ajouté. Node passé de 20 à 24 (Active LTS, requis par pg-boss
  `>=22.12`) en dev/CI/Docker — voir ADR-0008.
- Mondes (CRUD) : création, liste, renommage, suppression (confirmation en deux
  étapes, entièrement au clavier). Slug dérivé automatiquement du nom
  (`src/lib/slugify.ts`), jamais saisi ; collision gérée par suffixe (`-2`, `-3`...).
  Introduit la couche `src/services/` (`world-service.ts`) : autorisation par
  appartenance (`ownerId`) vérifiée à chaque opération, aucune fuite d'existence
  entre mondes de propriétaires différents. Layout applicatif protégé
  (`src/app/(app)/layout.tsx`, redirection `/login`). Scénarios `TST-MND-*` et
  `TST-SEC-002` au cahier de recettes, ligne A01 du mapping OWASP concrétisée.
- Entités (CRUD) : création, liste, modification, suppression au sein d'un monde
  (`src/services/entity-service.ts`), avec `type` en donnée libre (liste close
  Zod/UI) et `aliases[]` éditables dès la v1 (nettoyage/dédup côté schéma).
  Autorisation vérifiée **en cascade** (réutilise `getWorld()` de
  `world-service.ts`, pas de duplication) : une fiche d'un monde non possédé est
  inatteignable, même avec un `entityId` valide. `content`/`plainText`
  initialisés vides en attendant l'éditeur Tiptap. Page
  `/worlds/[slug]/entities/[entityId]`. Scénarios `TST-ENT-*` et `TST-SEC-003`
  au cahier de recettes, ligne A01 étendue.
- Éditeur Tiptap + auto-save (`EntityEditor`) : titres (H2/H3), gras/italique,
  listes, citation, lien (`http`/`https` uniquement), image (par URL, alt
  obligatoire — l'upload viendra avec le service `Storage`). Schéma de nodes/marks
  strict partagé client/serveur (`src/lib/tiptap-extensions.ts`), **validé côté
  serveur via le vrai schéma ProseMirror** (`src/lib/tiptap-content.ts`,
  `Node.fromJSON` + `check()`, pas un Zod fait main) — rejette tout contenu hors
  allowlist même envoyé hors de l'éditeur (OWASP A03, voir ADR-0009). Sauvegarde
  debouncée (1,5 s) via Server Action appelée directement (pas `<form>`),
  indicateur d'état `aria-live`. Extraction de `plainText` (texte brut, pour le
  futur scan de liaison + la recherche). Scénarios `TST-ENT-005`/`TST-SEC-004`
  au cahier de recettes, ligne A03 du mapping OWASP concrétisée.
- Moteur de liaison Aho-Corasick (`src/lib/linker/`), première brique du
  différenciateur produit : `normalizeForMatch` (casse repliée, accents
  retirés, **ligatures `œ`/`æ` préservées** — NFD et non NFKD, voir ADR-0001,
  nécessaire pour l'alignement caractère-exact des positions de surlignage) ;
  `AhoCorasick` (trie + liens d'échec + scan `O(n)` en un seul passage, plus
  long match prioritaire, frontières de mots, homonymes conservés). TS pur,
  zéro dépendance, 100 % couvert (dont un test de passage à l'échelle : ~200
  entités sur un texte de ~100 000 caractères, simulant un gros copier-coller/
  import). Reste à faire : dictionnaire par monde + cache, écriture des
  `Relation origin=AUTO`, filtre `LinkIgnore`, enfilage `JobQueue`, worker.
- Smoke Playwright (`e2e/smoke.spec.ts`) : parcours bout en bout inscription →
  monde → fiche → éditeur → auto-save → rechargement, sur un vrai navigateur
  Chromium. Isolation totale : base Postgres dédiée `story_tide_e2e` (même
  conteneur dev), remise à zéro (`DROP`/`CREATE SCHEMA` + `prisma migrate
  deploy`) avant chaque exécution via `e2e/global-setup.ts` — la base de dev
  n'est jamais ouverte. `next dev` comme serveur cible (reproduit React
  StrictMode). Couvre les 3 classes de bugs invisibles à un test unitaire ou un
  script `curl`/`tsx` (StrictMode, sérialisation Next.js Flight, Tailwind
  Preflight). Scénario `TST-ENT-006` au cahier de recettes. Câblage CI (service
  Postgres, cache navigateurs) : étape suivante, non encore fait.
- Hook Husky pre-commit (`husky` + `lint-staged`) : jusqu'ici documenté (CLAUDE.md,
  `docs/ci.md`, spec §10) mais **jamais réellement installé** — aucun `.husky/`,
  aucune dépendance `husky`/`lint-staged` au dépôt. C'est ce qui a permis à
  `src/lib/linker/normalize.ts` d'être committé non formaté et de casser le job
  `quality` de la CI après merge. Désormais réel : `.husky/pre-commit` lance
  `lint-staged` (ESLint --fix + Prettier sur les fichiers stagés uniquement),
  puis `tsc --noEmit` sur tout le projet (le typage ne se prête pas à une
  vérification par fichier isolé). Vérifié avec un fichier volontairement mal
  formaté avant nettoyage.
- Liaison automatique branchée de bout en bout (KAN-19, `src/services/linker-service.ts`) :
  `buildDictionary` (dictionnaire noms + alias par monde) ; `scanAndLinkEntity`
  (scan via le moteur Aho-Corasick, diff et upsert transactionnel des
  `Relation origin=AUTO` — **`MANUAL` jamais lu ni écrit**, filtre explicite sur
  toutes les requêtes) ; garde-fous : auto-mention exclue, `LinkIgnore` respecté,
  occurrence ambiguë (homonymes aux mêmes bornes) → aucune relation créée pour
  aucune des deux entités (le marquage « ambigu » cliquable reste backlog KAN-19,
  nécessite un modèle de données dédié). Enfilage réel depuis
  `saveEntityContentAction` après sauvegarde (`entity-linking`,
  `singletonKey=entityId` — un échec d'enfilage est loggué mais ne fait pas
  échouer la sauvegarde, déjà persistée à ce stade) ; le worker exécute
  désormais réellement le scan (remplace le `console.log` TODO). Nom de file et
  forme du job extraits dans `src/lib/queue/entity-linking.ts` pour que
  producteur et consommateur ne puissent jamais diverger. Vérifié en conditions
  réelles (vraie base Postgres, vrai adaptateur pg-boss, vrai worker) : mention
  détectée → relation créée ; mention disparue → relation supprimée ; relation
  `MANUAL` jamais écrasée par un re-scan. Cache/invalidation de l'automate par
  monde (prévu spec §4.4) délibérément reporté — reconstruction à chaque job,
  largement dans le budget perf. Scénarios `TST-LNK-001` à `TST-LNK-003` au
  cahier de recettes.
- Surlignage live des liaisons dans l'éditeur + navigation (ADR-0010) : les
  mentions d'entités existantes sont soulignées en direct pendant la frappe
  (décoration ProseMirror, jamais persistée) via un **re-scan côté client** du
  même moteur Aho-Corasick — pas d'attente du worker, pas d'impact sur le
  schéma de contenu partagé. `src/lib/tiptap-positions.ts`
  (`buildTextWithPositions`/`occurrenceToRange`) remappe les positions du scan
  vers de vraies positions ProseMirror, avec le même séparateur de bloc que
  `extractPlainText` (identité vérifiée par test sur plusieurs formes de
  documents). `resolveLinks` (`src/lib/linker/resolve-links.ts`) est extrait de
  `scanAndLinkEntity` et partagé entre le worker et le surlignage : ce qui est
  surligné est exactement ce qui devient une `Relation`. Navigation à deux
  chemins : **Ctrl/Cmd+clic** sur une mention surlignée (clic simple = édition
  normale, jamais de navigation accidentelle) ou la liste accessible « Entités
  liées » sous l'éditeur (`<nav>`/`<Link>`, navigable clavier/lecteur d'écran —
  le surlignage seul n'est qu'une affordance souris, cf.
  `docs/accessibilite-rgaa.md`). `src/services/relation-service.ts`
  (`getIgnoredTargetIds`, `listOutgoingLinks`). Vérifié en conditions réelles
  bout en bout (`e2e/link-highlight.spec.ts` : vrai navigateur, vrai worker,
  vraie base Postgres isolée — le worker est désormais démarré par
  `e2e/global-setup.ts` pour tout le run e2e). Scénario `TST-LNK-004` au
  cahier de recettes.
- Backlinks (KAN-24) : chaque fiche affiche désormais une section « Mentionné
  par » (relations entrantes, AUTO et MANUAL confondues), symétrique de
  « Entités liées ». `listIncomingLinks` (`src/services/relation-service.ts`)
  résout le `sourceId` de chaque `Relation` ciblant l'entité via deux requêtes
  à select plat (même raisonnement que `listOutgoingLinks`, cf. skill
  `prisma-mock-partial-select`) ; le type `OutgoingLink` est renommé
  `LinkedEntity` (sert désormais aux deux sens). Le composant
  `LinkedEntities` (`linked-entities.tsx`) est généralisé avec des props
  `label`/`emptyLabel` pour éviter la duplication de markup entre les deux
  sections, chacune gardant un `aria-label` distinct (RGAA). Scénario
  `TST-LNK-005` au cahier de recettes.
- Clôture de l'abstraction stockage (KAN-11) : `src/lib/storage/s3-adapter.test.ts`
  couvre la traduction adapter → SDK (`PutObjectCommand`/`DeleteObjectCommand`/
  `GetObjectCommand`, `forcePathStyle: true` requis par MinIO, expiration par
  défaut de l'URL signée) ; point d'extension vers OVH Object Storage documenté
  (`docs/spec-technique-bloc2.md` §4.1).
- Câblage CI du smoke Playwright (KAN-34) : job `e2e` dans
  `.github/workflows/ci.yml`, isolé des trois autres (même principe que
  `quality`/`test`, voir `docs/ci.md`). Service `postgres:16`
  (`POSTGRES_DB: story_tide_e2e`, healthcheck) fournit la base réelle ciblée
  par `DATABASE_URL` (seul override au niveau job) ; `npx playwright install
  --with-deps chromium` puis `npm run test:e2e`. `playwright.config.ts` :
  `trace: "retain-on-failure"` (remplace `"on-first-retry"`, inopérant avec
  `retries: 0`) pour que l'artefact `test-results/` publié en cas d'échec
  (`if: failure()`) contienne réellement une trace exploitable.
- Déconnexion (KAN-12) : `logoutAction` (`src/actions/auth.ts`) appelle
  `auth.api.signOut` puis redirige vers `/login` — y compris si `signOut`
  échoue (session déjà expirée), la cause réelle étant systématiquement
  logguée plutôt qu'avalée. Bouton natif dans le header `(app)`
  (`src/app/(app)/layout.tsx`, affiche aussi l'e-mail de l'utilisateur
  connecté), focus visible cohérent avec le reste de la navigation (RGAA).
  Scénario `TST-AUT-008` au cahier de recettes.
- Mentions manuelles @ (KAN-22) : node `mention` (`@tiptap/extension-mention`,
  `src/lib/tiptap-extensions.ts`) partagé serveur/client, rendu identique au
  surlignage AUTO (même classe/attribut DOM, aucun `@` affiché) et exclu du
  `plainText`/scan AUTO (`renderText: () => ""`, évite l'auto-détection de sa
  propre mention). Popup de suggestion (`mention-list.tsx`, `ReactRenderer` +
  `@tiptap/suggestion`, positionnement natif Floating UI — pas de tippy.js) :
  navigation clavier ↑/↓/Entrée, `aria-activedescendant`, filtrage insensible
  casse/accents (`filterMentionSuggestions`). Réconciliation **synchrone** des
  `Relation origin=MANUAL` à la sauvegarde (`reconcileManualMentions`,
  `extractMentionedEntityIds`) : diff ajout/suppression comme `scanAndLinkEntity`
  mais toujours filtré `origin: MANUAL` (coexiste avec AUTO sans collision,
  `@@unique([sourceId, targetId, origin])`) ; les id mentionnés sont revalidés
  contre le monde réel avant toute écriture (OWASP A01, jamais de confiance
  dans l'input client). Voir ADR-0011. Vérifié en conditions réelles bout en
  bout (`e2e/manual-mention.spec.ts`) — a révélé et corrigé un bug réel
  (`allowSpaces: true` requis pour les noms d'entités composés, sans quoi la
  popup se ferme au premier espace tapé). Scénario `TST-LNK-006` au cahier de
  recettes.
- Graphe de relations (KAN-25, `/worlds/[slug]/graph`) : rendu **Cytoscape.js**
  (déjà acté, cf. ADR-0012 — pas react-flow comme proposé par un audit externe,
  Cytoscape rend nativement sur un seul `<canvas>` donc aucune phase de
  migration à prévoir). `listWorldRelations` (`relation-service.ts`),
  `buildGraphElements`/`buildAccessibleGraphEntries` (`src/lib/graph-elements.ts`,
  fonctions pures testées isolément). Filtrage par type (`ENTITY_TYPES`,
  checkboxes natifs, sans recréer l'instance Cytoscape). Navigation cliquable
  sur un nœud (`router.push`). Chemin accessible dédié `GraphAccessibleList`
  (`<nav>` + vrais `<Link>`, RGAA — le canvas n'expose aucun élément individuel
  au clavier). Bug réel trouvé et corrigé pendant l'implémentation : layout
  `cose` animé par défaut, une frame différée pouvait s'exécuter après
  `cy.destroy()` au démontage et planter (`Cannot read properties of null
  (reading 'notify')`, reproduit par `e2e/graph.spec.ts`) — corrigé par
  `animate: false`. Vérifié en conditions réelles bout en bout
  (`e2e/graph.spec.ts`). Scénarios `TST-GRF-001` à `TST-GRF-003` au cahier de
  recettes.

### Corrigé

- Les champs du formulaire de connexion/inscription se vidaient entièrement après
  une erreur de soumission (React 19 réinitialise les champs non contrôlés d'un
  `<form action>` dès résolution de l'action, même en erreur). Nom et e-mail sont
  désormais conservés ; le mot de passe reste volontairement vide. Voir
  `docs/plan-correction-bogues.md` (BUG-001).
- Textes affichés à l'utilisateur (auth : messages d'erreur, libellés de bouton)
  sans accents français par mimétisme avec la convention des commentaires de code
  (évitée là pour une vraie raison d'encodage Windows, non pertinente pour du
  texte UI). Corrigé avec de vrais accents ; tout le texte UI livré depuis
  (mondes, entités) en tient compte dès l'origine.
