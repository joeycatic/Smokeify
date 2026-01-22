-- Add seller metadata to products
ALTER TABLE "Product"
ADD COLUMN "sellerName" TEXT,
ADD COLUMN "sellerUrl" TEXT;
