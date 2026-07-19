# ADR-0015 — `Alias` comme table dédiée (remplace `Entity.aliases String[]`)

- **Statut** : accepté
- **Date** : 2026-07-19
- **Décideur** : Aymeric (MOE)

## Contexte et problème

`Entity.aliases` était un `String[]` PostgreSQL natif depuis la v1 du schéma.
Cadrage KAN-18 (19/07) : les alias vont porter des attributs propres (actif/
inactif, source manuel/seed) que ne peut pas exprimer un tableau de chaînes
brutes, et un index sur la forme normalisée servirait le chargement du
dictionnaire Aho-Corasick (`linker-service.ts`, `buildDictionary`) — un
`String[]` ne peut pas être indexé pour une recherche insensible casse/accent.
Densité attendue : 2-3 alias par entité, jusqu'à 5 sur les entités centrales —
volume qui justifie une table dédiée plutôt qu'un JSON structuré en place.

Contrainte réelle : **la production contient déjà de vraies fiches avec des
alias renseignés** (Story Tide est en ligne depuis KAN-10, 2026-07-18) — la
migration ne peut pas se contenter d'un `DROP COLUMN`, elle doit préserver ces
données.

## Options envisagées

**Modélisation :**
- **A — Garder `String[]` avec un JSON de métadonnées en parallèle** — écartée :
  duplique la source de vérité (valeur dans le tableau, attributs dans le
  JSON), aucune contrainte d'intégrité entre les deux.
- **B — Table `Alias` dédiée** (`entityId`, `value`, `normalized`, `active`,
  `source`) avec `@@index([normalized])` — retenue.

**Migration (préservation des données de prod) :**
- **A — Backfill via script Node séparé**, orchestré manuellement entre deux
  déploiements — écartée pour ce chantier : le service `migrate` du pipeline
  CD (KAN-10, ADR-0013) n'exécute que `prisma migrate deploy`, ajouter un
  script à orchestrer romprait cette simplicité pour un besoin ponctuel.
- **B — Backfill SQL dans la migration elle-même**, via l'extension Postgres
  `unaccent` pour approcher `normalizeForMatch()` (NFD + retrait des marques
  combinantes + minuscule) — retenue. `unaccent()` n'est pas bit-exact avec la
  fonction TS sur des cas Unicode exotiques, mais s'en approche fortement pour
  du texte français courant ; écart jugé négligeable au vu du volume réel de
  données à ce stade (prod en ligne depuis ~24 h). Vérifié manuellement en
  conditions réelles (seed d'un alias accentué type "Néron le Terrible" →
  backfill → comparaison avec `normalizeForMatch()` : résultat identique).

**Séquencement de la migration :**
- **A — Une seule migration** (crée `Alias`, backfill, drop `aliases`) — plus
  simple à lire mais plus risquée : toute erreur dans le backfill laisse le
  schéma dans un état intermédiaire incohérent (colonne supprimée, backfill
  raté).
- **B — Deux migrations, patron expand/contract** — retenue :
  1. `kan18_schema_expand` (additive) : crée `Alias`, `AliasSource`, l'index,
     ajoute `Entity.seedRef` — `Entity.aliases` (ancienne colonne) **reste en
     place**, aucune perte possible à ce stade.
  2. `kan18_alias_backfill_and_drop` : backfill puis `DROP COLUMN aliases`,
     dans cet ordre strict au sein d'une seule migration (transactionnelle).

## Décision

Table `Alias` (`entityId`, `value`, `normalized`, `active Boolean @default(true)`,
`source AliasSource @default(MANUAL)`, `@@unique([entityId, value])`,
`@@index([normalized])`). `Entity.aliases` devient la relation `Alias[]`.

**Contrat de retour externe inchangé** : `entity-service.ts` continue de
renvoyer `aliases: string[]` à ses appelants (`EntityRecord`, aplati depuis
`include: { aliases: true }` via `toEntityRecord`) — zéro changement dans les
actions, les formulaires, ou `entity-schemas.ts` (le textarea "un alias par
ligne" persiste identique, seule la couche service traduit vers des lignes
`Alias`).

**Migration en deux temps** (expand/contract) avec backfill SQL `unaccent`
dans la seconde migration, exécutée AVANT le `DROP COLUMN` — voir
`prisma/migrations/20260719160258_kan18_schema_expand/` et
`prisma/migrations/20260719160400_kan18_alias_backfill_and_drop/`.

## Conséquences

- **Positives** : `active`/`source` ouvrent des usages futurs (désactiver un
  alias sans le supprimer, distinguer les alias de seed) sans nouvelle
  migration ; `normalized` indexé rend `searchEntities` (KAN-17) et
  `buildDictionary` (linker) plus efficaces (comparaison directe, plus de
  recalcul de `normalizeForMatch` par alias à chaque recherche) ; aucune
  donnée de production perdue ; procédure de migration en deux temps
  documentée et reproductible pour tout futur changement de forme similaire.
- **Négatives / à surveiller** : le backfill `unaccent` n'est pas
  algorithmiquement identique à `normalizeForMatch()` sur des cas Unicode
  exotiques (rare en pratique pour du texte français) — si un écart réel est
  constaté après déploiement, un correctif ciblé sur les lignes concernées
  suffira (pas de nouvelle migration de structure). Chaque écriture d'alias
  (`createEntity`/`updateEntity`) coûte désormais une écriture relationnelle
  (`create`/`deleteMany`+`create`) au lieu d'une simple mise à jour de
  colonne — coût négligeable au volume attendu (2-5 alias/entité).

## Compétence(s) servie(s)

C2.2.1 (architecture — modélisation relationnelle plutôt qu'un tableau
opaque) ; C2.1.1 (procédure de migration prod-safe, expand/contract) ; C2.4.1
(traçabilité de la décision et de la procédure de migration).
