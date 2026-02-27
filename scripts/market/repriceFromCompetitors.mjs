/**
 * Reprice products based on competitor data from shopifyPriceScan.mjs.
 * Sets each product's price to competitor_avg * (1 - discount%) — i.e. slightly
 * below the market average — while always respecting your cost margin floor.
 *
 * Products without competitor data are skipped.
 *
 * Usage (dry run — default, shows what would change):
 *   node scripts/market/repriceFromCompetitors.mjs
 *
 * Apply:
 *   COMPETITOR_REPRICE_ALLOW_WRITE=1 node scripts/market/repriceFromCompetitors.mjs --apply
 *
 * Options:
 *   --input <path>         JSON report path (default: scripts/market/shops-price-report.json)
 *   --discount-pct <n>     % below competitor avg to target (default: 3)
 *   --min-margin-pct <n>   Minimum margin over cost, used as floor (default: 15)
 *   --rounding <strategy>  none | 99 | nearest_99 (default: nearest_99)
 *   --min-price-eur <n>    Absolute price floor in EUR (default: 10)
 *   --min-delta-eur <n>    Skip update if change is smaller than this (default: 0.50)
 *   --min-shops <n>        Min sampled shops required to use competitor data (default: 1)
 *   --max-ratio <n>        Skip if competitor avg differs from current price by more than this
 *                          factor (e.g. 2.5 = skip if competitor is >2.5x or <0.4x your price).
 *                          Catches quantity mismatches and false product matches. (default: 2.5)
 */

import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const flagValue = (f, def) => { const i = args.indexOf(f); return i !== -1 && args[i + 1] ? args[i + 1] : def; };
const toNum = (v, def) => { const n = Number(v); return Number.isFinite(n) ? n : def; };

const INPUT        = flagValue("--input", "scripts/market/shops-price-report.json");
const DISCOUNT_PCT = toNum(flagValue("--discount-pct", 3), 3);       // 3% below avg
const MIN_MARGIN   = toNum(flagValue("--min-margin-pct", 15), 15);   // cost floor margin
const ROUNDING     = flagValue("--rounding", "nearest_99");
const MIN_PRICE_C  = Math.round(toNum(flagValue("--min-price-eur", 10), 10) * 100);
const MIN_DELTA_C  = Math.round(toNum(flagValue("--min-delta-eur", 0.5), 0.5) * 100);
const MIN_SHOPS    = toNum(flagValue("--min-shops", 1), 1);
const MAX_RATIO    = toNum(flagValue("--max-ratio", 2.5), 2.5); // safety: skip if competitor avg > X× or < 1/X× your price
const APPLY        = hasFlag("--apply") && process.env.COMPETITOR_REPRICE_ALLOW_WRITE === "1";

const fmt = (cents) => `€${(cents / 100).toFixed(2)}`;

// ── Rounding helpers (same logic as overridePricesAllProducts.mjs) ──────────

const roundToNearest99 = (targetCents, costCents) => {
  const euros = Math.floor(targetCents / 100);
  const candidates = [euros - 1, euros, euros + 1]
    .filter((e) => e >= 0)
    .map((e) => e * 100 + 99)
    .filter((c) => c > costCents);
  if (!candidates.length) return Math.ceil(targetCents);
  return candidates.reduce((best, c) =>
    Math.abs(c - targetCents) < Math.abs(best - targetCents) ? c : best
  );
};

const applyRounding = (targetCents, costCents) => {
  if (ROUNDING === "none") return Math.ceil(targetCents);
  if (ROUNDING === "99")   return Math.ceil(targetCents / 100) * 100 - 1; // always .99
  return roundToNearest99(targetCents, costCents); // nearest_99
};

// ── Core pricing logic ───────────────────────────────────────────────────────

const computeTargetCents = (competitorAvgEur, costCents) => {
  // Target: competitor avg minus discount
  const rawTarget = competitorAvgEur * (1 - DISCOUNT_PCT / 100) * 100;

  // Floor: cost / (1 - margin%) — must maintain minimum margin
  const marginFloor = costCents > 0
    ? Math.ceil(costCents / (1 - MIN_MARGIN / 100))
    : MIN_PRICE_C;

  const floored = Math.max(rawTarget, marginFloor, MIN_PRICE_C);
  return applyRounding(floored, costCents);
};

// ── Main ─────────────────────────────────────────────────────────────────────

