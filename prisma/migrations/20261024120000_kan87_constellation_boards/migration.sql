-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "zoom" DOUBLE PRECISION,
    "panX" DOUBLE PRECISION,
    "panY" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardNode" (
    "boardId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardNode_pkey" PRIMARY KEY ("boardId","entityId")
);

-- CreateIndex
CREATE INDEX "Board_worldId_idx" ON "Board"("worldId");

-- CreateIndex
CREATE INDEX "BoardNode_entityId_idx" ON "BoardNode"("entityId");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardNode" ADD CONSTRAINT "BoardNode_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardNode" ADD CONSTRAINT "BoardNode_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ecrits a la main (Prisma ne declare ni index partiel ni CHECK).
-- Un seul tableau par defaut par monde : tranche aussi la course entre deux
-- creations a la demande simultanees (P2002 -> relecture, board-service.ts).
CREATE UNIQUE INDEX "Board_worldId_default_key" ON "Board"("worldId") WHERE "isDefault";

-- Cadrage tout null (jamais cadre : ajuster a l'ecran) ou tout renseigne, zoom > 0.
ALTER TABLE "Board" ADD CONSTRAINT "Board_viewport_check" CHECK (("zoom" IS NULL AND "panX" IS NULL AND "panY" IS NULL) OR ("zoom" IS NOT NULL AND "panX" IS NOT NULL AND "panY" IS NOT NULL AND "zoom" > 0));
