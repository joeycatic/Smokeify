-- CreateEnum
CREATE TYPE "ProductComplianceStatus" AS ENUM ('DRAFT_REVIEW', 'APPROVED', 'NEEDS_CHANGES', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ProductComplianceBlockerType" AS ENUM ('MEDICAL_CLAIM', 'ILLEGAL_USE_IMPLICATION', 'RESTRICTED_CATEGORY', 'RESTRICTED_TEXT', 'MISSING_CERTIFICATION', 'SHIPPING_RESTRICTION', 'REGION_RESTRICTION', 'AD_POLICY', 'FEED_POLICY', 'AGE_GATE_REQUIRED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProductComplianceSurface" AS ENUM ('STOREFRONT', 'SEARCH', 'RECOMMENDATIONS', 'CUSTOMIZER', 'ANALYZER', 'SITEMAP', 'FEED', 'ADS', 'LANDING_PAGE');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "complianceStatus" "ProductComplianceStatus" NOT NULL DEFAULT 'DRAFT_REVIEW',
ADD COLUMN "complianceReviewedAt" TIMESTAMP(3),
ADD COLUMN "complianceReviewedById" TEXT,
ADD COLUMN "complianceNotes" TEXT,
ADD COLUMN "complianceCountryAllowlist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "complianceCountryDenylist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "complianceAgeGateRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "complianceFeedEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "complianceAdsEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "complianceManualBlockers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ProductComplianceEvent" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "fromStatus" "ProductComplianceStatus",
  "toStatus" "ProductComplianceStatus",
  "blockers" JSONB,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductComplianceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_complianceStatus_idx" ON "Product"("complianceStatus");

-- CreateIndex
CREATE INDEX "Product_complianceReviewedById_idx" ON "Product"("complianceReviewedById");

-- CreateIndex
CREATE INDEX "ProductComplianceEvent_productId_createdAt_idx" ON "ProductComplianceEvent"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductComplianceEvent_toStatus_createdAt_idx" ON "ProductComplianceEvent"("toStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ProductComplianceEvent_actorId_createdAt_idx" ON "ProductComplianceEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_complianceReviewedById_fkey" FOREIGN KEY ("complianceReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComplianceEvent" ADD CONSTRAINT "ProductComplianceEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComplianceEvent" ADD CONSTRAINT "ProductComplianceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

