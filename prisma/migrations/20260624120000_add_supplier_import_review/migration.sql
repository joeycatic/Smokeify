CREATE TYPE "SupplierImportBatchStatus" AS ENUM ('FETCHING', 'READY', 'PARTIAL', 'FAILED');
CREATE TYPE "SupplierImportItemStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'IMPORT_ERROR');

CREATE TABLE "SupplierImportBatch" (
    "id" TEXT NOT NULL,
    "supplierKey" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "mainCategoryId" TEXT NOT NULL,
    "additionalCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SupplierImportBatchStatus" NOT NULL DEFAULT 'FETCHING',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "SupplierImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierImportItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourcePayload" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "manufacturer" TEXT,
    "handle" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "technicalDetails" TEXT,
    "gtin" TEXT,
    "sku" TEXT,
    "costCents" INTEGER,
    "priceCents" INTEGER,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SupplierImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "linkedProductId" TEXT,
    "importError" TEXT,
    "decidedById" TEXT,
    "decidedByEmail" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierImportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierImportItem_sourceUrl_key" ON "SupplierImportItem"("sourceUrl");
CREATE INDEX "SupplierImportBatch_supplierKey_createdAt_idx" ON "SupplierImportBatch"("supplierKey", "createdAt");
CREATE INDEX "SupplierImportBatch_status_updatedAt_idx" ON "SupplierImportBatch"("status", "updatedAt");
CREATE INDEX "SupplierImportItem_batchId_status_createdAt_idx" ON "SupplierImportItem"("batchId", "status", "createdAt");
CREATE INDEX "SupplierImportItem_linkedProductId_idx" ON "SupplierImportItem"("linkedProductId");
CREATE INDEX "SupplierImportItem_status_updatedAt_idx" ON "SupplierImportItem"("status", "updatedAt");

ALTER TABLE "SupplierImportItem"
ADD CONSTRAINT "SupplierImportItem_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "SupplierImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierImportItem"
ADD CONSTRAINT "SupplierImportItem_linkedProductId_fkey"
FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
