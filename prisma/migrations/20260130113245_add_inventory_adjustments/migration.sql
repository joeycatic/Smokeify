-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryAdjustment_variantId_idx" ON "InventoryAdjustment"("variantId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_productId_idx" ON "InventoryAdjustment"("productId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_orderId_idx" ON "InventoryAdjustment"("orderId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_createdAt_idx" ON "InventoryAdjustment"("createdAt");

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
