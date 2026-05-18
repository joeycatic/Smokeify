CREATE TABLE "AnalyticsSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "firstPath" TEXT,
  "lastPath" TEXT,
  "firstPageType" TEXT,
  "lastPageType" TEXT,
  "firstReferrer" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "deviceType" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "eventName" TEXT NOT NULL,
  "pagePath" TEXT,
  "pageType" TEXT,
  "referrer" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "productId" TEXT,
  "variantId" TEXT,
  "orderId" TEXT,
  "currency" TEXT,
  "valueCents" INTEGER,
  "quantity" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsSession_lastSeenAt_idx"
  ON "AnalyticsSession"("lastSeenAt");

CREATE INDEX "AnalyticsSession_userId_lastSeenAt_idx"
  ON "AnalyticsSession"("userId", "lastSeenAt");

CREATE INDEX "AnalyticsSession_utmSource_lastSeenAt_idx"
  ON "AnalyticsSession"("utmSource", "lastSeenAt");

CREATE INDEX "AnalyticsEvent_eventName_createdAt_idx"
  ON "AnalyticsEvent"("eventName", "createdAt");

CREATE INDEX "AnalyticsEvent_pageType_createdAt_idx"
  ON "AnalyticsEvent"("pageType", "createdAt");

CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx"
  ON "AnalyticsEvent"("sessionId", "createdAt");

CREATE INDEX "AnalyticsEvent_userId_createdAt_idx"
  ON "AnalyticsEvent"("userId", "createdAt");

CREATE INDEX "AnalyticsEvent_productId_eventName_createdAt_idx"
  ON "AnalyticsEvent"("productId", "eventName", "createdAt");

CREATE INDEX "AnalyticsEvent_variantId_eventName_createdAt_idx"
  ON "AnalyticsEvent"("variantId", "eventName", "createdAt");

CREATE INDEX "AnalyticsEvent_orderId_idx"
  ON "AnalyticsEvent"("orderId");

ALTER TABLE "AnalyticsSession"
  ADD CONSTRAINT "AnalyticsSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AnalyticsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
