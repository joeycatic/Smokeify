CREATE TYPE "AdminJobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "AdminJobRun" (
  "id" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "status" "AdminJobRunStatus" NOT NULL DEFAULT 'RUNNING',
  "triggeredById" TEXT,
  "triggeredByEmail" TEXT,
  "summary" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminJobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminJobRun_jobType_startedAt_idx"
ON "AdminJobRun"("jobType", "startedAt");

CREATE INDEX "AdminJobRun_status_startedAt_idx"
ON "AdminJobRun"("status", "startedAt");
