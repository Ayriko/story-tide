-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scannedVersion" INTEGER NOT NULL DEFAULT 0;

