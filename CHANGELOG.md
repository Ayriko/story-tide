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
