DO $$
BEGIN
  CREATE TYPE "MarketingStorefrontScope" AS ENUM ('ALL', 'MAIN', 'GROW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MarketingCampaignStatus" AS ENUM (
    'DRAFT',
    'READY',
    'SCHEDULED',
    'SENDING',
    'SENT',
    'PAUSED',
    'FAILED',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MarketingAutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MarketingContactProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "name" TEXT,
  "storefrontScope" "MarketingStorefrontScope" NOT NULL DEFAULT 'ALL',
  "storefrontAffinity" "Storefront",
  "lifecycleStage" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "consentStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "totalRevenueCents" INTEGER NOT NULL DEFAULT 0,
  "averageOrderCents" INTEGER NOT NULL DEFAULT 0,
  "lastOrderAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingContactProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingContactProfile_userId_key"
  ON "MarketingContactProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingContactProfile_email_key"
  ON "MarketingContactProfile"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingContactProfile_normalizedEmail_key"
  ON "MarketingContactProfile"("normalizedEmail");
CREATE INDEX IF NOT EXISTS "MarketingContactProfile_storefrontScope_lifecycleStage_idx"
  ON "MarketingContactProfile"("storefrontScope", "lifecycleStage");
CREATE INDEX IF NOT EXISTS "MarketingContactProfile_storefrontAffinity_updatedAt_idx"
  ON "MarketingContactProfile"("storefrontAffinity", "updatedAt");
CREATE INDEX IF NOT EXISTS "MarketingContactProfile_consentStatus_updatedAt_idx"
  ON "MarketingContactProfile"("consentStatus", "updatedAt");
CREATE INDEX IF NOT EXISTS "MarketingContactProfile_lastActivityAt_idx"
  ON "MarketingContactProfile"("lastActivityAt");

CREATE TABLE IF NOT EXISTS "MarketingAudience" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "storefrontScope" "MarketingStorefrontScope" NOT NULL DEFAULT 'ALL',
  "filters" JSONB NOT NULL,
  "computedCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingAudience_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingAudience_storefrontScope_status_updatedAt_idx"
  ON "MarketingAudience"("storefrontScope", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "MarketingAudience_createdAt_idx"
  ON "MarketingAudience"("createdAt");

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "storefrontScope" "MarketingStorefrontScope" NOT NULL DEFAULT 'ALL',
  "audienceId" TEXT,
  "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "subject" TEXT,
  "body" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "attemptedCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketingCampaign_audienceId_fkey"
    FOREIGN KEY ("audienceId") REFERENCES "MarketingAudience"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MarketingCampaign_storefrontScope_status_updatedAt_idx"
  ON "MarketingCampaign"("storefrontScope", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_audienceId_updatedAt_idx"
  ON "MarketingCampaign"("audienceId", "updatedAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_scheduledAt_idx"
  ON "MarketingCampaign"("scheduledAt");

CREATE TABLE IF NOT EXISTS "MarketingAutomationFlow" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "storefrontScope" "MarketingStorefrontScope" NOT NULL DEFAULT 'ALL',
  "status" "MarketingAutomationStatus" NOT NULL DEFAULT 'DRAFT',
  "config" JSONB NOT NULL,
  "metrics" JSONB,
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingAutomationFlow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingAutomationFlow_key_key"
  ON "MarketingAutomationFlow"("key");
CREATE INDEX IF NOT EXISTS "MarketingAutomationFlow_storefrontScope_status_updatedAt_idx"
  ON "MarketingAutomationFlow"("storefrontScope", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "MarketingAutomationFlow_type_updatedAt_idx"
  ON "MarketingAutomationFlow"("type", "updatedAt");

CREATE TABLE IF NOT EXISTS "MarketingActivity" (
  "id" TEXT NOT NULL,
  "contactProfileId" TEXT,
  "campaignId" TEXT,
  "audienceId" TEXT,
  "storefrontScope" "MarketingStorefrontScope" NOT NULL DEFAULT 'ALL',
  "storefront" "Storefront",
  "activityType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "metadata" JSONB,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "actorId" TEXT,
  "actorEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketingActivity_contactProfileId_fkey"
    FOREIGN KEY ("contactProfileId") REFERENCES "MarketingContactProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MarketingActivity_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MarketingActivity_audienceId_fkey"
    FOREIGN KEY ("audienceId") REFERENCES "MarketingAudience"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MarketingActivity_contactProfileId_createdAt_idx"
  ON "MarketingActivity"("contactProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingActivity_campaignId_createdAt_idx"
  ON "MarketingActivity"("campaignId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingActivity_audienceId_createdAt_idx"
  ON "MarketingActivity"("audienceId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingActivity_storefrontScope_activityType_createdAt_idx"
  ON "MarketingActivity"("storefrontScope", "activityType", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingActivity_storefront_createdAt_idx"
  ON "MarketingActivity"("storefront", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingActivity_dueAt_completedAt_idx"
  ON "MarketingActivity"("dueAt", "completedAt");
