-- CreateEnum
CREATE TYPE "PlantAnalysisReviewStatus" AS ENUM ('UNREVIEWED', 'REVIEWED_OK', 'REVIEWED_INCORRECT', 'REVIEWED_UNSAFE', 'NEEDS_PROMPT_FIX', 'NEEDS_RECOMMENDATION_FIX', 'PRIVACY_REVIEW');

-- CreateEnum
CREATE TYPE "PlantAnalysisSafetyFlag" AS ENUM ('OVERCONFIDENT', 'MEDICAL_OR_LEGAL_CLAIM', 'UNSAFE_ACTION', 'IRRELEVANT_PRODUCT_RECOMMENDATION', 'LOW_IMAGE_QUALITY', 'USER_DISPUTED', 'PRIVACY_SENSITIVE_IMAGE');

-- AlterTable
ALTER TABLE "PlantAnalysisRun"
ADD COLUMN "reviewStatus" "PlantAnalysisReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNotes" TEXT,
ADD COLUMN "safetyFlags" "PlantAnalysisSafetyFlag"[] NOT NULL DEFAULT ARRAY[]::"PlantAnalysisSafetyFlag"[],
ADD COLUMN "imageRetentionUntil" TIMESTAMP(3),
ADD COLUMN "imageDeletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlantAnalysisReviewEvent" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "fromStatus" "PlantAnalysisReviewStatus",
  "toStatus" "PlantAnalysisReviewStatus",
  "safetyFlags" "PlantAnalysisSafetyFlag"[] NOT NULL DEFAULT ARRAY[]::"PlantAnalysisSafetyFlag"[],
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlantAnalysisReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantAnalysisRun_reviewStatus_createdAt_idx" ON "PlantAnalysisRun"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "PlantAnalysisRun_reviewedById_createdAt_idx" ON "PlantAnalysisRun"("reviewedById", "createdAt");

-- CreateIndex
CREATE INDEX "PlantAnalysisRun_imageRetentionUntil_idx" ON "PlantAnalysisRun"("imageRetentionUntil");

-- CreateIndex
CREATE INDEX "PlantAnalysisReviewEvent_analysisId_createdAt_idx" ON "PlantAnalysisReviewEvent"("analysisId", "createdAt");

-- CreateIndex
CREATE INDEX "PlantAnalysisReviewEvent_toStatus_createdAt_idx" ON "PlantAnalysisReviewEvent"("toStatus", "createdAt");

-- CreateIndex
CREATE INDEX "PlantAnalysisReviewEvent_actorId_createdAt_idx" ON "PlantAnalysisReviewEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlantAnalysisRun" ADD CONSTRAINT "PlantAnalysisRun_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantAnalysisReviewEvent" ADD CONSTRAINT "PlantAnalysisReviewEvent_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "PlantAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantAnalysisReviewEvent" ADD CONSTRAINT "PlantAnalysisReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

