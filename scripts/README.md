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
- `overrideGtinsFromPreview.mjs`: sync GTIN into product `technicalDetails` for Bloomtech + B2B Headshop (`--source live` default via stored `sellerUrl`, optional `--source preview`/`--source auto`, dry-run by default, `--apply` to write).

## `scripts/orders`
- `backfillOrderPaymentFees.mjs`: backfill Stripe payment fee data on historical orders.

## `scripts/market`
- `shop-sources.json`: curated grow/headshop source list for direct search scraping. Use `{query}` in each URL template.
- `shopsPriceStats.mjs`: query configured direct shops from `shop-sources.json` and output aggregated lowest/average/highest prices (JSON + CSV).
  - useful flags: `--sources`, `--limit`, `--all-statuses`, `--only-shop`, `--max-shops`, `--delay-ms`, `--shop-delay-ms`, `--shop-concurrency`, `--shop-timeout-skip-after`, `--timeout-ms`, `--retries`, `--retry-timeouts`, `--max-html-bytes`, `--show-links`, `--show-reachable-links`, `--max-matched-links-per-shop`, `--no-verify-product-pages`, `--debug-html-dir`
- `geizhalsPriceStats.mjs`: query Geizhals per product and output lowest/average/highest observed prices (JSON + CSV).
  - useful flags: `--limit`, `--all-statuses`, `--delay-ms`, `--max-delay-ms`, `--timeout-ms`, `--retries`, `--retry-timeouts`, `--max-html-bytes`, `--throttle-stop-after`, `--cookie`, `--debug-html-dir`
- `preisvergleichPriceStats.mjs`: query Preisvergleich.de per product and output lowest/average/highest observed prices (JSON + CSV).
  - useful flags: `--limit`, `--all-statuses`, `--delay-ms`, `--max-delay-ms`, `--timeout-ms`, `--retries`, `--retry-timeouts`, `--max-html-bytes`, `--throttle-stop-after`, `--cookie`, `--debug-html-dir`
- `googleShoppingPriceStats.mjs`: query Google Shopping per product and output lowest/average/highest observed prices (JSON + CSV).
  - useful flags: `--limit`, `--country`, `--lang`, `--delay-ms`, `--timeout-ms`, `--retries`, `--debug-html-dir`

## `scripts/testing`
- `seedTestOrders.js`: generate test orders for admin/testing flows.

## `scripts/maintenance`
- `cleanupTestUsers.js`: remove test users.
- `migrateUploadsToBlob.js`: migrate upload assets to Vercel Blob.
