-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "mainCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "Product_mainCategoryId_idx" ON "Product"("mainCategoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_mainCategoryId_fkey" FOREIGN KEY ("mainCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
