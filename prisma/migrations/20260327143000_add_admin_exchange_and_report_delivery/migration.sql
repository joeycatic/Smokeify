CREATE TYPE "AdminReportDeliveryFrequency" AS ENUM ('DAILY', 'WEEKLY');

ALTER TABLE "AdminSavedReport"
  ADD COLUMN "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryEmail" TEXT,
  ADD COLUMN "deliveryFrequency" "AdminReportDeliveryFrequency",
  ADD COLUMN "deliveryWeekday" INTEGER,
  ADD COLUMN "deliveryHour" INTEGER,
  ADD COLUMN "lastDeliveredAt" TIMESTAMP(3),
  ADD COLUMN "nextDeliveryAt" TIMESTAMP(3);

ALTER TABLE "ReturnRequest"
  ADD COLUMN "exchangeOrderId" TEXT,
  ADD COLUMN "exchangeApprovedAt" TIMESTAMP(3);

CREATE INDEX "AdminSavedReport_nextDeliveryAt_idx" ON "AdminSavedReport"("nextDeliveryAt");
CREATE UNIQUE INDEX "ReturnRequest_exchangeOrderId_key" ON "ReturnRequest"("exchangeOrderId");

ALTER TABLE "ReturnRequest"
  ADD CONSTRAINT "ReturnRequest_exchangeOrderId_fkey"
  FOREIGN KEY ("exchangeOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
