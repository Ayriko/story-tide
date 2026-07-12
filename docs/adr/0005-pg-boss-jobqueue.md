# ADR-0005 — pg-boss comme implémentation de JobQueue (+ policy « short »)

- **Statut** : accepté
- **Date** : 2026-07-03 (implémenté et affiné le 2026-07-11)
- **Décideur** : Aymeric (MOE)

## Contexte et problème

Le moteur de liaison automatique doit s'exécuter de façon asynchrone (scan différé
après debounce de sauvegarde), avec **au plus un job de liaison en attente par
fiche** (spec §4.4.3). Éviter d'ajouter un système stateful supplémentaire pour un
besoin que PostgreSQL — déjà présent — peut porter.

## Options envisagées

- **BullMQ + Redis** : écarté explicitement (stack actée, Redis interdit sans accord).
- **pg-boss** (file d'attente sur PostgreSQL) : retenu — zéro conteneur en plus, ACID,
  migration de schéma interne automatique (`pgboss`).
- **Dédup applicative** (vérifier en base l'absence de job en attente avant
  d'`enqueue`) : écartée — réintroduit une condition de course que la queue est
  précisément censée absorber ; plus de code applicatif, moins sûr.

## Décision

pg-boss 12.25.1 (MIT), derrière l'interface `JobQueue` (ports & adapters,
`src/lib/queue/`). **Point notable découvert en vérification réelle** (script
d'intégration contre Postgres) : la policy de queue par défaut de pg-boss
(`standard`) n'applique `singletonKey` qu'au throttle/debounce (`singletonSeconds`),
**pas** à un dedup permanent — un deuxième `enqueue()` avec la même clé renvoyait un
nouvel id au lieu de `null`. L'adaptateur crée donc les queues avec la policy
**`short`** (1 job **en attente** maximum par clé, actifs illimités), qui correspond
exactement à « 1 job de liaison en attente par fiche » de la spec.

## Conséquences

- **Positives** : aucun conteneur supplémentaire ; migration vers un autre backend de
  file (ex. BullMQ) ne réécrirait que l'adaptateur (point d'extension documenté,
  C2.2.1) ; comportement de dedup vérifié en conditions réelles, pas seulement à la
  lecture des types.
- **Négatives (dette assumée)** : pg-boss ajoute de la charge sur la même instance
  Postgres que les données applicatives — assumé, un seul système stateful à
  sauvegarder (spec §4.1). La policy est fixée à la **création** de la queue :
  la changer impose de la recréer. Piège silencieux (aucun type/lint ne l'attrape)
  → documenté dans la skill projet `.claude/skills/pgboss-singleton-dedup/`, qui
  impose une vérification par script d'intégration réel avant tout commit touchant
  au câblage des queues.

## Compétence(s) servie(s)

C2.2.1 (patron ports & adapters, point d'extension) ; C2.4.1. **Codé et vérifié**
cette session (commit `2471829`).
