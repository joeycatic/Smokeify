ALTER TABLE "ProcessedWebhookEvent"
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "errorContext" JSONB;
