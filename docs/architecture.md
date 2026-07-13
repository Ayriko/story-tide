# Architecture logicielle — C2.2.1 (ÉLIMINATOIRE)

> Posture actée : « l'architecture la plus simple qui couvre le besoin, justifiée. » Pas de microservices.
> État au 2026-07-13 : socle (auth + infra ports + CI + images Docker) posé,
> première feature métier (Mondes) livrée avec sa couche service ; entités,
> éditeur et moteur de liaison pas encore codés.

## Vue d'ensemble

Monolithe **Next.js App Router** (RSC + Server Actions), un seul déploiement pour l'app,
un **worker Node séparé** (`src/worker/index.ts`) consomme la file de jobs pg-boss —
squelette en place (souscription à la file `entity-linking`, arrêt gracieux SIGTERM),
le traitement réel (scan Aho-Corasick) arrivera avec le moteur de liaison. Un seul
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

## Prototype fonctionnel

Fonctionnalités livrées à ce jour :
- **Authentification** (inscription, connexion, déconnexion via l'API Better Auth,
  session en base, redirection si déjà connecté). Pages `/login` et `/register`.
- **Mondes (CRUD)** : création, liste, renommage, suppression (confirmation en deux
  étapes). Slug dérivé automatiquement du nom (`src/lib/slugify.ts`), jamais saisi.
  Pages `/worlds` et `/worlds/[slug]` sous un layout applicatif protégé
  (`src/app/(app)/layout.tsx`, redirection `/login` si session absente).

Composants d'interface : formulaires accessibles avec `useActionState`/`useFormStatus`,
erreurs reliées aux champs. Vérifié en conditions réelles (script `tsx` contre la base
de dev réelle + `curl` avec deux comptes distincts pour l'autorisation cross-monde) et
par la suite de tests automatisés (couverture 100 % sur `src/services/world-service.ts`).

Pas encore construit : CRUD entités, éditeur Tiptap, moteur de liaison automatique,
graphe de relations, recherche, quotas freemium.

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
