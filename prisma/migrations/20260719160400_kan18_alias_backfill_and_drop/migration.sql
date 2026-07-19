-- Extension necessaire pour approcher normalizeForMatch() (NFD + retrait des
-- marques combinantes + minuscule) en SQL : unaccent() n'est pas bit-exact
-- avec la fonction TS mais s'en approche fortement pour du texte francais
-- courant (volume de donnees reel negligeable a ce stade - prod en ligne
-- depuis KAN-10). Backfill unique, non rejouable, pas de script Node separe
-- a orchestrer dans le pipeline CD (le service `migrate` ne fait que
-- `prisma migrate deploy`).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Backfill : copier les alias existants (Entity.aliases TEXT[]) vers la
-- table Alias AVANT de perdre la colonne. Toute fiche existante a deja saisi
-- ses alias manuellement (aucun seed n'existe encore) -> source = 'MANUAL'.
INSERT INTO "Alias" (id, "entityId", value, normalized, active, source, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e.id, a.value, lower(unaccent(a.value)), true, 'MANUAL', now(), now()
FROM "Entity" e, unnest(e.aliases) AS a(value)
WHERE cardinality(e.aliases) > 0;

-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "aliases";
