ALTER TABLE "SupplierImportBatch"
ADD COLUMN "changedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SupplierImportItem"
ADD COLUMN "sourceChanges" JSONB,
ADD COLUMN "sourceChangedAt" TIMESTAMP(3);
