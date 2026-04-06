DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'RUNNING'
      AND enumtypid = 'PricingRunStatus'::regtype
  ) THEN
    ALTER TYPE "PricingRunStatus" ADD VALUE 'RUNNING';
  END IF;
END $$;

ALTER TABLE "VariantPricingProfile"
ADD COLUMN "competitorHighPriceCents" INTEGER,
ADD COLUMN "publicCompareAtCents" INTEGER;

ALTER TABLE "PricingChangeAudit"
ADD COLUMN "oldCompareAtCents" INTEGER,
ADD COLUMN "newCompareAtCents" INTEGER;
