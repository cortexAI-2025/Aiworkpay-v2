-- AlterTable
ALTER TABLE "MissionAttachment" ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "uploadedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MissionAttachment_storageKey_key" ON "MissionAttachment"("storageKey");

