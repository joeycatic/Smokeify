# Scripts Folder Structure

## `scripts/bloomtech`
- `scrapeSupplierPreview.mjs`: scrape Bloomtech supplier data into a local preview JSON.
- `importPreviewToCatalog.mjs`: import/reprice Bloomtech catalog items from preview JSON.
- `overridePricesAndCosts.mjs`: override cost + price on existing Bloomtech products from preview JSON (`--apply` to write).
- `reportMissingCosts.mjs`: list Bloomtech variants with missing/invalid `costCents` (includes product + variant titles).
- `my-preview.json`: sample preview file for local testing.
- `supplier-preview.json`: default scrape output / import input.

## `scripts/b2b-headshop`
- `scrapeSupplierPreview.mjs`: scrape B2B Headshop supplier data into local preview JSON (supports login/cookie auth).
- `overridePricesAndCosts.mjs`: override cost + price on existing B2B Headshop products (preview/db/hybrid sources, `--apply` to write).
- `reportMissingCosts.mjs`: list B2B Headshop variants with missing/invalid `costCents` (includes product + variant titles).
- `supplier-preview.json`: optional preview input file path used by override script.

## `scripts/suppliers`
- `syncSupplierStock.mjs`: sync stock quantities from supplier product pages.

## `scripts/orders`
- `backfillOrderPaymentFees.mjs`: backfill Stripe payment fee data on historical orders.

## `scripts/testing`
- `seedTestOrders.js`: generate test orders for admin/testing flows.

## `scripts/maintenance`
- `cleanupTestUsers.js`: remove test users.
- `migrateUploadsToBlob.js`: migrate upload assets to Vercel Blob.
