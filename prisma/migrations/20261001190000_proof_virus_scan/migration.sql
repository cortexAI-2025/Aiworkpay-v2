-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('CLEAN', 'NOT_SCANNED');

-- AlterTable
ALTER TABLE "MissionAttachment" ADD COLUMN     "scanStatus" "ScanStatus",
ADD COLUMN     "scannedAt" TIMESTAMP(3);

