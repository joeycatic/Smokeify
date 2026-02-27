/**
 * Fetches full product catalogs from Shopify-based competitor shops via
 * /products.json (no bot protection) and matches against your DB products.
 *
 * Add `"type": "shopify"` to any shop in shop-sources.json to include it.
 * Outputs the same JSON format as shopsPriceStats.mjs so analyzePriceReport.mjs
 * can read it without changes.
 *
 * Usage:
 *   node scripts/market/shopifyPriceScan.mjs [options]
 *
 * Options:
 *   --sources <path>      shop-sources.json path (default: scripts/market/shop-sources.json)
 *   --output-json <path>  (default: scripts/market/shops-price-report.json)
 *   --output-csv <path>   (default: scripts/market/shops-price-report.csv)
 *   --limit <n>           Max DB products to check (default: all)
 *   --page-size <n>       Products per Shopify page request (default: 250)
 *   --timeout-ms <n>      Per-request timeout (default: 20000)
 *   --min-score <n>       Min title match score to count as a match (default: 3)
 *   --delay-ms <n>        Delay between product pages for a shop (default: 300)
 */

import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flagValue = (f, def) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const toInt = (v, def) => { const n = Number.parseInt(String(v), 10); return Number.isFinite(n) ? n : def; };

const SOURCES_PATH = flagValue("--sources", "scripts/market/shop-sources.json");
const OUTPUT_JSON = flagValue("--output-json", "scripts/market/shops-price-report.json");
const OUTPUT_CSV = flagValue("--output-csv", "scripts/market/shops-price-report.csv");
const LIMIT = toInt(flagValue("--limit", 0), 0);
const PAGE_SIZE = Math.min(250, Math.max(1, toInt(flagValue("--page-size", 250), 250)));
const TIMEOUT_MS = Math.max(5000, toInt(flagValue("--timeout-ms", 20000), 20000));
const MIN_SCORE = toInt(flagValue("--min-score", 3), 3);
const DELAY_MS = toInt(flagValue("--delay-ms", 300), 300);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toCsvLine = (values) =>
  values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");

// ── Title matching ──────────────────────────────────────────────────────────

const normalize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (s) =>
  normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2)
    .filter((t) => !["the", "and", "mit", "und", "der", "die", "das", "set", "fur"].includes(t));

const scoreMatch = (ourProduct, theirTitle) => {
  const theirNorm = normalize(theirTitle);
  const ourTokens = tokenize(`${ourProduct.manufacturer ?? ""} ${ourProduct.title}`);
  const numericTokens = ourTokens.filter((t) => /\d/.test(t));
  const wordTokens = ourTokens.filter((t) => !/\d/.test(t));

  // All numeric tokens must match (model number, size, etc.)
  if (numericTokens.length > 0 && !numericTokens.every((t) => theirNorm.includes(t))) {
    return 0;
  }

  const wordMatches = wordTokens.filter((t) => theirNorm.includes(t)).length;
  const requiredWords = Math.min(2, wordTokens.length);
  if (wordMatches < requiredWords) return 0;

  return numericTokens.length * 5 + wordMatches;
};

// ── Shopify catalog fetch ───────────────────────────────────────────────────

