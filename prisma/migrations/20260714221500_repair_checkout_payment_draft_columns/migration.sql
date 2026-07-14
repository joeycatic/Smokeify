-- Repair drift from CheckoutPaymentDraft instances created without all columns
-- declared by the original Viva checkout migration.
ALTER TABLE "CheckoutPaymentDraft"
  ADD COLUMN IF NOT EXISTS "recoveredFromCheckoutSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "CheckoutPaymentDraft"
  ALTER COLUMN "editTokenHash" SET NOT NULL;
