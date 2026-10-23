-- KAN-84 (ADR-0031) : relations declarees et typees, types de relation
-- personnalises par monde, suggestions ecartees. Migration additive : trois
-- tables neuves et une colonne a valeur par defaut, aucune ligne existante
-- touchee. Relation, RelationOrigin et LinkIgnore ne changent pas.

-- AlterTable
ALTER TABLE "World" ADD COLUMN     "hiddenRelationTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CustomRelationType" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "inverseLabel" TEXT,
    "symmetric" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRelationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclaredRelation" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "customRelationTypeId" TEXT,
    "typeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeclaredRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationSuggestionIgnore" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationSuggestionIgnore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomRelationType_worldId_idx" ON "CustomRelationType"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomRelationType_worldId_labelKey_key" ON "CustomRelationType"("worldId", "labelKey");

-- CreateIndex
CREATE INDEX "DeclaredRelation_worldId_idx" ON "DeclaredRelation"("worldId");

-- CreateIndex
CREATE INDEX "DeclaredRelation_targetId_idx" ON "DeclaredRelation"("targetId");

-- CreateIndex
CREATE INDEX "DeclaredRelation_customRelationTypeId_idx" ON "DeclaredRelation"("customRelationTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "DeclaredRelation_sourceId_targetId_typeKey_key" ON "DeclaredRelation"("sourceId", "targetId", "typeKey");

-- CreateIndex
CREATE INDEX "RelationSuggestionIgnore_worldId_idx" ON "RelationSuggestionIgnore"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "RelationSuggestionIgnore_entityId_targetId_key" ON "RelationSuggestionIgnore"("entityId", "targetId");

-- AddForeignKey
ALTER TABLE "CustomRelationType" ADD CONSTRAINT "CustomRelationType_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaredRelation" ADD CONSTRAINT "DeclaredRelation_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaredRelation" ADD CONSTRAINT "DeclaredRelation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaredRelation" ADD CONSTRAINT "DeclaredRelation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- NO ACTION (et non RESTRICT, meme raisonnement que KAN-81) : verifie en fin
-- d'instruction, la cascade World -> DeclaredRelation / World ->
-- CustomRelationType d'une suppression de monde passe ; la suppression
-- directe d'un type encore utilise echoue.
ALTER TABLE "DeclaredRelation" ADD CONSTRAINT "DeclaredRelation_customRelationTypeId_fkey" FOREIGN KEY ("customRelationTypeId") REFERENCES "CustomRelationType"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationSuggestionIgnore" ADD CONSTRAINT "RelationSuggestionIgnore_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationSuggestionIgnore" ADD CONSTRAINT "RelationSuggestionIgnore_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationSuggestionIgnore" ADD CONSTRAINT "RelationSuggestionIgnore_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ecrits a la main (Prisma ne declare pas de CHECK).
-- Une relation de type "custom" a toujours un customRelationTypeId, et inversement.
ALTER TABLE "DeclaredRelation" ADD CONSTRAINT "DeclaredRelation_custom_type_check" CHECK (("relationType" = 'custom') = ("customRelationTypeId" IS NOT NULL));

-- typeKey (porteur de l'unicite) toujours derive des deux colonnes de type.
ALTER TABLE "DeclaredRelation" ADD CONSTRAINT "DeclaredRelation_type_key_check" CHECK ("typeKey" = CASE WHEN "relationType" = 'custom' THEN 'custom:' || "customRelationTypeId" ELSE "relationType" END);

-- Une entree n'est jamais en relation avec elle-meme.
ALTER TABLE "DeclaredRelation" ADD CONSTRAINT "DeclaredRelation_no_self_check" CHECK ("sourceId" <> "targetId");

-- Un type symetrique n'a pas de libelle inverse ; un type dirige en a un.
ALTER TABLE "CustomRelationType" ADD CONSTRAINT "CustomRelationType_symmetric_check" CHECK ("symmetric" = ("inverseLabel" IS NULL));
