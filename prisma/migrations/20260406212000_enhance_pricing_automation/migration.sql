DO $$
BEGIN
  IF to_regtype('"PricingRunStatus"') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'RUNNING'
      AND enumtypid = to_regtype('"PricingRunStatus"')
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
