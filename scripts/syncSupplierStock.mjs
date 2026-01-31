import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "url";

const prisma = new PrismaClient();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY_RUNS = 1;
const STATUS_REGEX = /<span[^>]*class=["'][^"']*status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const parseStockFromHtml = (html) => {
  const match = html.match(STATUS_REGEX);
  if (!match) return { statusText: null, quantity: null, inStock: null };
  const statusText = normalizeText(match[1]);
  const lower = statusText.toLowerCase();
  if (lower.includes("bald wieder auf lager")) {
    return { statusText, quantity: 0, inStock: false };
  }
  if (lower.includes("auf lager")) {
    const qtyMatch = statusText.match(/(\d+)/);
    if (!qtyMatch) return { statusText, quantity: null, inStock: true };
    return { statusText, quantity: Number(qtyMatch[1]), inStock: true };
  }
  return { statusText, quantity: 0, inStock: false };
};

const shouldSkipRun = async () => {
  if (MAX_DAILY_RUNS <= 0) return false;
  const last = await prisma.inventoryAdjustment.findFirst({
    where: { reason: "supplier_scrape" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last?.createdAt) return false;
  const age = Date.now() - last.createdAt.getTime();
  return age < ONE_DAY_MS;
};

const fetchHtml = async (url) => {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; SmokeifyStockBot/1.0; +https://smokeify.local)",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
};

const updateProductStock = async (product, quantity, isDryRun) => {
  const variantIds = product.variants.map((variant) => variant.id);
  if (variantIds.length === 0) return { updated: 0 };

  const byVariant = new Map(
    product.variants.map((variant) => [
      variant.id,
      variant.inventory?.quantityOnHand ?? 0,
    ])
  );

  let updatedCount = 0;
  if (isDryRun) {
    for (const variantId of variantIds) {
      const previous = byVariant.get(variantId) ?? 0;
      if (previous === quantity) continue;
      console.log(
        `[dry-run] ${product.title} (${variantId}): ${previous} -> ${quantity}`
      );
      updatedCount += 1;
    }
    return { updated: updatedCount };
  }

  await prisma.$transaction(async (tx) => {
    for (const variantId of variantIds) {
      const previous = byVariant.get(variantId) ?? 0;
      if (previous === quantity) continue;
      await tx.variantInventory.upsert({
        where: { variantId },
        update: { quantityOnHand: quantity },
        create: { variantId, quantityOnHand: quantity, reserved: 0 },
      });
      await tx.inventoryAdjustment.create({
        data: {
          variantId,
          productId: product.id,
          quantityDelta: quantity - previous,
          reason: "supplier_scrape",
        },
      });
      updatedCount += 1;
    }
  });

  return { updated: updatedCount };
};

export const runSupplierSync = async ({ isDryRun = false } = {}) => {
  if (await shouldSkipRun()) {
    console.log("Skipping supplier sync: already ran within 24h.");
    return;
  }

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      sellerUrl: { not: null },
    },
    select: {
      id: true,
      title: true,
      sellerUrl: true,
      variants: {
        select: {
          id: true,
          inventory: { select: { quantityOnHand: true } },
        },
      },
    },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    const url = product.sellerUrl;
    if (!url) {
      skipped += 1;
      continue;
    }
    try {
      const html = await fetchHtml(url);
      const parsed = parseStockFromHtml(html);
      if (parsed.statusText === null) {
        console.warn(`[sync] Missing status span for ${product.title}`);
        failed += 1;
        continue;
      }
      if (parsed.inStock && parsed.quantity === null) {
        console.warn(`[sync] Missing quantity for ${product.title}: ${parsed.statusText}`);
        failed += 1;
        continue;
      }
      const quantity = parsed.quantity ?? 0;
      const result = await updateProductStock(product, quantity, isDryRun);
      updated += result.updated;
    } catch (error) {
      console.warn(
        `[sync] Failed ${product.title}: ${error instanceof Error ? error.message : "unknown"}`
      );
      failed += 1;
    }
    await sleep(1000);
  }

  console.log(`Supplier sync done. updated=${updated} skipped=${skipped} failed=${failed}`);
};

const isExecutedDirectly =
  pathToFileURL(process.argv[1] ?? "").href === import.meta.url;

if (isExecutedDirectly) {
  const isDryRun = process.argv.includes("--dry-run");
  runSupplierSync({ isDryRun })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