const run = async () => {
  // Load competitor report
  let report;
  try {
    report = JSON.parse(await fs.readFile(INPUT, "utf8"));
  } catch {
    console.error(`[reprice] Cannot read ${INPUT}. Run shopifyPriceScan.mjs first.`);
    process.exitCode = 1;
    return;
  }

  if (!APPLY && hasFlag("--apply")) {
    console.log("[reprice] --apply given but COMPETITOR_REPRICE_ALLOW_WRITE is not set to '1'. Running dry-run.");
  }

  console.log(`[reprice] mode=${APPLY ? "APPLY" : "dry-run"}`);
  console.log(`[reprice] discount=${DISCOUNT_PCT}% below competitor avg | margin floor=${MIN_MARGIN}% | rounding=${ROUNDING}`);
  console.log(`[reprice] report: ${report.generatedAt ?? "unknown date"} | ${report.totalProducts ?? "?"} products\n`);

  // Build lookup: handle -> competitor avg price (EUR)
  const competitorMap = new Map();
  for (const r of (report.results ?? [])) {
    if (
      r.status === "ok" &&
      typeof r.average === "number" &&
      (r.sampledShops ?? 0) >= MIN_SHOPS
    ) {
      competitorMap.set(r.handle, { avg: r.average, low: r.lowest, high: r.highest, shops: r.sampledShops });
    }
  }

  console.log(`[reprice] Products with competitor data: ${competitorMap.size}`);

  // Load variants from DB
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      handle: { in: Array.from(competitorMap.keys()) },
    },
    select: {
      id: true,
      title: true,
      handle: true,
      manufacturer: true,
      variants: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, priceCents: true, costCents: true },
      },
    },
  });

  if (!products.length) {
    console.log("[reprice] No matching products found in DB.");
    return;
  }

  let willUpdate = 0;
  let willSkipNoDelta = 0;
  let willSkipMarginFloor = 0;
  let willSkipNoCost = 0;
  const updates = [];

  const COL = 40;
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  const padL = (s, n) => String(s).padStart(n);

  console.log(
    `${pad("Product", COL)}  ${padL("Current", 10)}  ${padL("Target", 10)}  ${padL("Mkt Avg", 10)}  ${padL("Change", 10)}  Note`
  );
  console.log("-".repeat(100));

  for (const product of products) {
    const comp = competitorMap.get(product.handle);
    if (!comp) continue;

    const label = [product.manufacturer, product.title].filter(Boolean).join(" ");

    for (const variant of product.variants) {
      const targetCents = computeTargetCents(comp.avg, variant.costCents);
      const delta = targetCents - variant.priceCents;

      let note = "";
      let skip = false;

      // Safety: skip if competitor avg differs wildly from current price (likely false match)
      const ratio = comp.avg / (variant.priceCents / 100);
      if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) {
        console.log(
          `${pad(label, COL)}  ${padL(fmt(variant.priceCents), 10)}  ${padL("SKIPPED", 10)}  ${padL(`€${comp.avg.toFixed(2)}`, 10)}  ${padL("—", 10)}  skip: ratio ${ratio.toFixed(1)}x exceeds ${MAX_RATIO}x (likely false match)`
        );
        continue;
      }

      if (variant.costCents <= 0) {
        note = "skip: no cost data";
        willSkipNoCost++;
        skip = true;
      } else if (Math.abs(delta) < MIN_DELTA_C) {
        note = "skip: within delta";
        willSkipNoDelta++;
        skip = true;
      } else if (targetCents === Math.ceil(variant.costCents / (1 - MIN_MARGIN / 100))) {
        note = "margin floor applied";
        willSkipMarginFloor++;
      }

      const changeStr = delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${fmt(delta)}`;

      console.log(
        `${pad(label, COL)}  ${padL(fmt(variant.priceCents), 10)}  ${padL(fmt(targetCents), 10)}  ${padL(`€${comp.avg.toFixed(2)}`, 10)}  ${padL(changeStr, 10)}  ${note}`
      );

      if (!skip) {
        willUpdate++;
        updates.push({ id: variant.id, priceCents: targetCents });
      }
    }
  }

  console.log("-".repeat(100));
  console.log(`\n[reprice] Would update: ${willUpdate} variant(s)`);
  console.log(`[reprice] Skipped (within delta): ${willSkipNoDelta}`);
  console.log(`[reprice] Skipped (no cost data): ${willSkipNoCost}`);
  if (willSkipMarginFloor) console.log(`[reprice] Note: ${willSkipMarginFloor} variant(s) hit cost margin floor`);

  if (!updates.length) {
    console.log("[reprice] Nothing to update.");
    return;
  }

  if (!APPLY) {
    console.log("\n[reprice] Dry run — no changes made.");
    console.log("[reprice] To apply: COMPETITOR_REPRICE_ALLOW_WRITE=1 node scripts/market/repriceFromCompetitors.mjs --apply");
    return;
  }

  console.log(`\n[reprice] Applying ${updates.length} update(s)...`);
  for (const u of updates) {
    await prisma.variant.update({ where: { id: u.id }, data: { priceCents: u.priceCents } });
  }
  console.log("[reprice] Done.");
};

run()
  .catch((err) => { console.error("[reprice] Fatal:", err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
