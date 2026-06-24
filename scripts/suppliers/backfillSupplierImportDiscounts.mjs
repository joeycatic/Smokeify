import { PrismaClient } from "@prisma/client";
import { extractBloomtechPricingFromHtml } from "../../src/lib/bloomtech/scrapeSupplierPreview.mjs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 5;

const calculateSupplierSellPriceCents = (costCents, marginPercent = 20) => {
  const safeCost = Math.max(0, Math.round(costCents));
  const target = safeCost / (1 - marginPercent / 100);
  const euros = Math.floor(target / 100);
  const candidates = [euros - 1, euros, euros + 1]
    .filter((entry) => entry >= 0)
    .map((entry) => entry * 100 + 99)
    .filter((entry) => entry > safeCost);
  if (candidates.length === 0) return Math.ceil(target);
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best,
  );
};

const fetchSupplierDiscount = async (sourceUrl) => {
  const response = await fetch(sourceUrl, {
    headers: {
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      "user-agent":
        "Mozilla/5.0 (compatible; SmokeifySupplierDiscountBackfill/1.0)",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return extractBloomtechPricingFromHtml(await response.text());
};

const mapWithConcurrency = async (items, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

const main = async () => {
  const items = await prisma.supplierImportItem.findMany({
    where: {
      status: "APPROVED",
      linkedProduct: {
        status: "DRAFT",
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      sourcePayload: true,
      sku: true,
      costCents: true,
      priceCents: true,
      compareAtCents: true,
      linkedProduct: {
        select: {
          id: true,
          variants: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              sku: true,
              priceCents: true,
              compareAtCents: true,
            },
          },
        },
      },
    },
  });

  const inspected = await mapWithConcurrency(items, async (item) => {
    try {
      const livePricing = await fetchSupplierDiscount(item.sourceUrl);
      const payload =
        item.sourcePayload &&
        typeof item.sourcePayload === "object" &&
        !Array.isArray(item.sourcePayload)
          ? item.sourcePayload
          : {};
      const sourcePrice = Number(payload.price);
      const sourceCompareAt = Number(payload.compareAtPrice);
      const hasStoredSupplierDiscount =
        Number.isFinite(sourcePrice) &&
        Number.isFinite(sourceCompareAt) &&
        sourceCompareAt > sourcePrice;
      const priceCents =
        item.costCents === null
          ? item.priceCents
          : calculateSupplierSellPriceCents(item.costCents);
      const compareAtCents =
        livePricing.discounted && hasStoredSupplierDiscount
          ? calculateSupplierSellPriceCents(Math.round(sourceCompareAt * 100))
          : null;
      const variant =
        item.linkedProduct?.variants.find(
          (entry) => item.sku && entry.sku === item.sku,
        ) ??
        item.linkedProduct?.variants[0] ??
        null;

      return {
        item,
        variant,
        livePricing,
        priceCents,
        compareAtCents:
          priceCents !== null &&
          compareAtCents !== null &&
          compareAtCents > priceCents
            ? compareAtCents
            : null,
      };
    } catch (error) {
      return {
        item,
        error: error instanceof Error ? error.message : "Unknown fetch error",
      };
    }
  });

  const failed = inspected.filter((entry) => entry.error);
  const ready = inspected.filter((entry) => !entry.error);
  const changed = ready.filter(
    (entry) =>
      entry.item.priceCents !== entry.priceCents ||
      entry.item.compareAtCents !== entry.compareAtCents ||
      entry.variant?.priceCents !== entry.priceCents ||
      entry.variant?.compareAtCents !== entry.compareAtCents,
  );

  console.log(
    `[supplier-discount-backfill] mode=${APPLY ? "apply" : "dry-run"} inspected=${items.length} changed=${changed.length} failed=${failed.length}`,
  );
  for (const entry of changed) {
    console.log(
      `[supplier-discount-backfill] ${entry.item.title} liveDiscount=${entry.livePricing.discounted} item=${entry.item.priceCents}/${entry.item.compareAtCents ?? "null"} -> ${entry.priceCents}/${entry.compareAtCents ?? "null"}`,
    );
  }
  for (const entry of failed) {
    console.warn(
      `[supplier-discount-backfill] skipped ${entry.item.title}: ${entry.error}`,
    );
  }

  if (!APPLY || changed.length === 0) return;

  for (const entry of changed) {
    await prisma.$transaction([
      prisma.supplierImportItem.update({
        where: { id: entry.item.id },
        data: {
          priceCents: entry.priceCents,
          compareAtCents: entry.compareAtCents,
        },
      }),
      ...(entry.variant
        ? [
            prisma.variant.update({
              where: { id: entry.variant.id },
              data: {
                priceCents: entry.priceCents,
                compareAtCents: entry.compareAtCents,
              },
            }),
          ]
        : []),
    ]);
  }

  console.log(`[supplier-discount-backfill] updated=${changed.length}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
