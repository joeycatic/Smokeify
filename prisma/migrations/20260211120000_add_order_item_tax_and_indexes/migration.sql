ALTER TABLE "OrderItem"
ADD COLUMN "taxAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "taxRateBasisPoints" INTEGER;

CREATE UNIQUE INDEX "Order_stripePaymentIntent_key" ON "Order"("stripePaymentIntent");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
