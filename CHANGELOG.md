# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit [SemVer](https://semver.org/lang/fr/) — pas encore de tag posé à ce
stade (`[Unreleased]`).

## [Unreleased]

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
- CI GitHub Actions (`.github/workflows/ci.yml`) : lint, typecheck, format,
  couverture bloquante (80 %) et build sur chaque push `main` et pull request ;
  rapport de couverture publié en artefact + commentaire automatique sur les PR.
- README avec démarrage rapide (compose dev, migrations, `npm run dev`) et tableau
  des scripts npm, à la place du gabarit `create-next-app`.
- `Dockerfile` multi-stage (`node:24-slim`, non-root) : cible `app` (Next.js en
  sortie `standalone`) et cible `worker` (squelette `src/worker/index.ts`, souscrit
  à la file `entity-linking` via le port `JobQueue`, arrêt gracieux `SIGTERM`).
  `.dockerignore` ajouté. Node passé de 20 à 24 (Active LTS, requis par pg-boss
  `>=22.12`) en dev/CI/Docker — voir ADR-0008.

### Corrigé

- Les champs du formulaire de connexion/inscription se vidaient entièrement après
  une erreur de soumission (React 19 réinitialise les champs non contrôlés d'un
  `<form action>` dès résolution de l'action, même en erreur). Nom et e-mail sont
  désormais conservés ; le mot de passe reste volontairement vide. Voir
  `docs/plan-correction-bogues.md` (BUG-001).
