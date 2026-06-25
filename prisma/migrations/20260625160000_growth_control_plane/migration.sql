DO $$
BEGIN
  CREATE TYPE "NewsletterInterest" AS ENUM (
    'BEGINNER_SETUP',
    'PLANT_TROUBLESHOOTING',
    'CLIMATE_AND_AIRFLOW',
    'NUTRIENTS_AND_PH',
    'OFFERS_AND_NEW_ARRIVALS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NewsletterSource" AS ENUM (
    'FOOTER',
    'NEWSLETTER_OFFER_POPUP',
    'BLOG_GUIDE',
    'PLANT_ANALYZER',
    'PLANT_CASE_LIBRARY',
    'REGISTER',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "NewsletterSubscriber"
  ADD COLUMN IF NOT EXISTS "interests" "NewsletterInterest"[] DEFAULT ARRAY[]::"NewsletterInterest"[],
  ADD COLUMN IF NOT EXISTS "source" "NewsletterSource",
  ADD COLUMN IF NOT EXISTS "sourcePath" TEXT,
  ADD COLUMN IF NOT EXISTS "locale" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceContext" JSONB,
  ADD COLUMN IF NOT EXISTS "lastSegmentedAt" TIMESTAMP(3);

ALTER TABLE "BackInStockRequest"
  ADD COLUMN IF NOT EXISTS "storefront" "Storefront",
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastError" TEXT,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "BackInStockRequest_storefront_notifiedAt_idx"
  ON "BackInStockRequest"("storefront", "notifiedAt");

CREATE TABLE IF NOT EXISTS "GrowthConfig" (
  "key" TEXT NOT NULL,
  "storefront" "Storefront" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthConfig_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "GrowthConfig_storefront_enabled_idx"
  ON "GrowthConfig"("storefront", "enabled");

CREATE TABLE IF NOT EXISTS "WelcomeSeriesEnrollment" (
  "id" TEXT NOT NULL,
  "storefront" "Storefront" NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "discountCode" TEXT,
  "discountExpiresAt" TIMESTAMP(3),
  "nextStep" INTEGER NOT NULL DEFAULT 1,
  "nextSendAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "unsubscribedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WelcomeSeriesEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WelcomeSeriesEnrollment_storefront_email_key"
  ON "WelcomeSeriesEnrollment"("storefront", "email");
CREATE INDEX IF NOT EXISTS "WelcomeSeriesEnrollment_status_nextSendAt_idx"
  ON "WelcomeSeriesEnrollment"("status", "nextSendAt");

CREATE TABLE IF NOT EXISTS "WelcomeSeriesAttempt" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WelcomeSeriesAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WelcomeSeriesAttempt_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "WelcomeSeriesEnrollment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WelcomeSeriesAttempt_enrollmentId_stepIndex_key"
  ON "WelcomeSeriesAttempt"("enrollmentId", "stepIndex");
CREATE INDEX IF NOT EXISTS "WelcomeSeriesAttempt_status_scheduledFor_idx"
  ON "WelcomeSeriesAttempt"("status", "scheduledFor");

CREATE TABLE IF NOT EXISTS "ContentArticle" (
  "id" TEXT NOT NULL,
  "storefront" "Storefront" NOT NULL DEFAULT 'GROW',
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "keyword" TEXT,
  "searchIntent" TEXT,
  "cluster" TEXT,
  "body" JSONB NOT NULL,
  "internalLinks" JSONB,
  "cta" JSONB,
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentArticle_storefront_slug_key"
  ON "ContentArticle"("storefront", "slug");
CREATE INDEX IF NOT EXISTS "ContentArticle_storefront_status_publishedAt_idx"
  ON "ContentArticle"("storefront", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "ContentArticle_status_scheduledAt_idx"
  ON "ContentArticle"("status", "scheduledAt");
