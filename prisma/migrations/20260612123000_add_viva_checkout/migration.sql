ALTER TABLE "Order" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "Order" ADD COLUMN "paymentOrderCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentTransactionId" TEXT;
ALTER TABLE "Order" ALTER COLUMN "stripeSessionId" DROP NOT NULL;

CREATE UNIQUE INDEX "Order_paymentOrderCode_key" ON "Order"("paymentOrderCode");
CREATE UNIQUE INDEX "Order_paymentTransactionId_key" ON "Order"("paymentTransactionId");

CREATE TABLE "CheckoutPaymentDraft" (
  "id" TEXT NOT NULL,
  "paymentProvider" TEXT NOT NULL DEFAULT 'viva',
  "paymentOrderCode" TEXT NOT NULL,
  "paymentTransactionId" TEXT,
  "userId" TEXT,
  "editTokenHash" TEXT NOT NULL,
  "guestCheckoutAccessHash" TEXT,
  "guestCheckoutAccessExpiresAt" BIGINT,
  "sourceStorefront" "Storefront",
  "sourceHost" TEXT,
  "sourceOrigin" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "currency" TEXT NOT NULL,
  "amountSubtotal" INTEGER NOT NULL,
  "amountTax" INTEGER NOT NULL DEFAULT 0,
  "amountShipping" INTEGER NOT NULL,
  "amountDiscount" INTEGER NOT NULL DEFAULT 0,
  "amountTotal" INTEGER NOT NULL,
  "discountCode" TEXT,
  "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
  "loyaltyDiscountAmount" INTEGER NOT NULL DEFAULT 0,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "shippingName" TEXT,
  "shippingLine1" TEXT,
  "shippingLine2" TEXT,
  "shippingPostalCode" TEXT,
  "shippingCity" TEXT,
  "shippingCountry" TEXT,
  "shippingAddressType" TEXT,
  "recoveredFromCheckoutSessionId" TEXT,
  "items" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CheckoutPaymentDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheckoutPaymentDraft_paymentOrderCode_key" ON "CheckoutPaymentDraft"("paymentOrderCode");
CREATE UNIQUE INDEX "CheckoutPaymentDraft_paymentTransactionId_key" ON "CheckoutPaymentDraft"("paymentTransactionId");
CREATE INDEX "CheckoutPaymentDraft_userId_createdAt_idx" ON "CheckoutPaymentDraft"("userId", "createdAt");
CREATE INDEX "CheckoutPaymentDraft_status_createdAt_idx" ON "CheckoutPaymentDraft"("status", "createdAt");
CREATE INDEX "CheckoutPaymentDraft_sourceStorefront_createdAt_idx" ON "CheckoutPaymentDraft"("sourceStorefront", "createdAt");

ALTER TABLE "CheckoutPaymentDraft"
  ADD CONSTRAINT "CheckoutPaymentDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
