-- AlterTable
ALTER TABLE "User" ADD COLUMN "loyaltyPointsBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserCartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "optionsKey" TEXT NOT NULL DEFAULT '',
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "reviewId" TEXT,
    "pointsDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIncentive" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "promotionCode" TEXT NOT NULL,
    "stripePromotionCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewIncentive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCartItem_userId_updatedAt_idx" ON "UserCartItem"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCartItem_userId_variantId_optionsKey_key" ON "UserCartItem"("userId", "variantId", "optionsKey");

-- CreateIndex
CREATE INDEX "LoyaltyPointTransaction_userId_createdAt_idx" ON "LoyaltyPointTransaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointTransaction_orderId_key" ON "LoyaltyPointTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointTransaction_reviewId_key" ON "LoyaltyPointTransaction"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewIncentive_reviewId_key" ON "ReviewIncentive"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewIncentive_userId_createdAt_idx" ON "ReviewIncentive"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewIncentive_promotionCode_key" ON "ReviewIncentive"("promotionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewIncentive_stripePromotionCodeId_key" ON "ReviewIncentive"("stripePromotionCodeId");

-- AddForeignKey
ALTER TABLE "UserCartItem" ADD CONSTRAINT "UserCartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPointTransaction" ADD CONSTRAINT "LoyaltyPointTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIncentive" ADD CONSTRAINT "ReviewIncentive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
