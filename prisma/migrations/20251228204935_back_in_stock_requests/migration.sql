-- CreateTable
CREATE TABLE "BackInStockRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT,
    "variantId" TEXT NOT NULL,
    "variantTitle" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackInStockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackInStockRequest_productId_idx" ON "BackInStockRequest"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BackInStockRequest_email_variantId_key" ON "BackInStockRequest"("email", "variantId");
