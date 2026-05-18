CREATE INDEX "Product_complianceFeedEligible_updatedAt_idx"
ON "Product"("complianceFeedEligible", "updatedAt");

CREATE INDEX "Product_complianceAdsEligible_updatedAt_idx"
ON "Product"("complianceAdsEligible", "updatedAt");

CREATE INDEX "ReturnRequest_status_updatedAt_idx"
ON "ReturnRequest"("status", "updatedAt");

CREATE INDEX "ProcessedWebhookEvent_status_createdAt_idx"
ON "ProcessedWebhookEvent"("status", "createdAt");
