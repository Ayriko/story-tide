# Protocole d'intégration continue (CI) — C2.1.2

> État au 2026-07-12 : workflow GitHub Actions en place
> (`.github/workflows/ci.yml`), gates bloquants. Pas de CD ici (images ghcr/SSH/VPS
> = étape ultérieure, le VPS n'est pas encore commandé).

## Étapes du pipeline

Un seul job (`ci`), déclenché sur push `main` et sur toute pull request
(`concurrency` annule les runs superseded d'une même branche) :

1. `actions/checkout` + `actions/setup-node` (Node 20, cache npm sur
   `package-lock.json`).
2. `npm ci` — installe les dépendances et régénère le client Prisma
   (`postinstall: prisma generate`).
3. `npm run format:check` (Prettier).
4. `npm run lint` (ESLint, `--max-warnings=0`).
5. `npm run typecheck` (`tsc --noEmit`, TS strict).
6. `npm run test:coverage` (Vitest + couverture v8, **seuil 80 % bloquant** sur
   `src/lib` + `src/services` — voir `tests-unitaires.md`).
7. `npm run build` (`next build`).

Chaque étape est bloquante : un échec à n'importe laquelle interrompt le job.
Aucune étape ne se connecte à une vraie base/MinIO — le job fournit des
**placeholders non-secrets** conformes au schéma Zod de `src/env.ts` (nécessaires
car `env.ts` est importé dès `prisma.config.ts`/les Server Actions/`next build`) ;
les adaptateurs SDK réels (`pg-boss-adapter.ts`, `s3-adapter.ts`) sont exclus du
calcul de couverture et vérifiés par script d'intégration réel avant commit (voir
ADR-0007).

**Couverture (C2.1.1)** : le dossier `coverage/` (HTML + lcov + json-summary) est
publié en artefact du run (`actions/upload-artifact`, rétention 14 j) ; sur les
pull requests, `davelosert/vitest-coverage-report-action` poste/actualise un
commentaire récapitulatif directement sur la PR.

**Accessibilité automatisée** : une tentative de brancher `jest-axe` dans le job
test a été faite et abandonnée (le matcher `toHaveNoViolations` dépend
d'internals Jest incompatibles avec Vitest 4 — `expectAssertion.call is not a
function`). L'audit axe reste à faire pleine-page, probablement via le futur job
Playwright smoke ; voir `accessibilite-rgaa.md`.

## Règles de fusion

- Branche `main` : les commits directs restent possibles en solo (pas de
  protection de branche configurée à ce stade — un seul développeur), mais toute
  PR doit avoir le workflow CI vert avant fusion.
- Conventional commits (feat/fix/test/docs/chore) — voir `CLAUDE.md`.
- Hook Husky pre-commit local (lint + typecheck sur fichiers stagés) fait office
  de première garde avant même le push ; la CI est la garde faisant foi (même
  environnement pour tout le monde, contrairement au poste local).

## Réduction des régressions

- Le seuil de couverture bloquant (C2.2.2) empêche qu'une feature soit fusionnée
  sans ses tests — voir `tests-unitaires.md` pour le détail outillage/couverture.
- Tout correctif de bug doit être accompagné d'un test de non-régression
  (`plan-correction-bogues.md`), qui tourne ensuite à chaque run CI comme les
  autres tests.
- Les scénarios du cahier de recettes (`cahier-recettes.md`) restent une
  vérification manuelle/staging complémentaire à la CI, pas remplacée par elle
  (pas d'environnement de recette automatisé à ce stade).
