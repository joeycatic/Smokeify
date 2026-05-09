-- CreateEnum
CREATE TYPE "OrderRiskStatus" AS ENUM ('CLEAR', 'REVIEW', 'HOLD', 'APPROVED', 'BLOCKED');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "riskNotes" TEXT,
ADD COLUMN "riskReviewedAt" TIMESTAMP(3),
ADD COLUMN "riskReviewedById" TEXT,
ADD COLUMN "riskScore" INTEGER,
ADD COLUMN "riskStatus" "OrderRiskStatus" NOT NULL DEFAULT 'CLEAR';

-- CreateTable
CREATE TABLE "OrderRiskEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "fromStatus" "OrderRiskStatus",
    "toStatus" "OrderRiskStatus",
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderRiskEvent_orderId_createdAt_idx" ON "OrderRiskEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderRiskEvent_actorId_createdAt_idx" ON "OrderRiskEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderRiskEvent_toStatus_createdAt_idx" ON "OrderRiskEvent"("toStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_riskReviewedById_fkey" FOREIGN KEY ("riskReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRiskEvent" ADD CONSTRAINT "OrderRiskEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRiskEvent" ADD CONSTRAINT "OrderRiskEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
