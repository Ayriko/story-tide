# Protocole d'intégration continue (CI) — C2.1.2

> État au 2026-07-17 (KAN-34) : workflow GitHub Actions en place
> (`.github/workflows/ci.yml`), gates bloquants, smoke Playwright câblé. Pas de
> CD ici (images ghcr/SSH/VPS = étape ultérieure, le VPS n'est pas encore
> commandé).

## Étapes du pipeline

Quatre jobs **parallèles et indépendants** (aucun `needs` entre eux), déclenchés
sur push `main` et sur toute pull request (`concurrency` annule les runs
superseded d'une même branche) :

- **`quality`** — garde statique rapide : `actions/checkout` +
  `actions/setup-node` (Node 24, cache npm) → `npm ci` → `npm run format:check`
  (Prettier) → `npm run lint` (ESLint, `--max-warnings=0`) → `npm run typecheck`
  (`tsc --noEmit`, TS strict).
- **`test`** — `npm ci` → `npm run test:coverage` (Vitest + couverture v8,
  **seuil 80 % bloquant** sur `src/lib` + `src/services` — voir
  `tests-unitaires.md`) → publication du dossier `coverage/` en artefact
  (`actions/upload-artifact`, `if: always()`) → commentaire de couverture sur la
  PR (`davelosert/vitest-coverage-report-action`, `if: always() &&
  github.event_name == 'pull_request'`).
- **`build`** — `npm ci` → `npm run build` (`next build`).
- **`e2e`** — smoke Playwright (`e2e/smoke.spec.ts`, `e2e/link-highlight.spec.ts`).
  Seul job connecté à une **vraie base** : un service `postgres:16`
  (`POSTGRES_DB: story_tide_e2e`, healthcheck `pg_isready`) fournit la base que
  `DATABASE_URL` cible (override au niveau job — seule variable modifiée, les
  autres placeholders du workflow restent inchangés ; les garde-fous de
  `e2e/global-setup.ts` — hôte `localhost`, nom finissant par `_e2e` —
  s'appliquent tels quels). `npx playwright install --with-deps chromium` avant
  `npm run test:e2e` (les navigateurs ne sont pas préinstallés sur le runner).
  En cas d'échec : `test-results/` (traces Playwright, `trace: "retain-on-failure"`
  dans `playwright.config.ts` — nécessaire car `retries: 0` rend
  `"on-first-retry"` inopérant) publié en artefact (`if: failure()`).

**Pourquoi 3 jobs séparés (et pas 1 seul) :** incident du 2026-07-15 — un
`format:check` en échec dans le job unique interrompait le pipeline *avant*
`test:coverage`, donc `coverage/` n'existait jamais, et les étapes `if:
always()` du rapport de couverture plantaient en ENOENT au lieu de simplement
ne rien publier. En isolant `test` de `quality`, la couverture est désormais
**toujours calculée et publiée**, quel que soit l'état du lint/format — un
format cassé ne masque plus jamais le signal de couverture (C2.1.1/C2.2.2,
seuil bloquant). `build` reste un job à part (le plus lent) pour ne pas
ralentir le retour rapide de `quality`. `e2e` suit le même principe : isolé
pour que le smoke Playwright (le plus lent des quatre, installation des
navigateurs comprise) ne bloque ni ne soit bloqué par les trois autres.

Chaque job est bloquant indépendamment : un échec sur l'un n'empêche pas les
trois autres de tourner à terme, mais la PR/le push est rouge si l'un des
quatre échoue. `quality`/`test`/`build` ne se connectent à aucune vraie
base/MinIO — le bloc `env:` (au niveau workflow, partagé par les jobs) fournit
des **placeholders non-secrets** conformes au schéma Zod de `src/env.ts`
(nécessaires car `env.ts` est importé dès `prisma.config.ts`/les Server
Actions/`next build`) ; les adaptateurs SDK réels (`pg-boss-adapter.ts`,
`s3-adapter.ts`) sont exclus du calcul de couverture et vérifiés par script
d'intégration réel avant commit (voir ADR-0007). Seul `e2e` se connecte à une
vraie base (service `postgres:16` du job, `DATABASE_URL` overridé) — jamais à
MinIO, le smoke n'exerce pas le chemin upload.

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
- Hook Husky pre-commit local (`lint-staged` : ESLint --fix + Prettier sur
  fichiers stagés, puis `tsc --noEmit` sur tout le projet) fait office de
  première garde avant même le push ; la CI est la garde faisant foi (même
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
