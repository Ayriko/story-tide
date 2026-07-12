---
name: pgboss-singleton-dedup
description: >
  À utiliser dès qu'on crée, configure ou débogue une queue pg-boss dans Story Tide,
  en particulier pour la déduplication de jobs via singletonKey (moteur de liaison
  Aho-Corasick : 1 job de liaison en attente par fiche). Déclencheurs : pg-boss,
  JobQueue, singletonKey, dédup de jobs, "un seul job en attente", policy de queue,
  createQueue, work()/send().
---

# pg-boss : `singletonKey` ne déduplique PAS avec la policy par défaut

## Le piège (vérifié en conditions réelles, 2026-07-11)

Avec la policy de queue par défaut (`standard`), passer `singletonKey` à `send()`
**ne déduplique pas** les jobs en attente. `standard` n'utilise `singletonKey` que
pour le *throttle/debounce* fenêtré, pas pour garantir « un seul job actif par clé ».

Symptôme : un 2ᵉ `enqueue(..., { singletonKey })` avec la même clé renvoie un
**nouvel id** au lieu de `null` → deux jobs identiques finissent en file.

C'est critique pour Story Tide : le moteur de liaison doit garder **un seul job de
liaison en attente par fiche** (spec §4.4.3). Sans correction, chaque frappe/save
empile des jobs redondants.

## La correction

Créer la queue avec la policy `short` :

```ts
await boss.createQueue(name, { policy: "short" });
```

`short` = **au plus 1 job en attente par `singletonKey`** (le suivant est rejeté
tant que le job en attente n'est pas pris). C'est exactement le comportement voulu.

Vérifier après coup : un 2ᵉ `send` avec la même `singletonKey` doit renvoyer `null`.

## Règles pour ce repo

- Toute queue créée par l'adaptateur `JobQueue` (`src/lib/queue/`) qui s'appuie sur
  `singletonKey` doit être déclarée avec `{ policy: "short" }`. Ne pas laisser la
  valeur par défaut.
- La dédup est une **propriété de la queue** (à la création), pas une option du
  `send`. Changer la policy d'une queue existante nécessite de la recréer.
- Toujours vérifier la dédup avec un script d'intégration réel
  (`npx tsx --env-file=.env <script>.ts`) avant de committer — le piège est
  silencieux, aucun type ni lint ne l'attrape.

## Pièges annexes observés le même jour

- Sous Windows/Node, un `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`
  peut survenir **après** `process.exit(0)` en fin de script de vérif pg-boss :
  artefact libuv au teardown, sans rapport avec le code applicatif (le script a
  déjà loggé son succès).
