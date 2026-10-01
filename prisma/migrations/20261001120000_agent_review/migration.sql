-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revisionFeedback" TEXT;

