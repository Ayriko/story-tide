# Harnais de tests unitaires — C2.2.2 (ÉLIMINATOIRE)

> Vitrine naturelle à terme : le moteur Aho-Corasick (`src/lib/linker/`), pas encore codé.
> État au 2026-07-14 : outillage en place, démonstrateur actuel = code métier réellement
> livré (auth, ports infra, Mondes, Entités, éditeur Tiptap/validation de contenu).

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
- **Prisma mocké** (`vi.mock("@/db/client")`) pour tous les tests de service — aucun
  test n'ouvre de connexion réelle à Postgres (cohérent avec le commentaire du job CI).
  Les scénarios en conditions réelles (base de dev réelle, plusieurs comptes) sont
  vérifiés manuellement via script `tsx` jetable avant chaque commit, pas en CI.

## Fonctionnalité couverte (démonstrateur actuel)

- `src/env.ts` : validation Zod des variables d'environnement (cas valides, valeurs
  par défaut, rejets ciblés par variable).
- `src/lib/auth-schemas.ts`, `src/lib/world-schemas.ts`, `src/lib/entity-schemas.ts` :
  schémas Zod (trim, contraintes de longueur, rejets, nettoyage/dédup des alias).
- `src/lib/slugify.ts` : dérivation de slug (accents, ponctuation, repli sur nom vide).
- `src/lib/auth-session.ts` : `requireSession()` (lève une erreur typée) et
  `requireSessionOrRedirect()` (redirige), session présente/absente.
- `src/lib/tiptap-content.ts` : validation du JSON ProseMirror contre le schéma strict
  de l'éditeur (accepte les nodes/marks autorisés, **rejette un node hors allowlist**
  comme `codeBlock` désactivé — OWASP A03) et extraction de `plainText`.
- `src/lib/queue/memory-adapter.ts` : dedup par `singletonKey`, `work`/`drain`,
  sémantique de retry (job qui échoue reste en attente).
- `src/lib/storage/memory-adapter.ts` : upload/delete/URL signée déterministe.
- `src/services/world-service.ts` : CRUD, autorisation par `ownerId` (cas passants et
  cas d'échec « monde d'autrui »), dérivation/collision de slug.
- `src/services/entity-service.ts` : CRUD, **autorisation en cascade** (réutilise
  `getWorld` du service Mondes), cas d'échec « monde d'autrui » et « mauvais
  worldId », `updateEntityContent`.
- `src/actions/entity-content.ts` : action d'auto-save (validation, extraction,
  mapping des erreurs — session absente, contenu invalide, fiche introuvable).
- `LoginForm`, `CreateWorldForm`, `CreateEntityForm` : association label/champ,
  message d'erreur générique relié au formulaire (`role="alert"`), `aria-describedby`/
  `aria-invalid` sur le champ en erreur. `LoginForm` porte en plus le **test de
  non-régression** du bug de re-remplissage des champs après erreur (cf.
  `plan-correction-bogues.md` BUG-001).

**Non testé via Testing Library (assumé, pas un oubli)** : le composant interactif
`EntityEditor` (éditeur Tiptap réel) n'a pas de test de rendu RTL — `contentEditable`/
la sélection ProseMirror sont mal supportés par jsdom (flakiness connue, faible valeur
ajoutée). Sa **logique de données** (validation du contenu, extraction du texte,
action d'auto-save) est en revanche testée à 100 % côté `src/lib`/`src/actions`. Le
rendu réel de l'éditeur (toolbar, saisie, auto-save visible) a été vérifié en
conditions réelles (build + chargement du bundle client + round-trip base réelle),
mais pas cliqué dans un vrai navigateur cette session (extension Chrome de pilotage
en panne, cf. dev-log). À couvrir par le futur smoke Playwright (spec §7).

À venir avec le moteur de liaison (cas limites : accents, alias, frontières de mots,
homonymes).

## Couverture

Rapport `npm run test:coverage` au 2026-07-14 (périmètre `src/lib/**` +
`src/services/**`, wrappers exclus, cf. ci-dessus) :

| Métrique | Résultat | Seuil |
|---|---|---|
| Lignes | 100 % | 80 % |
| Branches | 100 % | 80 % |
| Fonctions | 97,1 % | 80 % |
| Statements | 100 % | 80 % |

97 tests, 15 fichiers de test. Rapport HTML/LCOV généré dans `/coverage` (gitignoré),
publié en artefact CI + commentaire de PR (cf. `ci.md`).
