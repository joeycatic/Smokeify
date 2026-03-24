CREATE TYPE "Storefront" AS ENUM ('MAIN', 'GROW');

ALTER TABLE "Product"
ADD COLUMN "storefronts" "Storefront"[] NOT NULL DEFAULT ARRAY['MAIN']::"Storefront"[];

ALTER TABLE "Category"
ADD COLUMN "storefronts" "Storefront"[] NOT NULL DEFAULT ARRAY['MAIN']::"Storefront"[];

UPDATE "Category"
SET "storefronts" = ARRAY['MAIN', 'GROW']::"Storefront"[]
WHERE LOWER(handle) IN (
  'anzucht',
  'autopot',
  'bewaesserung',
  'duenger',
  'hydroponik',
  'licht',
  'luft',
  'luftentfeuchter',
  'messen',
  'ph-regulatoren',
  'rohrventilatoren',
  'sets',
  'substrate',
  'substrate-und-zubehoer',
  'ventilatoren',
  'wasserfilter-und-osmose',
  'zelte'
);

UPDATE "Product" p
SET "storefronts" = ARRAY['MAIN', 'GROW']::"Storefront"[]
WHERE EXISTS (
  SELECT 1
  FROM "Category" mc
  WHERE mc.id = p."mainCategoryId"
    AND LOWER(mc.handle) IN (
      'anzucht',
      'autopot',
      'bewaesserung',
      'duenger',
      'hydroponik',
      'licht',
      'luft',
      'luftentfeuchter',
      'messen',
      'ph-regulatoren',
      'rohrventilatoren',
      'sets',
      'substrate',
      'substrate-und-zubehoer',
      'ventilatoren',
      'wasserfilter-und-osmose',
      'zelte'
    )
)
OR EXISTS (
  SELECT 1
  FROM "ProductCategory" pc
  JOIN "Category" c ON c.id = pc."categoryId"
  WHERE pc."productId" = p.id
    AND LOWER(c.handle) IN (
      'anzucht',
      'autopot',
      'bewaesserung',
      'duenger',
      'hydroponik',
      'licht',
      'luft',
      'luftentfeuchter',
      'messen',
      'ph-regulatoren',
      'rohrventilatoren',
      'sets',
      'substrate',
      'substrate-und-zubehoer',
      'ventilatoren',
      'wasserfilter-und-osmose',
      'zelte'
    )
);

UPDATE "Product" p
SET "storefronts" = ARRAY['MAIN']::"Storefront"[]
WHERE EXISTS (
  SELECT 1
  FROM "Category" mc
  WHERE mc.id = p."mainCategoryId"
    AND LOWER(mc.handle) IN (
      'headshop',
      'aschenbecher',
      'aufbewahrung',
      'bongs',
      'feuerzeuge',
      'filter',
      'grinder',
      'kraeuterschale',
      'hash-bowl',
      'papers',
      'pipes',
      'rolling-tray',
      'tubes',
      'vaporizer',
      'waagen',
      'seeds'
    )
)
OR EXISTS (
  SELECT 1
  FROM "ProductCategory" pc
  JOIN "Category" c ON c.id = pc."categoryId"
  WHERE pc."productId" = p.id
    AND LOWER(c.handle) IN (
      'headshop',
      'aschenbecher',
      'aufbewahrung',
      'bongs',
      'feuerzeuge',
      'filter',
      'grinder',
      'kraeuterschale',
      'hash-bowl',
      'papers',
      'pipes',
      'rolling-tray',
      'tubes',
      'vaporizer',
      'waagen',
      'seeds'
    )
);
