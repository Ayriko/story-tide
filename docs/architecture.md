# Architecture logicielle — C2.2.1 (ÉLIMINATOIRE)

> Posture actée : « l'architecture la plus simple qui couvre le besoin, justifiée. » Pas de microservices.
> État au 2026-07-11 : socle (auth + infra ports) posé, moteur de liaison et features monde/entité pas encore codés.

## Vue d'ensemble

Monolithe **Next.js App Router** (RSC + Server Actions), un seul déploiement pour l'app,
un **worker Node séparé** consommera la file de jobs (`src/worker/`, pas encore créé —
arrivera avec le moteur Aho-Corasick). Un seul système stateful : **PostgreSQL**, qui
porte à la fois les données applicatives (Prisma) et la file `pg-boss` (schéma `pgboss`,
géré par pg-boss lui-même). **MinIO** (S3-compatible) pour les binaires utilisateurs
uniquement, buckets privés.

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
  `src/lib/auth-schemas.ts` avant tout appel métier (`auth.api.*`).
- Découpage par feature pas encore nécessaire (une seule feature — l'auth — existe).

## Prototype fonctionnel

Fonctionnalité livrée à ce jour : **authentification** (inscription, connexion,
déconnexion via l'API Better Auth, session en base, redirection si déjà connecté).
Pages `/login` et `/register` (composants d'interface : formulaires accessibles avec
`useActionState`/`useFormStatus`, erreurs reliées aux champs). Vérifié en conditions
réelles (curl sur l'API Better Auth + inspection Postgres) et manuellement par Aymeric.

Pas encore construit : mondes, CRUD entités, éditeur Tiptap, moteur de liaison
automatique, graphe de relations, recherche, quotas freemium.

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
