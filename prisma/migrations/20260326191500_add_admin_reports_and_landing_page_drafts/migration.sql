-- AlterTable
ALTER TABLE "LandingPageSection"
ADD COLUMN     "draftIsManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "draftProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3),
ADD COLUMN     "lastPublishedAt" TIMESTAMP(3);

UPDATE "LandingPageSection"
SET
  "draftIsManual" = "isManual",
  "draftProductIds" = "productIds"
WHERE "draftIsManual" = false
  AND COALESCE(array_length("draftProductIds", 1), 0) = 0;

-- CreateTable
CREATE TABLE "AdminSavedReport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'overview',
    "days" INTEGER NOT NULL DEFAULT 30,
    "sourceStorefront" "Storefront",
    "paymentState" TEXT NOT NULL DEFAULT 'all',
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSavedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminSavedReport_createdAt_idx" ON "AdminSavedReport"("createdAt");

-- CreateIndex
CREATE INDEX "AdminSavedReport_updatedAt_idx" ON "AdminSavedReport"("updatedAt");
