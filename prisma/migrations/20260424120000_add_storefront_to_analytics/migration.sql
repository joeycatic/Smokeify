ALTER TABLE "AnalyticsSession"
ADD COLUMN "storefront" "Storefront";

ALTER TABLE "AnalyticsEvent"
ADD COLUMN "storefront" "Storefront";

CREATE INDEX "AnalyticsSession_storefront_lastSeenAt_idx"
ON "AnalyticsSession"("storefront", "lastSeenAt");

CREATE INDEX "AnalyticsEvent_storefront_eventName_createdAt_idx"
ON "AnalyticsEvent"("storefront", "eventName", "createdAt");
