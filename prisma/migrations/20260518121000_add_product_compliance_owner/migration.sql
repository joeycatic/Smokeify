ALTER TABLE "Product"
ADD COLUMN "complianceOwnerId" TEXT,
ADD COLUMN "complianceOwnerEmail" TEXT;

CREATE INDEX "Product_complianceOwnerId_idx" ON "Product"("complianceOwnerId");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_complianceOwnerId_fkey"
FOREIGN KEY ("complianceOwnerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
