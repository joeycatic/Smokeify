ALTER TABLE "Order" ALTER COLUMN "paymentProvider" SET DEFAULT 'viva';

CREATE TABLE "DiscountCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "percentOff" DOUBLE PRECISION,
  "amountOffCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "maxRedemptions" INTEGER,
  "timesRedeemed" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'admin',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");
CREATE INDEX "DiscountCode_active_expiresAt_idx" ON "DiscountCode"("active", "expiresAt");
CREATE INDEX "DiscountCode_source_createdAt_idx" ON "DiscountCode"("source", "createdAt");
