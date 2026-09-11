-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "seedRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Folder_worldId_idx" ON "Folder"("worldId");

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_worldId_seedRef_key" ON "Folder"("worldId", "seedRef");

-- CreateIndex
CREATE INDEX "Entity_folderId_idx" ON "Entity"("folderId");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
