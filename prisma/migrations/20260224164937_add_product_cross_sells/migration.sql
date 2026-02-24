-- CreateTable
CREATE TABLE "ProductCrossSell" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "crossSellId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCrossSell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCrossSell_productId_sortOrder_idx" ON "ProductCrossSell"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCrossSell_productId_crossSellId_key" ON "ProductCrossSell"("productId", "crossSellId");

-- AddForeignKey
ALTER TABLE "ProductCrossSell" ADD CONSTRAINT "ProductCrossSell_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCrossSell" ADD CONSTRAINT "ProductCrossSell_crossSellId_fkey" FOREIGN KEY ("crossSellId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