const fetchPage = async (shopDomain, page) => {
  const url = `https://${shopDomain}/products.json?limit=${PAGE_SIZE}&page=${page}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; price-scanner/1.0)",
        accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json.products) ? json.products : [];
  } finally {
    clearTimeout(id);
  }
};

const fetchShopifyCatalog = async (shopDomain) => {
  const all = [];
  let page = 1;
  while (true) {
    const products = await fetchPage(shopDomain, page);
    if (!products.length) break;
    all.push(...products);
    if (products.length < PAGE_SIZE) break;
    page += 1;
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }
  return all;
};

// ── Main ────────────────────────────────────────────────────────────────────

const run = async () => {
  // Load shop sources
  const sourcesRaw = await fs.readFile(SOURCES_PATH, "utf8");
  const sources = JSON.parse(sourcesRaw);
  const shops = (Array.isArray(sources.shops) ? sources.shops : []).filter(
    (s) => s.enabled !== false && s.type === "shopify"
  );

  if (!shops.length) {
    console.log(`[shopify] No shops with type="shopify" found in ${SOURCES_PATH}.`);
    console.log(`[shopify] Add "type": "shopify" to any Shopify store in shop-sources.json.`);
    return;
  }

  console.log(`[shopify] Found ${shops.length} Shopify shop(s): ${shops.map((s) => s.name).join(", ")}`);

  // Fetch all Shopify catalogs
  const shopCatalogs = new Map(); // shopName -> { products, domain }
  for (const shop of shops) {
    const domain = shop.domain;
    console.log(`[shopify] Fetching catalog from ${domain}...`);
    try {
      const products = await fetchShopifyCatalog(domain);
      console.log(`[shopify]   ${domain}: ${products.length} products loaded`);
      shopCatalogs.set(shop.name, { products, domain, shop });
    } catch (err) {
      console.error(`[shopify]   ${domain}: FAILED — ${err.message}`);
      shopCatalogs.set(shop.name, { products: [], domain, shop, error: err.message });
    }
  }

  // Load our DB products
  const dbProducts = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
    include: {
      variants: {
        orderBy: { position: "asc" },
        select: { priceCents: true },
        take: 1,
      },
    },
  });

  if (!dbProducts.length) {
    console.log("[shopify] No active products in DB.");
    return;
  }

  console.log(`[shopify] Matching ${dbProducts.length} DB products against competitor catalogs...`);

  const results = [];

  for (let i = 0; i < dbProducts.length; i++) {
    const product = dbProducts[i];
    const referencePrice = (product.variants?.[0]?.priceCents ?? 0) / 100;
    const allPrices = [];
    const shopResults = [];

    for (const [shopName, catalog] of shopCatalogs) {
      if (catalog.error) {
        shopResults.push({ shop: shopName, status: "error", info: catalog.error });
        continue;
      }

      let bestScore = 0;
      let bestMatch = null;
      let bestUrl = null;

      for (const theirProduct of catalog.products) {
        const score = scoreMatch(product, theirProduct.title);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = theirProduct;
          bestUrl = `https://${catalog.domain}/products/${theirProduct.handle}`;
        }
      }

      if (!bestMatch || bestScore < MIN_SCORE) {
        shopResults.push({ shop: shopName, status: "no_prices_found", info: "Kein Titel-Match" });
        continue;
      }

      // Collect prices from all variants of the matched product
      const prices = (bestMatch.variants ?? [])
        .map((v) => Number(v.price))
        .filter((p) => Number.isFinite(p) && p > 0);

      if (!prices.length) {
        shopResults.push({ shop: shopName, status: "no_prices_found", info: "Keine Varianten-Preise", matchedTitle: bestMatch.title });
        continue;
      }

      const sorted = [...prices].sort((a, b) => a - b);
      const lowest = Number(sorted[0].toFixed(2));
      const highest = Number(sorted[sorted.length - 1].toFixed(2));
      const average = Number((sorted.reduce((s, p) => s + p, 0) / sorted.length).toFixed(2));

      allPrices.push(...prices);
      shopResults.push({
        shop: shopName,
        status: "ok",
        url: bestUrl,
        matchedLinks: [bestUrl],
        matchedTitle: bestMatch.title,
        matchScore: bestScore,
        lowest,
        average,
        highest,
        samples: prices.length,
      });
    }

    // Aggregate across shops
    let finalStats = null;
    if (allPrices.length) {
      const sorted = [...allPrices].sort((a, b) => a - b);
      finalStats = {
        lowest: Number(sorted[0].toFixed(2)),
        average: Number((sorted.reduce((s, p) => s + p, 0) / sorted.length).toFixed(2)),
        highest: Number(sorted[sorted.length - 1].toFixed(2)),
        samples: sorted.length,
      };
    }

    const okShops = shopResults.filter((s) => s.status === "ok").length;
    const label = [product.manufacturer, product.title].filter(Boolean).join(" ");

    results.push({
      productId: product.id,
      title: product.title,
      handle: product.handle,
      manufacturer: product.manufacturer ?? null,
      status: finalStats ? "ok" : "no_prices_found",
      referencePrice: Number.isFinite(referencePrice) && referencePrice > 0
        ? Number(referencePrice.toFixed(2))
        : null,
      ...finalStats,
      sampledShops: okShops,
      blockedShops: 0,
      totalShops: shops.length,
      links: shopResults.filter((s) => s.status === "ok").map((s) => s.url),
      shopResults,
    });

    if (finalStats) {
      console.log(
        `[${i + 1}/${dbProducts.length}] ${label}: low=${finalStats.lowest} avg=${finalStats.average} high=${finalStats.highest} (shops=${okShops}/${shops.length})`
      );
    } else {
      console.log(`[${i + 1}/${dbProducts.length}] ${label}: kein Match`);
    }
  }

  // Write JSON
  const payload = {
    generatedAt: new Date().toISOString(),
    provider: "shopify-catalog",
    sourcesPath: SOURCES_PATH,
    shopConcurrency: 1,
    shopTimeoutSkipAfter: 0,
    totalProducts: dbProducts.length,
    totalShops: shops.length,
    shopHealth: shops.map((s) => ({ shop: s.name, runs: dbProducts.length })),
    results,
  };

  await fs.mkdir("scripts/market", { recursive: true });
  await fs.writeFile(OUTPUT_JSON, JSON.stringify(payload, null, 2), "utf8");

  // Write CSV
  const csvLines = [
    toCsvLine([
      "productId", "manufacturer", "title", "handle", "status",
      "referencePrice", "lowest", "average", "highest",
      "samples", "sampledShops", "totalShops",
    ]),
  ];
  for (const r of results) {
    csvLines.push(toCsvLine([
      r.productId, r.manufacturer ?? "", r.title, r.handle, r.status,
      r.referencePrice ?? "", r.lowest ?? "", r.average ?? "", r.highest ?? "",
      r.samples ?? "", r.sampledShops, r.totalShops,
    ]));
  }
  await fs.writeFile(OUTPUT_CSV, `${csvLines.join("\n")}\n`, "utf8");

  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(`\n[shopify] Done. Matched: ${okCount}/${results.length} products`);
  console.log(`[shopify] JSON: ${OUTPUT_JSON}`);
  console.log(`[shopify] CSV:  ${OUTPUT_CSV}`);
  console.log(`[shopify] Run analyzePriceReport.mjs to see the comparison.`);
};

run()
  .catch((err) => {
    console.error("[shopify] Fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
