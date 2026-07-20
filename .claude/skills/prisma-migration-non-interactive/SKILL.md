---
name: prisma-migration-non-interactive
description: 'Create or apply a Prisma migration from an agent session or any non-interactive shell. Use when prisma migrate dev refuses the environment, when a migration needs a custom SQL data step (backfill) between two schema states, when migrate reset is blocked, or when a schema change would drop a column holding real data. Keywords — prisma, migrate dev, migrate deploy, migrate diff, create-only, non-interactive, shadow database, shadowDatabaseUrl, backfill, expand contract, unaccent, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION, migrate reset, to-schema-datamodel.'
---

# Migration Prisma en environnement non interactif

## Le gotcha

`npx prisma migrate dev --create-only` **échoue dès qu'un warning existe**
(ajout d'une contrainte unique, colonne perdue…) quand le shell n'est pas
interactif — cas de toute session d'agent :

```
Prisma Migrate has detected that the environment is non-interactive,
which is not supported.
```

Il n'y a pas de flag `--yes`. Le contournement est de générer le SQL soi-même.

## Générer le SQL sans shadow DB ni prompt

```bash
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script
```

Puis créer `prisma/migrations/<timestamp>_<nom>/migration.sql` à la main et
appliquer :

```bash
npx prisma migrate deploy   # non interactif par conception
```

Deux pièges de la commande `diff` :

- `--from-migrations` exige `datasource.shadowDatabaseUrl` dans
  `prisma.config.ts`. Si le projet ne l'a pas, utiliser
  `--from-config-datasource` : le diff se fait contre la **DB de dev réelle**,
  pas contre un rejeu de migrations.
- `--to-schema-datamodel` a été retiré des versions récentes de la CLI (≥ 7.x).
  C'est `--to-schema`.

## Quand des données réelles sont en jeu : expand/contract

Une migration qui remplace une colonne par une table (ou change un type) ne
doit **jamais** être écrite en un seul temps si la production porte déjà des
données. Deux migrations :

1. **expand** — créer les nouvelles structures, laisser l'ancienne en place.
2. **contract** — backfill SQL puis `DROP` de l'ancienne colonne.

Mettre le backfill **dans le `.sql` de la seconde migration**, pas dans un
script Node séparé : un pipeline CD qui n'exécute que `prisma migrate deploy`
n'orchestre aucun script, et le backfill serait silencieusement sauté.

Si le backfill doit reproduire une normalisation faite en JS, activer
l'extension côté SQL et **comparer les deux sorties sur un cas réaliste avant
d'y croire** :

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
UPDATE "Alias" SET normalized = lower(unaccent(value));
```

Vérification : insérer une valeur accentuée représentative via `psql`,
appliquer la migration, comparer la colonne produite avec la sortie de la
fonction JS équivalente.

```bash
docker exec <projet>-postgres-1 psql -U <role> -d <db> \
  -c "SELECT value, normalized FROM \"Alias\" LIMIT 5;"
```

Le rôle et la base sont ceux de `DATABASE_URL` dans `.env` — pas `postgres`.

## Double garde-fou sur `migrate reset`

Prisma détecte l'invocation par un agent et bloque les commandes destructrices :

```
Prisma Migrate has detected that it was invoked by Claude Code.
You must stop at this point and respond to the user.
```

La variable `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<message exact>"`
lève ce garde-fou, mais **le classifieur du harness peut bloquer par-dessus**
(« Permission for this action was denied by the auto mode classifier »).

Ne pas s'acharner : `migrate reset` détruit la base de dev. **Demander à
l'humain de l'exécuter dans son propre terminal** et reprendre après.
