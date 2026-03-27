ALTER TABLE "Order"
ADD COLUMN "sourceStorefront" "Storefront",
ADD COLUMN "sourceHost" TEXT,
ADD COLUMN "sourceOrigin" TEXT;

CREATE INDEX "Order_sourceStorefront_createdAt_idx"
ON "Order"("sourceStorefront", "createdAt");

CREATE TABLE "LandingPageSection" (
    "id" TEXT NOT NULL,
    "storefront" "Storefront" NOT NULL DEFAULT 'MAIN',
    "key" TEXT NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPageSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LandingPageSection_storefront_key_key"
ON "LandingPageSection"("storefront", "key");
