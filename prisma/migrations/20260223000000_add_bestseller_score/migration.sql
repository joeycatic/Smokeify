ALTER TABLE "Product" ADD COLUMN "bestsellerScore" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "conversionRate" DOUBLE PRECISION;
CREATE INDEX "Product_bestsellerScore_idx" ON "Product"("bestsellerScore");
CREATE INDEX "Product_status_bestsellerScore_idx" ON "Product"("status", "bestsellerScore");
