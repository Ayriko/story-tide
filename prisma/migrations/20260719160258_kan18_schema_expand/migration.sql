-- CreateEnum
CREATE TYPE "WorldOrigin" AS ENUM ('USER', 'INTRO', 'DEMO');

-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('MANUAL', 'SEED');

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "seedRef" TEXT;

-- AlterTable
ALTER TABLE "World" ADD COLUMN     "origin" "WorldOrigin" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "Alias" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" "AliasSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alias_normalized_idx" ON "Alias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "Alias_entityId_value_key" ON "Alias"("entityId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_worldId_seedRef_key" ON "Entity"("worldId", "seedRef");

-- AddForeignKey
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
