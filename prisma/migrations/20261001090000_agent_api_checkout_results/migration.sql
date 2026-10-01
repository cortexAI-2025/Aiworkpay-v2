-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('BRIEF', 'PROOF');

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "checkoutExpiresAt" TIMESTAMP(3),
ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyFingerprint" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "resultData" JSONB,
ADD COLUMN     "resultNote" TEXT,
ADD COLUMN     "stripeCheckoutSessionId" TEXT;

-- AlterTable
ALTER TABLE "MissionAttachment" ADD COLUMN     "kind" "AttachmentKind" NOT NULL DEFAULT 'BRIEF';

-- CreateIndex
CREATE UNIQUE INDEX "Mission_stripeCheckoutSessionId_key" ON "Mission"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_createdByApiKeyId_idempotencyKey_key" ON "Mission"("createdByApiKeyId", "idempotencyKey");

