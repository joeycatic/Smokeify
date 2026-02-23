-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_status_idx" ON "ProcessedWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "VariantOption_variantId_idx" ON "VariantOption"("variantId");
