# Critères de qualité et de performance — C2.1.1

> État au 2026-07-11 : qualité statique en place et vérifiée. Performance = cibles de la spec, pas encore mesurées (rien n'est déployé).

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

Tous ces gates sont **verts** au 2026-07-11 (dernière vérification : étape Vitest,
commit `0f5dc36`).

## Performance (runtime)

Cibles chiffrées actées dans la spec (§9.2) — **pas encore mesurées**, rien n'est
déployé ni chargé en conditions réelles :

- Latence p95 des actions API < 500 ms (hors scan de liaison, asynchrone par design).
- Liaison automatique visible < 5 s après la fin du debounce de sauvegarde.
- Taux d'erreur applicative < 1 % sur fenêtre glissante.
- Disponibilité : healthcheck + uptime monitoring simple (pas de SLO contractuel).

Taille de bundle / requêtes N+1 : rien à mesurer, une seule route dynamique
(`/login`, `/register`) sans requête de données au-delà d'une lecture de session.

## Outils de suivi intégrés

<!-- TODO : ce qui tournera en CI (rapport de couverture en artefact, commentaire de
PR) + monitoring léger côté VPS. Arrivera avec ci.md et le déploiement, pas construits
à ce stade. -->
