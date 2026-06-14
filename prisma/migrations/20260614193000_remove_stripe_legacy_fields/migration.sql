DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CheckoutRecoverySession' AND column_name = 'stripeSessionId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CheckoutRecoverySession' AND column_name = 'paymentOrderCode'
  ) THEN
    ALTER TABLE "CheckoutRecoverySession"
      RENAME COLUMN "stripeSessionId" TO "paymentOrderCode";
  END IF;
END $$;

ALTER INDEX IF EXISTS "CheckoutRecoverySession_stripeSessionId_key"
  RENAME TO "CheckoutRecoverySession_paymentOrderCode_key";

DROP INDEX IF EXISTS "ReviewIncentive_stripePromotionCodeId_key";

ALTER TABLE "ReviewIncentive" DROP COLUMN IF EXISTS "stripePromotionCodeId";
