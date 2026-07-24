# Critères de qualité et de performance — C2.1.1

> État au 2026-07-24 : qualité statique en place et vérifiée, **bloquante en CI**.
> Staging et production sont déployés depuis le 2026-07-18/23 (v1.0.0 à v1.2.1,
> voir `docs/cd.md`) et supervisés (`docs/supervision.md`) — mais les cibles de
> performance chiffrées ci-dessous n'ont pas fait l'objet d'une **mesure
> formelle enregistrée** à ce jour (pas de campagne de charge, pas de relevé
> p95/taux d'erreur documenté) : écart entre déploiement réel et mesure
> documentée, à combler avant la recette finale plutôt que passé sous silence.

## Qualité (statique)

- **ESLint** (`eslint-config-next` + `eslint-config-prettier`) : `npm run lint`
  (`eslint . --max-warnings=0`) — **0 warning toléré**.
- **TypeScript strict complet** : `noUncheckedIndexedAccess`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`,
  `forceConsistentCasingInFileNames` (utile Windows dev → VPS Linux, sensible à la
  casse) en plus de `strict`. `npm run typecheck` (`tsc --noEmit`).
- **Prettier** : `npm run format:check`, `.md` volontairement hors périmètre (prose
  docs-as-code, pas du code).
- **Seuil de couverture bloquant** : 80 % sur `src/lib` + `src/services` (détail
  dans `tests-unitaires.md`) — `npm run test:coverage`.
- Revue de diffs : pas d'outil dédié, relecture manuelle systématique avant chaque
  commit proposé cette session (typecheck+lint+format+build à chaque étape).

Tous ces gates sont **verts** au 2026-07-24 (lint 0 warning, `tsc` clean, 381/381
tests, couverture 98,13 % — cf. `docs/tests-unitaires.md`).

## Performance (runtime)

Cibles chiffrées actées dans la spec (§9.2) — **pas de mesure formelle
enregistrée** à ce jour, malgré le déploiement réel en staging/prod (aucune
campagne de charge menée, aucun relevé p95/taux d'erreur documenté) :

- Latence p95 des actions API < 500 ms (hors scan de liaison, asynchrone par design).
- Liaison automatique visible < 5 s après la fin du debounce de sauvegarde.
- Taux d'erreur applicative < 1 % sur fenêtre glissante.
- Disponibilité : healthcheck + uptime monitoring simple (pas de SLO contractuel).

Taille de bundle / requêtes N+1 : rien à mesurer, une seule route dynamique
(`/login`, `/register`) sans requête de données au-delà d'une lecture de session.

## Outils de suivi intégrés

- **CI GitHub Actions** (`.github/workflows/ci.yml`, détail dans `ci.md`) : lint,
  typecheck, format, couverture bloquante et build s'exécutent sur chaque push
  `main` et chaque pull request.
- **Rapport de couverture en artefact** : le dossier `coverage/` (HTML + lcov +
  json-summary) est publié comme artefact du run (14 j de rétention).
- **Commentaire de couverture sur les PR** : `davelosert/vitest-coverage-report-action`
  poste/actualise un résumé de couverture directement sur la pull request.
- **Monitoring runtime côté VPS** (supervision v1, C4.1.2) : en place depuis le
  2026-07-22 — healthcheck Docker + sonde externe Better Stack sur `/api/health`
  + heartbeat de sauvegarde, voir `docs/supervision.md`.
