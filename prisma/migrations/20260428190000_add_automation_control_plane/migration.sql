CREATE TYPE "AutomationJobStatus" AS ENUM (
  'QUEUED',
  'LEASED',
  'SUCCEEDED',
  'FAILED',
  'DEAD_LETTER',
  'CANCELED'
);

CREATE TYPE "AutomationJobAttemptStatus" AS ENUM (
  'STARTED',
  'SUCCEEDED',
  'FAILED',
  'CANCELED'
);

CREATE TYPE "AutomationScheduleStatus" AS ENUM (
  'ACTIVE',
  'PAUSED'
);

CREATE TYPE "AutomationEventStatus" AS ENUM (
  'PENDING',
  'PROCESSED',
  'FAILED'
);

CREATE TYPE "AutomationEffectStatus" AS ENUM (
  'APPLIED',
  'SKIPPED',
  'FAILED'
);

CREATE TYPE "CustomizerPresetSlot" AS ENUM (
  'SIZE',
  'LIGHT',
  'VENT'
);

CREATE TYPE "CustomizerPresetPriceBias" AS ENUM (
  'BUDGET',
  'BALANCED',
  'PREMIUM'
);

CREATE TYPE "CustomizerPresetDiameterBias" AS ENUM (
  'SMALLEST',
  'LARGEST'
);

CREATE TABLE "AutomationSchedule" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "handler" TEXT NOT NULL,
  "status" "AutomationScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
  "cronExpression" TEXT,
  "nextRunAt" TIMESTAMP(3),
  "lastEnqueuedAt" TIMESTAMP(3),
  "lastSucceededAt" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "payload" JSONB,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationJob" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT,
  "status" "AutomationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "handler" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "dedupeKey" TEXT,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leasedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "leasedBy" TEXT,
  "lastError" TEXT,
  "lastResult" JSONB,
  "completedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationJobAttempt" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "AutomationJobAttemptStatus" NOT NULL DEFAULT 'STARTED',
  "workerId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "result" JSONB,
  CONSTRAINT "AutomationJobAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "storefront" "Storefront",
  "payload" JSONB NOT NULL,
  "status" "AutomationEventStatus" NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationEffect" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "effectType" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "status" "AutomationEffectStatus" NOT NULL DEFAULT 'APPLIED',
  "payload" JSONB,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationEffect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyzerRecommendationProfile" (
  "id" TEXT NOT NULL,
  "issueKey" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT NOT NULL,
  "categoryHandles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "titleTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "handleTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "manufacturers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excludeTitleTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excludeHandleTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "skip" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyzerRecommendationProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyzerGuideProfile" (
  "id" TEXT NOT NULL,
  "issueKey" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "blogSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyzerGuideProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomizerPreset" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "explainer" TEXT NOT NULL,
  "supportedSizeKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "defaultSizeKey" TEXT NOT NULL,
  "reasonLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomizerPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomizerPresetSlotRule" (
  "id" TEXT NOT NULL,
  "presetId" TEXT NOT NULL,
  "slot" "CustomizerPresetSlot" NOT NULL,
  "reason" TEXT NOT NULL,
  "reasonLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "avoidKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priceBias" "CustomizerPresetPriceBias" NOT NULL DEFAULT 'BALANCED',
  "requireSet" BOOLEAN NOT NULL DEFAULT false,
  "preferredDiameter" "CustomizerPresetDiameterBias",
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CustomizerPresetSlotRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomizerPresetExtraRule" (
  "id" TEXT NOT NULL,
  "presetId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reasonLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "avoidKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priceBias" "CustomizerPresetPriceBias" NOT NULL DEFAULT 'BALANCED',
  "requireSet" BOOLEAN NOT NULL DEFAULT false,
  "preferredDiameter" "CustomizerPresetDiameterBias",
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CustomizerPresetExtraRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationSchedule_key_key" ON "AutomationSchedule"("key");
CREATE INDEX "AutomationSchedule_status_nextRunAt_idx" ON "AutomationSchedule"("status", "nextRunAt");

CREATE INDEX "AutomationJob_status_runAfter_idx" ON "AutomationJob"("status", "runAfter");
CREATE INDEX "AutomationJob_dedupeKey_idx" ON "AutomationJob"("dedupeKey");
CREATE INDEX "AutomationJob_scheduleId_createdAt_idx" ON "AutomationJob"("scheduleId", "createdAt");

CREATE UNIQUE INDEX "AutomationJobAttempt_jobId_attemptNumber_key" ON "AutomationJobAttempt"("jobId", "attemptNumber");
CREATE INDEX "AutomationJobAttempt_jobId_startedAt_idx" ON "AutomationJobAttempt"("jobId", "startedAt");

CREATE INDEX "AutomationEvent_eventType_createdAt_idx" ON "AutomationEvent"("eventType", "createdAt");
CREATE INDEX "AutomationEvent_aggregateType_aggregateId_createdAt_idx" ON "AutomationEvent"("aggregateType", "aggregateId", "createdAt");
CREATE INDEX "AutomationEvent_status_createdAt_idx" ON "AutomationEvent"("status", "createdAt");

CREATE UNIQUE INDEX "AutomationEffect_dedupeKey_key" ON "AutomationEffect"("dedupeKey");
CREATE INDEX "AutomationEffect_eventId_createdAt_idx" ON "AutomationEffect"("eventId", "createdAt");
CREATE INDEX "AutomationEffect_targetType_targetId_idx" ON "AutomationEffect"("targetType", "targetId");

CREATE INDEX "AnalyzerRecommendationProfile_issueKey_isActive_priority_idx" ON "AnalyzerRecommendationProfile"("issueKey", "isActive", "priority");
CREATE INDEX "AnalyzerGuideProfile_issueKey_isActive_priority_idx" ON "AnalyzerGuideProfile"("issueKey", "isActive", "priority");

CREATE UNIQUE INDEX "CustomizerPreset_slug_key" ON "CustomizerPreset"("slug");
CREATE UNIQUE INDEX "CustomizerPresetSlotRule_presetId_slot_key" ON "CustomizerPresetSlotRule"("presetId", "slot");
CREATE INDEX "CustomizerPresetSlotRule_slot_sortOrder_idx" ON "CustomizerPresetSlotRule"("slot", "sortOrder");
CREATE UNIQUE INDEX "CustomizerPresetExtraRule_presetId_key_key" ON "CustomizerPresetExtraRule"("presetId", "key");
CREATE INDEX "CustomizerPresetExtraRule_presetId_sortOrder_idx" ON "CustomizerPresetExtraRule"("presetId", "sortOrder");

ALTER TABLE "AutomationJob"
  ADD CONSTRAINT "AutomationJob_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "AutomationSchedule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationJobAttempt"
  ADD CONSTRAINT "AutomationJobAttempt_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "AutomationJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationEffect"
  ADD CONSTRAINT "AutomationEffect_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "AutomationEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomizerPresetSlotRule"
  ADD CONSTRAINT "CustomizerPresetSlotRule_presetId_fkey"
  FOREIGN KEY ("presetId") REFERENCES "CustomizerPreset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomizerPresetExtraRule"
  ADD CONSTRAINT "CustomizerPresetExtraRule_presetId_fkey"
  FOREIGN KEY ("presetId") REFERENCES "CustomizerPreset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
