# Architecture logicielle — C2.2.1 (ÉLIMINATOIRE)

> Posture actée : « l'architecture la plus simple qui couvre le besoin, justifiée. » Pas de microservices.
> État au 2026-07-24 : périmètre Bloc 2 livré en production (v1.2.1) — en plus du
> socle décrit ci-dessous (2026-07-14 : auth, Mondes/Entités, éditeur Tiptap),
> le moteur de liaison automatique (Aho-Corasick), l'upload/redimensionnement
> d'image, le graphe de relations (Cytoscape), la recherche, les quotas
> freemium, les mentions manuelles et le monde d'introduction sont livrés et
> testés. Le détail chronologique de chaque livraison vit dans `CHANGELOG.md` ;
> les patrons d'architecture ci-dessous restent la référence à jour, la section
> « Prototype fonctionnel » documente l'état initial et n'a pas été
> ré-énumérée depuis (voir la note qui la clôt).

## Vue d'ensemble

Monolithe **Next.js App Router** (RSC + Server Actions), un seul déploiement pour l'app,
un **worker Node séparé** (`src/worker/index.ts`) consomme la file de jobs pg-boss
(souscription à la file `entity-linking`, arrêt gracieux SIGTERM) et exécute
réellement le scan Aho-Corasick (`scanAndLinkEntity`, `src/services/linker-service.ts`)
depuis la v1.0.0. Un seul
système stateful : **PostgreSQL**, qui porte à la fois les données applicatives
(Prisma) et la file `pg-boss` (schéma `pgboss`, géré par pg-boss lui-même). **MinIO**
(S3-compatible) pour les binaires utilisateurs uniquement, buckets privés.

Deux images Docker construites depuis le même `Dockerfile` multi-stage (`node:24-slim`,
non-root) : cible `app` (sortie `next build` standalone) et cible `worker` (exécuté via
`tsx`) — voir ADR-0008.

Réutiliser/adapter le diagramme C4 du Bloc 1 (archi.png / archi.js) — pas encore refait
à ce stade de l'implémentation.

## Paradigmes & patrons

- **Ports & adapters** implémentés et vérifiés en conditions réelles :
  - `src/lib/queue/` : port `JobQueue` (`enqueue`/`work`/`stop`), adaptateur
    `PgBossQueueAdapter` (pg-boss, queues créées en policy `short` pour que
    `singletonKey` fasse réellement du dedup — cf. ADR-0005), fake `MemoryQueueAdapter`
    pour les tests.
  - `src/lib/storage/` : port `Storage` (`upload`/`delete`/`getSignedUrl`), adaptateur
    `S3StorageAdapter` (MinIO, `forcePathStyle`), fake `MemoryStorageAdapter`.
- **Repository via Prisma** : point d'accès unique `src/db/client.ts` (singleton,
  adapter-pg — cf. ADR-0006). Aucun autre fichier n'importe Prisma directement.
- **Frontière Zod + session** sur les Server Actions : `src/actions/auth.ts` parse via
  `src/lib/auth-schemas.ts` avant tout appel métier (`auth.api.*`) ; `src/actions/world.ts`
  suit le même patron via `requireSession()` (`src/lib/auth-session.ts`).
- **Couche `src/services/`** introduite avec la feature Mondes
  (`src/services/world-service.ts`) : logique métier + autorisation (appartenance au
  monde vérifiée par `ownerId` à chaque opération, jamais seulement en UI). Les Server
  Actions et les RSC appellent le service, jamais Prisma directement.
- **Autorisation en cascade entre services** : `entity-service.ts` ne duplique pas la
  vérification d'appartenance au monde, il **réutilise** `getWorld()` de
  `world-service.ts` avant tout accès à une fiche — un monde non possédé bloque l'accès
  à ses entités avant même de les chercher. Patron à reproduire pour toute ressource
  imbriquée dans un monde (relations, futur graphe).
- **Schéma de contenu partagé client/serveur** : `src/lib/tiptap-extensions.ts` définit
  une seule fois l'allowlist de nodes/marks de l'éditeur, utilisée à la fois par le
  composant client (`EntityEditor`) et par la validation serveur
  (`src/lib/tiptap-content.ts`, `parseContent`/`extractPlainText`) — même schéma des
  deux côtés, jamais de dérive. La validation reconstruit un vrai document ProseMirror
  (`Node.fromJSON` + `check()`) plutôt qu'un schéma Zod ad hoc pour un AST récursif.
