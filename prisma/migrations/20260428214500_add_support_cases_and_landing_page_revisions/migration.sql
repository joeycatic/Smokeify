-- CreateEnum
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportCaseSourceType" AS ENUM ('RETURN_REQUEST', 'CONTACT_SUBMISSION', 'MANUAL');

-- CreateEnum
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "ContactSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "linkedOrderId" TEXT,
    "linkedCustomerId" TEXT,
    "returnRequestId" TEXT,
    "contactSubmissionId" TEXT,
    "sourceType" "SupportCaseSourceType" NOT NULL,
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeUserId" TEXT,
    "assigneeEmail" TEXT,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "summary" TEXT NOT NULL,
    "resolutionNote" TEXT,
    "latestCustomerEventAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCaseEvent" (
    "id" TEXT NOT NULL,
    "supportCaseId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPageSectionRevision" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "storefront" "Storefront" NOT NULL,
    "key" TEXT NOT NULL,
    "isManual" BOOLEAN NOT NULL,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingPageSectionRevision_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LandingPageSection"
ADD COLUMN "publishedRevisionId" TEXT,
ADD COLUMN "scheduledRevisionId" TEXT;

-- CreateIndex
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "ContactSubmission_email_createdAt_idx" ON "ContactSubmission"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_returnRequestId_key" ON "SupportCase"("returnRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_contactSubmissionId_key" ON "SupportCase"("contactSubmissionId");

-- CreateIndex
CREATE INDEX "SupportCase_status_updatedAt_idx" ON "SupportCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportCase_assigneeUserId_status_updatedAt_idx" ON "SupportCase"("assigneeUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportCase_linkedOrderId_idx" ON "SupportCase"("linkedOrderId");

-- CreateIndex
CREATE INDEX "SupportCase_linkedCustomerId_idx" ON "SupportCase"("linkedCustomerId");

-- CreateIndex
CREATE INDEX "SupportCase_sourceType_createdAt_idx" ON "SupportCase"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "SupportCaseEvent_supportCaseId_createdAt_idx" ON "SupportCaseEvent"("supportCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportCaseEvent_eventType_createdAt_idx" ON "SupportCaseEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "LandingPageSectionRevision_sectionId_createdAt_idx" ON "LandingPageSectionRevision"("sectionId", "createdAt");

-- CreateIndex
CREATE INDEX "LandingPageSectionRevision_storefront_key_createdAt_idx" ON "LandingPageSectionRevision"("storefront", "key", "createdAt");

-- CreateIndex
CREATE INDEX "LandingPageSection_publishedRevisionId_idx" ON "LandingPageSection"("publishedRevisionId");

-- CreateIndex
CREATE INDEX "LandingPageSection_scheduledRevisionId_idx" ON "LandingPageSection"("scheduledRevisionId");

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_linkedOrderId_fkey" FOREIGN KEY ("linkedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_linkedCustomerId_fkey" FOREIGN KEY ("linkedCustomerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_contactSubmissionId_fkey" FOREIGN KEY ("contactSubmissionId") REFERENCES "ContactSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCaseEvent" ADD CONSTRAINT "SupportCaseEvent_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageSection" ADD CONSTRAINT "LandingPageSection_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "LandingPageSectionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageSection" ADD CONSTRAINT "LandingPageSection_scheduledRevisionId_fkey" FOREIGN KEY ("scheduledRevisionId") REFERENCES "LandingPageSectionRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageSectionRevision" ADD CONSTRAINT "LandingPageSectionRevision_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LandingPageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
