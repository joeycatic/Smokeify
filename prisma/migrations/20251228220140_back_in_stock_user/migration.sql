-- AlterTable
ALTER TABLE "BackInStockRequest" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "BackInStockRequest_userId_idx" ON "BackInStockRequest"("userId");

-- AddForeignKey
ALTER TABLE "BackInStockRequest" ADD CONSTRAINT "BackInStockRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
