-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productGroup" TEXT;

-- CreateIndex
CREATE INDEX "Product_productGroup_idx" ON "Product"("productGroup");
