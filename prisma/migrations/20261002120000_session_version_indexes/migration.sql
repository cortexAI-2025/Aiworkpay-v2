-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Mission_status_createdAt_idx" ON "Mission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Mission_assignedToUserId_status_idx" ON "Mission"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "Mission_createdByApiKeyId_createdAt_idx" ON "Mission"("createdByApiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_missionId_idx" ON "Transaction"("missionId");

-- CreateIndex
CREATE INDEX "User_stripeAccountId_idx" ON "User"("stripeAccountId");
