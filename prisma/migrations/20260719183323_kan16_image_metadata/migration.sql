-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Image_key_key" ON "Image"("key");

-- CreateIndex
CREATE INDEX "Image_worldId_idx" ON "Image"("worldId");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
