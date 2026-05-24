ALTER TABLE "AdminSavedReport"
ADD COLUMN "deliveryRecipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "lastDeliveryError" TEXT;

UPDATE "AdminSavedReport"
SET "deliveryRecipients" = ARRAY[LOWER(TRIM("deliveryEmail"))]
WHERE "deliveryEmail" IS NOT NULL
  AND LENGTH(TRIM("deliveryEmail")) > 0;
