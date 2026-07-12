# ADR-0006 — Prisma 7 (générateur `prisma-client` + adapter-pg)

- **Statut** : accepté
- **Date** : 2026-07-10
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Prisma est déjà acté comme ORM depuis le Bloc 1 (C1.3.2, choix figé : contexte
conteneur long-running sur VPS). Au moment d'écrire le schéma Prisma v1 (session du
2026-07-10), la version disponible sur npm était Prisma **7.8.0** — une rupture
majeure par rapport aux versions précédentes : le générateur `prisma-client-js` est
déprécié au profit de `prisma-client`, qui **exige** un `output` explicite (le
client est émis dans l'arbre source, ex. `src/generated/prisma`, plus dans
`node_modules`) ; le champ `datasource.url` n'est plus supporté dans
`schema.prisma` (déplacé vers `prisma.config.ts`) ; `PrismaClient` exige désormais
un `adapter` explicite (`@prisma/adapter-pg` pour PostgreSQL). Rencontré en
conditions réelles : l'erreur **`P1012`** (« The datasource property 'url' is no
longer supported in schema files ») tant que l'adapter n'était pas câblé.

## Options envisagées

- **Prisma 6** (`prisma-client-js` classique, client dans `node_modules`) : aucune
  friction, tous les tutoriels l'assument, mais version qui datera vite.
- **Prisma 7** (dernière version, `prisma-client` + adapter) : câblage initial plus
  lourd (gitignore, ignores ESLint/Prettier, `postinstall: prisma generate`,
  `prisma.config.ts`) mais aligné sur la direction actuelle du projet.

## Décision

Prisma 7, actée explicitement avec Aymeric (question posée directement, réponse :
la dernière version). Câblage : `prisma.config.ts` (connexion lue depuis les env
vars), `@prisma/adapter-pg` + `PrismaPg` passé au constructeur `PrismaClient`
(`src/db/client.ts`), client généré dans `src/generated/prisma` (gitignoré,
régénéré automatiquement via le script npm `postinstall`).

## Conséquences

- **Positives** : aligné sur la version la plus récente et la plus longtemps
  supportée ; le typage du client généré n'a soulevé aucun conflit avec le TS strict
  du projet (`noUncheckedIndexedAccess` etc.), vérifié par `tsc --noEmit`.
- **Négatives (dette assumée)** : davantage de fichiers de configuration qu'avec
  `prisma-client-js` ; toute CI devra explicitement lancer `prisma generate` avant le
  build, le client n'étant ni commité ni présent par défaut dans `node_modules`.

## Compétence(s) servie(s)

C2.2.1 (choix technologique tracé) ; C2.4.1 (justification des choix). **Codé et
vérifié** cette session (commit `f750efe`, migration réelle appliquée sur
PostgreSQL, confirmée via `psql`).
