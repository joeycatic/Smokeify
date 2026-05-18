-- CreateEnum
CREATE TYPE "PricingProductSegment" AS ENUM ('TRAFFIC_DRIVER', 'CORE', 'PREMIUM', 'CLEARANCE');

-- CreateEnum
CREATE TYPE "PricingRunMode" AS ENUM ('PREVIEW', 'APPLY');

-- CreateEnum
CREATE TYPE "PricingRunStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PricingRecommendationStatus" AS ENUM ('PREVIEW', 'APPLIED', 'PENDING_REVIEW', 'BLOCKED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PricingChangeSource" AS ENUM ('AUTOMATION', 'MANUAL_REVIEW', 'MANUAL_OVERRIDE');

-- CreateTable
CREATE TABLE "VariantPricingProfile" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "supplierShippingCostCents" INTEGER,
    "inboundShippingCostCents" INTEGER,
    "packagingCostCents" INTEGER,
    "handlingCostCents" INTEGER,
    "paymentFeePercentBasisPoints" INTEGER,
    "paymentFixedFeeCents" INTEGER,
    "returnRiskBufferBasisPoints" INTEGER,
    "targetMarginBasisPoints" INTEGER,
    "competitorMinPriceCents" INTEGER,
    "competitorAveragePriceCents" INTEGER,
    "competitorObservedAt" TIMESTAMP(3),
    "competitorSourceLabel" TEXT,
    "competitorSourceCount" INTEGER,
    "competitorReliabilityScore" DOUBLE PRECISION,
    "productSegment" "PricingProductSegment" NOT NULL DEFAULT 'CORE',
    "autoRepriceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantPricingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRun" (
    "id" TEXT NOT NULL,
    "mode" "PricingRunMode" NOT NULL DEFAULT 'APPLY',
    "status" "PricingRunStatus" NOT NULL DEFAULT 'COMPLETED',
    "triggeredById" TEXT,
    "notes" TEXT,
    "summary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PricingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRecommendation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "PricingRecommendationStatus" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "explanation" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "currentPriceCents" INTEGER NOT NULL,
    "hardMinimumPriceCents" INTEGER,
    "recommendedTargetPriceCents" INTEGER NOT NULL,
    "publishablePriceCents" INTEGER NOT NULL,
    "priceDeltaBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "inputSnapshot" JSONB NOT NULL,
    "outputSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "PricingRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingChangeAudit" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "actorId" TEXT,
    "source" "PricingChangeSource" NOT NULL,
    "oldPriceCents" INTEGER NOT NULL,
    "newPriceCents" INTEGER NOT NULL,
    "hardMinimumPriceCents" INTEGER,
    "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "inputSnapshot" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingChangeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VariantPricingProfile_variantId_key" ON "VariantPricingProfile"("variantId");

-- CreateIndex
CREATE INDEX "VariantPricingProfile_productSegment_idx" ON "VariantPricingProfile"("productSegment");

-- CreateIndex
CREATE INDEX "VariantPricingProfile_competitorObservedAt_idx" ON "VariantPricingProfile"("competitorObservedAt");

-- CreateIndex
CREATE INDEX "PricingRun_startedAt_idx" ON "PricingRun"("startedAt");

-- CreateIndex
CREATE INDEX "PricingRun_status_startedAt_idx" ON "PricingRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "PricingRun_triggeredById_startedAt_idx" ON "PricingRun"("triggeredById", "startedAt");

-- CreateIndex
CREATE INDEX "PricingRecommendation_runId_createdAt_idx" ON "PricingRecommendation"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "PricingRecommendation_status_createdAt_idx" ON "PricingRecommendation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PricingRecommendation_variantId_createdAt_idx" ON "PricingRecommendation"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "PricingRecommendation_productId_createdAt_idx" ON "PricingRecommendation"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "PricingRecommendation_reviewRequired_status_createdAt_idx" ON "PricingRecommendation"("reviewRequired", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PricingChangeAudit_recommendationId_key" ON "PricingChangeAudit"("recommendationId");

-- CreateIndex
CREATE INDEX "PricingChangeAudit_variantId_createdAt_idx" ON "PricingChangeAudit"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "PricingChangeAudit_productId_createdAt_idx" ON "PricingChangeAudit"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "PricingChangeAudit_source_createdAt_idx" ON "PricingChangeAudit"("source", "createdAt");

-- CreateIndex
CREATE INDEX "PricingChangeAudit_actorId_createdAt_idx" ON "PricingChangeAudit"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "VariantPricingProfile" ADD CONSTRAINT "VariantPricingProfile_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRun" ADD CONSTRAINT "PricingRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PricingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingChangeAudit" ADD CONSTRAINT "PricingChangeAudit_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "PricingRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingChangeAudit" ADD CONSTRAINT "PricingChangeAudit_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingChangeAudit" ADD CONSTRAINT "PricingChangeAudit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingChangeAudit" ADD CONSTRAINT "PricingChangeAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
