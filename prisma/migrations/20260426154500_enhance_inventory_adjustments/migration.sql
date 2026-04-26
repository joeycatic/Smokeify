ALTER TABLE "InventoryAdjustment"
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "actorId" TEXT,
ADD COLUMN "note" TEXT;

CREATE INDEX "InventoryAdjustment_sourceType_sourceId_idx"
ON "InventoryAdjustment"("sourceType", "sourceId");
