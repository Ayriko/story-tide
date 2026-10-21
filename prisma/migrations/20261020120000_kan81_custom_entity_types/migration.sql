-- KAN-81 (ADR-0030) : types d'entrees personnalises par monde + masquage des
-- types natifs. Migration additive : les entites existantes gardent leur type
-- natif et customTypeId NULL (la contrainte CHECK ci-dessous est donc
-- satisfaite par toutes les lignes existantes).

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "customTypeId" TEXT;

-- AlterTable
ALTER TABLE "World" ADD COLUMN     "hiddenEntityTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CustomEntityType" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomEntityType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomEntityType_worldId_idx" ON "CustomEntityType"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomEntityType_worldId_labelKey_key" ON "CustomEntityType"("worldId", "labelKey");

-- CreateIndex
CREATE INDEX "Entity_customTypeId_idx" ON "Entity"("customTypeId");

-- AddForeignKey
-- NO ACTION (et non RESTRICT) : verifie en fin d'instruction, la cascade
-- World -> Entity / World -> CustomEntityType d'une suppression de monde passe ;
-- la suppression directe d'un type encore utilise echoue.
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_customTypeId_fkey" FOREIGN KEY ("customTypeId") REFERENCES "CustomEntityType"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomEntityType" ADD CONSTRAINT "CustomEntityType_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ecrit a la main (Prisma ne declare pas de CHECK) : une entree de type
-- "custom" a toujours un customTypeId, et inversement.
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_custom_type_check" CHECK (("type" = 'custom') = ("customTypeId" IS NOT NULL));
