-- CreateEnum
CREATE TYPE "PlantHealthStatus" AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "PlantAnalysisRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "plantId" TEXT,
    "imageUri" TEXT,
    "imageHash" TEXT NOT NULL,
    "imageMime" TEXT,
    "notes" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "healthStatus" "PlantHealthStatus" NOT NULL,
    "species" TEXT NOT NULL,
    "outputJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantAnalysisIssue" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "sourceIssueId" TEXT,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "severity" "PlantHealthStatus" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantAnalysisIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantAnalysisFeedback" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "userId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "correctLabel" TEXT,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantAnalysisFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantAnalysisRun_userId_createdAt_idx" ON "PlantAnalysisRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PlantAnalysisRun_healthStatus_createdAt_idx" ON "PlantAnalysisRun"("healthStatus", "createdAt");

-- CreateIndex
CREATE INDEX "PlantAnalysisRun_imageHash_idx" ON "PlantAnalysisRun"("imageHash");

-- CreateIndex
CREATE INDEX "PlantAnalysisIssue_analysisId_position_idx" ON "PlantAnalysisIssue"("analysisId", "position");

-- CreateIndex
CREATE INDEX "PlantAnalysisFeedback_analysisId_createdAt_idx" ON "PlantAnalysisFeedback"("analysisId", "createdAt");

-- CreateIndex
CREATE INDEX "PlantAnalysisFeedback_userId_createdAt_idx" ON "PlantAnalysisFeedback"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlantAnalysisRun" ADD CONSTRAINT "PlantAnalysisRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantAnalysisIssue" ADD CONSTRAINT "PlantAnalysisIssue_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "PlantAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantAnalysisFeedback" ADD CONSTRAINT "PlantAnalysisFeedback_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "PlantAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantAnalysisFeedback" ADD CONSTRAINT "PlantAnalysisFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
