-- API keys are no longer stored in plaintext: only their SHA-256 hash is kept.
-- Existing keys are hashed in place, so agents keep working with the same key.

-- AlterTable: new columns, nullable until backfilled
ALTER TABLE "ApiKey"
ADD COLUMN     "keyHash" TEXT,
ADD COLUMN     "keyPrefix" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "maxMissionBudget" DECIMAL(10,2),
ADD COLUMN     "monthlyBudget" DECIMAL(10,2),
ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY['missions:read', 'missions:write', 'missions:approve']::TEXT[];

-- Backfill: hash existing keys (same algorithm as lib/apikey.ts); existing keys
-- keep every scope so that no agent breaks.
UPDATE "ApiKey"
SET "keyHash"   = encode(sha256(convert_to("key", 'UTF8')), 'hex'),
    "keyPrefix" = left("key", 12),
    "scopes"    = ARRAY['missions:read', 'missions:write', 'missions:approve']::TEXT[];

ALTER TABLE "ApiKey" ALTER COLUMN "keyHash" SET NOT NULL;
ALTER TABLE "ApiKey" ALTER COLUMN "keyPrefix" SET NOT NULL;

-- Drop the plaintext key
DROP INDEX "ApiKey_key_key";
ALTER TABLE "ApiKey" DROP COLUMN "key";

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
