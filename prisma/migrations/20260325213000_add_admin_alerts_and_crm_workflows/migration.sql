-- CreateEnum
CREATE TYPE "AdminAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "AdminAlertPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "crmFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AdminAlert" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" "AdminAlertPriority" NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "actionLabel" TEXT,
  "status" "AdminAlertStatus" NOT NULL DEFAULT 'OPEN',
  "assigneeUserId" TEXT,
  "assigneeEmail" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "repeatCount" INTEGER NOT NULL DEFAULT 1,
  "signalActive" BOOLEAN NOT NULL DEFAULT true,
  "signalClearedAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAlertEvent" (
  "id" TEXT NOT NULL,
  "alertId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "eventType" TEXT NOT NULL,
  "fromStatus" "AdminAlertStatus",
  "toStatus" "AdminAlertStatus",
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminCustomerCohort" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL,
  "customerCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminCustomerCohort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAlert_dedupeKey_key" ON "AdminAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "AdminAlert_status_priority_updatedAt_idx"
  ON "AdminAlert"("status", "priority", "updatedAt");

-- CreateIndex
CREATE INDEX "AdminAlert_signalActive_status_idx"
  ON "AdminAlert"("signalActive", "status");

-- CreateIndex
CREATE INDEX "AdminAlert_category_priority_idx"
  ON "AdminAlert"("category", "priority");

-- CreateIndex
CREATE INDEX "AdminAlertEvent_alertId_createdAt_idx"
  ON "AdminAlertEvent"("alertId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAlertEvent_eventType_createdAt_idx"
  ON "AdminAlertEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminCustomerCohort_createdAt_idx"
  ON "AdminCustomerCohort"("createdAt");

-- CreateIndex
CREATE INDEX "AdminCustomerCohort_updatedAt_idx"
  ON "AdminCustomerCohort"("updatedAt");

-- AddForeignKey
ALTER TABLE "AdminAlertEvent"
  ADD CONSTRAINT "AdminAlertEvent_alertId_fkey"
  FOREIGN KEY ("alertId") REFERENCES "AdminAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
