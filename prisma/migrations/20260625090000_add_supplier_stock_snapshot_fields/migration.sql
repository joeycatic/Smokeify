ALTER TABLE "VariantInventory"
  ADD COLUMN "supplierReportedStock" INTEGER,
  ADD COLUMN "supplierStockSyncedAt" TIMESTAMP(3),
  ADD COLUMN "supplierStockSource" TEXT;
