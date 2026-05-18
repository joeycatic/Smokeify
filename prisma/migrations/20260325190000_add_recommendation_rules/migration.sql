-- CreateEnum
CREATE TYPE "RecommendationRuleTriggerType" AS ENUM ('CATEGORY', 'TAG', 'PRODUCT_GROUP');

-- CreateEnum
CREATE TYPE "RecommendationRuleTargetType" AS ENUM ('CATEGORY', 'TAG', 'PRODUCT_GROUP');

-- CreateTable
CREATE TABLE "RecommendationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "RecommendationRuleTriggerType" NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "targetType" "RecommendationRuleTargetType" NOT NULL,
    "targetValue" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxProducts" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationRule_isActive_triggerType_idx" ON "RecommendationRule"("isActive", "triggerType");

-- CreateIndex
CREATE INDEX "RecommendationRule_triggerType_triggerValue_isActive_idx" ON "RecommendationRule"("triggerType", "triggerValue", "isActive");

-- CreateIndex
CREATE INDEX "RecommendationRule_targetType_targetValue_isActive_idx" ON "RecommendationRule"("targetType", "targetValue", "isActive");
