-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderNumber" INTEGER;

-- Backfill in creation order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "Order"
)
UPDATE "Order"
SET "orderNumber" = ordered.rn
FROM ordered
WHERE "Order".id = ordered.id;

-- CreateSequence
CREATE SEQUENCE "Order_orderNumber_seq";
SELECT setval(
  '"Order_orderNumber_seq"',
  (SELECT GREATEST(COALESCE(MAX("orderNumber"), 0), 1) FROM "Order")
);

-- AlterTable
ALTER TABLE "Order"
  ALTER COLUMN "orderNumber" SET NOT NULL,
  ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"');

-- AlterSequence
ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
