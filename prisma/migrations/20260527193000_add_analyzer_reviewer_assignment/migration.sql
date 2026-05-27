-- Add optional analyzer reviewer assignment metadata for repeated admin review work.
ALTER TABLE "PlantAnalysisRun"
ADD COLUMN "assignedReviewerId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "reviewDueAt" TIMESTAMP(3);

ALTER TABLE "PlantAnalysisRun"
ADD CONSTRAINT "PlantAnalysisRun_assignedReviewerId_fkey"
FOREIGN KEY ("assignedReviewerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PlantAnalysisRun_assignedReviewerId_reviewDueAt_idx"
ON "PlantAnalysisRun"("assignedReviewerId", "reviewDueAt");

CREATE INDEX "PlantAnalysisRun_reviewDueAt_idx"
ON "PlantAnalysisRun"("reviewDueAt");