- **Server Action appelée directement (pas via `<form>`)** : l'auto-save
  (`src/actions/entity-content.ts`) est invoquée comme une fonction async depuis le
  composant client, debouncée côté client — pattern différent des actions
  create/update/delete (qui utilisent `useActionState` + `redirect`), car l'auto-save
  ne navigue jamais et doit pouvoir se déclencher sur un timer/évènement, pas seulement
  une soumission de formulaire.

## Prototype fonctionnel

Fonctionnalités livrées à ce jour :
- **Authentification** (inscription, connexion, déconnexion via l'API Better Auth,
  session en base, redirection si déjà connecté). Pages `/login` et `/register`.
- **Mondes (CRUD)** : création, liste, renommage, suppression (confirmation en deux
  étapes). Slug dérivé automatiquement du nom (`src/lib/slugify.ts`), jamais saisi.
  Pages `/worlds` et `/worlds/[slug]` sous un layout applicatif protégé
  (`src/app/(app)/layout.tsx`, redirection `/login` si session absente).
- **Entités (CRUD)** : création, liste, modification, suppression au sein d'un monde.
  `type` en donnée libre (`String`, pas d'enum Prisma — liste close côté Zod/UI
  `src/lib/entity-schemas.ts`), `aliases[]` éditables dès la v1 (alias par ligne dans
  une textarea, nettoyage/dédup côté schéma). Page `/worlds/[slug]/entities/[entityId]`.
- **Éditeur Tiptap + auto-save** (`EntityEditor`, même page) : titres (H2/H3, H1
  réservé au titre de page), gras/italique, listes, citation, lien (protocoles
  `http`/`https` uniquement), image (par URL, alt obligatoire — l'upload arrive à
  l'étape suivante). Contenu sauvegardé en JSON ProseMirror dans `Entity.content`,
  texte extrait dans `Entity.plainText` (pour le futur scan de liaison + la
  recherche), debounce de 1,5 s, indicateur d'état `aria-live`. `content`/`plainText`
  initialisés avec un document minimal valide à la création (`EMPTY_CONTENT` —
  un `doc` ProseMirror vide au sens strict, `content: []`, est en fait **invalide**
  contre le schéma, qui exige au moins un bloc : bug détecté et corrigé pendant
  cette étape via les tests, avant tout commit).

Composants d'interface : formulaires accessibles avec `useActionState`/`useFormStatus`,
erreurs reliées aux champs. Vérifié en conditions réelles (script `tsx` contre la base
de dev réelle + `curl` avec deux comptes distincts pour l'autorisation cross-monde,
cross-monde-et-cross-fiche, round-trip complet de contenu Tiptap) et par la suite de
tests automatisés (couverture 100 % sur `src/services/world-service.ts`,
`src/services/entity-service.ts`, `src/lib/tiptap-content.ts`).

**Mise à jour 2026-07-24** : la liste ci-dessus s'arrête au démonstrateur initial
(2026-07-14) et n'a pas été ré-énumérée depuis — upload/redimensionnement d'image,
moteur de liaison automatique, graphe de relations, recherche, quotas freemium,
mentions manuelles et monde d'introduction sont tous livrés en production depuis.
Détail par fonctionnalité et tests dédiés : `CHANGELOG.md`.

## Prise en compte de la sécurité (renvoi)

Voir `securite-owasp.md` pour le mapping détaillé par catégorie OWASP. Mesures déjà en
place au niveau de cette couche : hash de mot de passe (Better Auth, scrypt), sessions
révocables en base, validation Zod à chaque frontière.

## Maintenabilité — justification

- Aucun import Prisma en dehors de `src/db/` et des singletons `src/lib/*` — vérifié
  par relecture, pas d'accès direct depuis `app/`.
- Les Server Actions ne connaissent que les schémas Zod et les fonctions `auth.api.*` —
  remplacer l'implémentation d'authentification n'impacterait que `src/lib/auth.ts`.
- Les services futurs dépendront de `JobQueue`/`Storage` (interfaces), jamais de
  pg-boss/AWS SDK directement — remplacer pg-boss par un autre backend ne toucherait
  que `src/lib/queue/pg-boss-adapter.ts` (point d'extension documenté, cf. spec §4.2).
