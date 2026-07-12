# ADR-0007 — Exclusion des wrappers SDK fins du calcul de couverture Vitest

- **Statut** : accepté
- **Date** : 2026-07-11
- **Décideur** : Aymeric (MOE) — tranché explicitement (AskUserQuestion), étendu
  ensuite aux composition roots (signalé, non re-demandé)

## Contexte et problème

Un seuil de couverture bloquant (80 % sur lignes/branches/fonctions/statements) est
actif sur `src/lib` + `src/services` (`vitest.config.ts`, `coverage.thresholds`).
Certains fichiers sont de **fins wrappers** autour de SDK externes
(`src/lib/queue/pg-boss-adapter.ts`, `src/lib/storage/s3-adapter.ts`,
`src/lib/auth.ts`) et deux **composition roots** (`src/lib/queue/index.ts`,
`src/lib/storage/index.ts`) qui ne font qu'instancier l'adaptateur réel depuis les
variables d'environnement. Les unit-tester reviendrait à mocker le SDK et à tester
le mock, sans valeur ; ils sont en revanche couverts par des **scripts
d'intégration réels** (pg-boss, MinIO) exécutés en conditions réelles avant commit.

## Options envisagées

- **Tout compter dans `src/lib` et tolérer un seuil rouge sur ces fichiers.** Rend
  le seuil non bloquant en pratique (on s'habitue au rouge) → perd sa valeur de
  garde-fou.
- **Écrire des unit tests sur les wrappers en mockant le SDK.** Teste le mock, pas
  l'intégration ; faux sentiment de sécurité, maintenance inutile.
- **Exclure ces fichiers du calcul de couverture** (`coverage.exclude`), en gardant
  le seuil bloquant sur tout le reste : retenu.

## Décision

Exclure `src/lib/queue/pg-boss-adapter.ts`, `src/lib/storage/s3-adapter.ts`,
`src/lib/auth.ts`, `src/lib/queue/index.ts` et `src/lib/storage/index.ts` du calcul
de couverture Vitest (`vitest.config.ts`, `coverage.exclude`). Le seuil de 80 %
(bloquant) reste actif sur tout le code réellement unit-testable de `src/lib` et
`src/services`.

## Conséquences

- **Positives** : le seuil reste **honnête et bloquant** sur le code métier ; les
  wrappers sont validés là où ça compte (intégration réelle contre l'infra Docker).
- **Négatives (dette assumée)** : les exclusions doivent rester **justifiées et
  minimales** — toute nouvelle exclusion doit être motivée (risque de dérive « on
  exclut ce qui échoue »). La liste est à auditer à chaque revue de couverture.

## Compétence(s) servie(s)

C2.2.2 (tests, couverture) ; C2.4.1 (décision tracée). **Codé et vérifié** cette
session (commit `0f5dc36`).
