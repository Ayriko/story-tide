# Harnais de tests unitaires — C2.2.2 (ÉLIMINATOIRE)

> Vitrine naturelle à terme : le moteur Aho-Corasick (`src/lib/linker/`), pas encore codé.
> État au 2026-07-11 : outillage en place, démonstrateur actuel = code métier réellement livré (auth, ports infra).

## Outillage

- **Vitest 4** (`vitest.config.ts`), environnement `jsdom`, alias `@/*` résolu manuellement
  (pas de `vite-tsconfig-paths`, un seul alias à mapper).
- **Testing Library** (`@testing-library/react` + `@testing-library/user-event` +
  `@testing-library/jest-dom`) pour les composants.
- **Seuil de couverture bloquant** (`@vitest/coverage-v8`) : 80 % lignes/branches/
  fonctions/statements sur `src/lib/**` + `src/services/**`. Wrappers fins de SDK
  externes (`pg-boss-adapter.ts`, `s3-adapter.ts`, `auth.ts`) et composition roots
  (`queue/index.ts`, `storage/index.ts`) exclus du calcul — vérifiés par script
  d'intégration manuel contre l'infra réelle, pas par unit test (mocker tout le SDK
  n'apporterait pas d'assurance supplémentaire).
- Scripts : `npm run test` · `npm run test:watch` · `npm run test:coverage`.
- `vitest.setup.ts` : charge `.env` (`dotenv/config`, absent par défaut sous Vitest,
  contrairement à Next.js) et nettoie le DOM après chaque test (`afterEach(cleanup)`,
  nécessaire car `test.globals` est désactivé — pas d'`afterEach` global pour que
  Testing Library s'y accroche automatiquement).

## Fonctionnalité couverte (démonstrateur actuel)

- `src/env.ts` : validation Zod des variables d'environnement (cas valides, valeurs
  par défaut, rejets ciblés par variable).
- `src/lib/auth-schemas.ts` : schémas Zod `registerSchema`/`loginSchema` (trim,
  contraintes de longueur, rejets).
- `src/lib/queue/memory-adapter.ts` : dedup par `singletonKey`, `work`/`drain`,
  sémantique de retry (job qui échoue reste en attente).
- `src/lib/storage/memory-adapter.ts` : upload/delete/URL signée déterministe.
- `LoginForm` (`src/app/(auth)/login/login-form.tsx`) : association label/champ,
  message d'erreur générique relié au formulaire (`role="alert"`), `aria-describedby`/
  `aria-invalid` sur le champ en erreur, et **test de non-régression** du bug de
  re-remplissage des champs après erreur (cf. `plan-correction-bogues.md` BUG-001).

À venir avec le moteur de liaison (cas limites : accents, alias, frontières de mots,
homonymes) et les services (authz, quotas CRUD).

## Couverture

Rapport `npm run test:coverage` au 2026-07-11 (périmètre `src/lib/**` +
`src/services/**`, wrappers exclus, cf. ci-dessus) :

| Métrique | Résultat | Seuil |
|---|---|---|
| Lignes | 100 % | 80 % |
| Branches | 100 % | 80 % |
| Fonctions | 88,9 % | 80 % |
| Statements | 100 % | 80 % |

30 tests, 5 fichiers de test. Rapport HTML/LCOV généré dans `/coverage` (gitignoré) —
à publier en artefact CI dès l'étape pipeline (cf. `ci.md`, pas encore construit).
