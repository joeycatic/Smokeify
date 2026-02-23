import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const parseArgs = () => {
  const args = process.argv.slice(2);
  return { apply: args.includes("--apply") };
};

const getAvailable = (inventory) => {
  const onHand = inventory?.quantityOnHand ?? 0;
  const reserved = inventory?.reserved ?? 0;
  return Math.max(0, onHand - reserved);
};

const getBestVariantMargin = (variants) => {
  // Best available = in-stock variant with highest margin; fall back to any variant
  const inStock = variants.filter((v) => getAvailable(v.inventory) > 0 && v.priceCents > 0);
  const pool = inStock.length > 0 ? inStock : variants.filter((v) => v.priceCents > 0);
  if (pool.length === 0) return 0;
  return pool.reduce((best, v) => {
    const margin = (v.priceCents - v.costCents) / v.priceCents;
    return Math.max(best, margin);
  }, 0);
};

const getCheapestInStockPrice = (variants) => {
  const inStock = variants.filter((v) => getAvailable(v.inventory) > 0 && v.priceCents > 0);
  if (inStock.length === 0) return null;
  return Math.min(...inStock.map((v) => v.priceCents));
};

const isLowStock = (variants) =>
  variants.some((v) => {
    const avail = getAvailable(v.inventory);
    return avail > 0 && avail <= (v.lowStockThreshold ?? 5);
  });

const isOutOfStock = (variants) =>
  !variants.some((v) => getAvailable(v.inventory) > 0);

const priceBonus = (cheapestCents) => {
  if (cheapestCents === null) return 1.0;
  const eur = cheapestCents / 100;
  if (eur < 50) return 1.2;
  if (eur < 150) return 1.1;
  if (eur <= 300) return 1.0;
  return 0.85;
};

const main = async () => {
  const { apply } = parseArgs();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log("Fetching active products and order data...\n");

  // Fetch all active products with variants + inventory
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      bestsellerScore: true,
      conversionRate: true,
      variants: {
        select: {
          priceCents: true,
          costCents: true,
          lowStockThreshold: true,
          inventory: {
            select: { quantityOnHand: true, reserved: true },
          },
        },
      },
    },
  });

  if (products.length === 0) {
    console.log("No active products found.");
    return;
  }

  // Fetch units sold in last 30 days per product
  const orderItems = await prisma.orderItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    where: {
      productId: { in: products.map((p) => p.id) },
      order: { createdAt: { gte: thirtyDaysAgo } },
    },
  });
  const unitsByProductId = new Map(
    orderItems.map((item) => [item.productId, item._sum.quantity ?? 0])
  );

  // Compute raw metrics for each product
  const metrics = products.map((product) => {
    const unitsSold = unitsByProductId.get(product.id) ?? 0;
    const margin = getBestVariantMargin(product.variants);
    const cvr = product.conversionRate ?? 0;
    const cheapestCents = getCheapestInStockPrice(product.variants);
    const oos = isOutOfStock(product.variants);
    const lowStock = isLowStock(product.variants);
    return { product, unitsSold, margin, cvr, cheapestCents, oos, lowStock };
  });

  // Normalize across all active products
  const maxUnits = Math.max(...metrics.map((m) => m.unitsSold), 0);
  const maxMargin = Math.max(...metrics.map((m) => m.margin), 0);
  const maxCvr = Math.max(...metrics.map((m) => m.cvr), 0);

  const updates = [];

  for (const m of metrics) {
    const { product, unitsSold, margin, cvr, cheapestCents, oos, lowStock } = m;

    let score;

    if (oos) {
      score = 0.00001;
    } else if (unitsSold === 0) {
      score = 0.0001;
    } else {
      const unitsScore = maxUnits > 0 ? unitsSold / maxUnits : 0;
      const marginScore = maxMargin > 0 ? margin / maxMargin : 0;
      const cvrScore = maxCvr > 0 ? cvr / maxCvr : 0;

      let raw = unitsScore * 0.5 + marginScore * 0.3 + cvrScore * 0.2;
      raw *= priceBonus(cheapestCents);
      if (lowStock) raw *= 0.9;

      score = raw;
    }

    const prev = product.bestsellerScore;
    updates.push({ product, score, prev, unitsSold, margin, cvr });
  }

  // Sort output by new score descending for readability
  updates.sort((a, b) => b.score - a.score);

  for (const { product, score, prev, unitsSold, margin, cvr } of updates) {
    const prevStr = prev != null ? prev.toFixed(4) : "null";
    const tag = prev == null || Math.abs(score - prev) > 0.0001 ? "CHANGED" : "same";
    console.log(
      `[${tag}] "${product.title}" units=${unitsSold} margin=${margin.toFixed(2)} cvr=${cvr.toFixed(3)} → ${score.toFixed(4)} (was ${prevStr})`
    );

    if (apply) {
      await prisma.product.update({
        where: { id: product.id },
        data: { bestsellerScore: score },
      });
    }
  }

  const changed = updates.filter(
    ({ score, prev }) => prev == null || Math.abs(score - prev) > 0.0001
  ).length;

  console.log(
    `\nProcessed: ${products.length} | Changed: ${changed} | Mode: ${apply ? "apply" : "dry-run"}`
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
