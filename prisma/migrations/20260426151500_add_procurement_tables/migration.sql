CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELED'
);

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "purchaseOrderNumber" SERIAL NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" TEXT,
  "note" TEXT,
  "expectedDeliveryAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "updatedById" TEXT,
  "updatedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrder_purchaseOrderNumber_key"
ON "PurchaseOrder"("purchaseOrderNumber");

CREATE INDEX "PurchaseOrder_supplierId_status_updatedAt_idx"
ON "PurchaseOrder"("supplierId", "status", "updatedAt");

CREATE INDEX "PurchaseOrder_status_updatedAt_idx"
ON "PurchaseOrder"("status", "updatedAt");

CREATE INDEX "PurchaseOrder_expectedDeliveryAt_idx"
ON "PurchaseOrder"("expectedDeliveryAt");

CREATE TABLE "PurchaseOrderItem" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "skuSnapshot" TEXT,
  "productTitle" TEXT NOT NULL,
  "variantTitle" TEXT NOT NULL,
  "orderedQuantity" INTEGER NOT NULL,
  "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitCostCents" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx"
ON "PurchaseOrderItem"("purchaseOrderId");

CREATE INDEX "PurchaseOrderItem_productId_idx"
ON "PurchaseOrderItem"("productId");

CREATE INDEX "PurchaseOrderItem_variantId_idx"
ON "PurchaseOrderItem"("variantId");

CREATE TABLE "PurchaseOrderReceipt" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "note" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "reversedByEmail" TEXT,
  "reversalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrderReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderReceipt_purchaseOrderId_receivedAt_idx"
ON "PurchaseOrderReceipt"("purchaseOrderId", "receivedAt");

CREATE INDEX "PurchaseOrderReceipt_reversedAt_idx"
ON "PurchaseOrderReceipt"("reversedAt");

CREATE TABLE "PurchaseOrderReceiptItem" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "purchaseOrderItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantityReceived" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrderReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderReceiptItem_receiptId_idx"
ON "PurchaseOrderReceiptItem"("receiptId");

CREATE INDEX "PurchaseOrderReceiptItem_purchaseOrderItemId_idx"
ON "PurchaseOrderReceiptItem"("purchaseOrderItemId");

CREATE TABLE "PurchaseOrderEvent" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "eventType" TEXT NOT NULL,
  "summary" TEXT,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderEvent_purchaseOrderId_createdAt_idx"
ON "PurchaseOrderEvent"("purchaseOrderId", "createdAt");

ALTER TABLE "Expense"
ADD COLUMN "purchaseOrderId" TEXT;

CREATE INDEX "Expense_purchaseOrderId_idx"
ON "Expense"("purchaseOrderId");

ALTER TABLE "PurchaseOrder"
ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "Variant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderReceipt"
ADD CONSTRAINT "PurchaseOrderReceipt_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderReceiptItem"
ADD CONSTRAINT "PurchaseOrderReceiptItem_receiptId_fkey"
FOREIGN KEY ("receiptId") REFERENCES "PurchaseOrderReceipt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderReceiptItem"
ADD CONSTRAINT "PurchaseOrderReceiptItem_purchaseOrderItemId_fkey"
FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderReceiptItem"
ADD CONSTRAINT "PurchaseOrderReceiptItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderReceiptItem"
ADD CONSTRAINT "PurchaseOrderReceiptItem_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "Variant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderEvent"
ADD CONSTRAINT "PurchaseOrderEvent_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
