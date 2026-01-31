import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "url";

const prisma = new PrismaClient();
const RUN_INTERVAL_MS = 12 * 60 * 60 * 1000;
const MAX_DAILY_RUNS = 2;
const STATUS_REGEX = /<span[^>]*class=["'][^"']*status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const TELEGRAM_MESSAGE_LIMIT = 3500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const sendTelegramMessage = async (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Telegram failed: ${res.status}`);
  }
};

const formatChangeLine = (change) =>
  `${change.title}: ${change.previous} → ${change.next} (${change.supplier})`;

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

const parseB2BHeadshopStock = (html, url) => {
  const match = html.match(STATUS_REGEX);
  const statusText = match ? normalizeText(match[1]) : "";
  const lower = statusText.toLowerCase();
  if (/sofort\s+verf(u|ü)gbar/.test(lower)) {
    console.log(`[b2b] ${url} -> "${statusText}" => 20`);
    return { statusText, quantity: 20, inStock: true };
  }

  const hasSchemaInStock =
    html
      .toLowerCase()
      .includes('itemprop="availability"') &&
    html.toLowerCase().includes("schema.org/instock");
  if (hasSchemaInStock) {
    console.log(`[b2b] ${url} -> schema.org/InStock => 20`);
    return { statusText: statusText || "InStock", quantity: 20, inStock: true };
  }

  if (!match) {
    console.log(`[b2b] No status match for ${url}`);
    return { statusText: null, quantity: null, inStock: null };
  }

  console.log(`[b2b] ${url} -> "${statusText}" => 0`);
  return { statusText, quantity: 0, inStock: false };
};

const parseStockForUrl = (url, html) => {
  const normalized = url.toLowerCase();
  if (normalized.includes("b2b-headshop.de")) {
    return parseB2BHeadshopStock(html, url);
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("b2b-headshop.de")) {
      return parseB2BHeadshopStock(html, url);
    }
  } catch {
    // ignore bad URL and fall back
  }
  return parseStockFromHtml(html);
};

const shouldSkipRun = async (isDryRun) => {
  if (isDryRun) return false;
  if (MAX_DAILY_RUNS <= 0) return false;
  const last = await prisma.inventoryAdjustment.findFirst({
    where: { reason: "supplier_scrape" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last?.createdAt) return false;
  const lastTime = last.createdAt.getTime();
  const age = Date.now() - lastTime;
  if (age < RUN_INTERVAL_MS) {
    console.log(
      `Last run: ${last.createdAt.toISOString()} (skipping, <12h)`
    );
    return true;
  }
  return false;
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
  if (variantIds.length === 0) return { updated: 0, changes: [] };

  const byVariant = new Map(
    product.variants.map((variant) => [
      variant.id,
      variant.inventory?.quantityOnHand ?? 0,
    ])
  );

  let updatedCount = 0;
  const changes = [];
  if (isDryRun) {
    for (const variantId of variantIds) {
      const previous = byVariant.get(variantId) ?? 0;
      if (previous === quantity) continue;
      changes.push({
        productId: product.id,
        variantId,
        title: product.title,
        previous,
        next: quantity,
      });
      console.log(
        `[dry-run] ${product.title} (${variantId}): ${previous} -> ${quantity}`
      );
      updatedCount += 1;
    }
    return { updated: updatedCount, changes };
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
      changes.push({
        productId: product.id,
        variantId,
        title: product.title,
        previous,
        next: quantity,
      });
      updatedCount += 1;
    }
  });

  return { updated: updatedCount, changes };
};

export const runSupplierSync = async ({ isDryRun = false } = {}) => {
  if (await shouldSkipRun(isDryRun)) {
    console.log("Skipping supplier sync: already ran within 12h.");
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
  const changes = [];
  const unavailable = [];

  for (const product of products) {
    const url = product.sellerUrl;
    if (!url) {
      skipped += 1;
      continue;
    }
    let supplier = "supplier";
    try {
      try {
        supplier = new URL(url).hostname.toLowerCase();
      } catch {
        supplier = "supplier";
      }
      const html = await fetchHtml(url);
      const parsed = parseStockForUrl(url, html);
      if (parsed.statusText === null) {
        console.warn(`[sync] Missing status span for ${product.title}`);
        unavailable.push({
          title: product.title,
          url,
          reason: "Status nicht gefunden",
        });
        failed += 1;
        continue;
      }
      if (parsed.inStock && parsed.quantity === null) {
        console.warn(`[sync] Missing quantity for ${product.title}: ${parsed.statusText}`);
        unavailable.push({
          title: product.title,
          url,
          reason: "Menge nicht gefunden",
        });
        failed += 1;
        continue;
      }
      const quantity = parsed.quantity ?? 0;
      const result = await updateProductStock(product, quantity, isDryRun);
      updated += result.updated;
      changes.push(
        ...result.changes.map((change) => ({
          ...change,
          supplier,
        }))
      );
    } catch (error) {
      console.warn(
        `[sync] Failed ${product.title}: ${error instanceof Error ? error.message : "unknown"}`
      );
      unavailable.push({
        title: product.title,
        url,
        reason: error instanceof Error ? error.message : "unknown",
        supplier,
      });
      failed += 1;
    }
    await sleep(1000);
  }

  console.log(`Supplier sync done. updated=${updated} skipped=${skipped} failed=${failed}`);

  if (!isDryRun) {
    const changeLines = changes.map(formatChangeLine);
    const changeText =
      changeLines.length > 0
        ? changeLines.slice(0, 20).join("\n") +
          (changeLines.length > 20
            ? `\n… +${changeLines.length - 20} weitere`
            : "")
        : "Keine Änderungen.";
    const unavailableText =
      unavailable.length > 0
        ? unavailable
            .slice(0, 15)
            .map((item) => `${item.title} — ${item.reason}\n${item.url}`)
            .join("\n")
        : "Keine.";
    let message =
      `<b>Supplier Sync</b>\n` +
      `Updates: ${updated}\n` +
      `Skipped: ${skipped}\n` +
      `Failed: ${failed}\n\n` +
      `<b>Änderungen</b>\n${changeText}\n\n` +
      `<b>Nicht verfügbar / fehlerhaft</b>\n${unavailableText}`;
    if (message.length > TELEGRAM_MESSAGE_LIMIT) {
      message = message.slice(0, TELEGRAM_MESSAGE_LIMIT - 3) + "...";
    }
    try {
      await sendTelegramMessage(message);
    } catch (error) {
      console.warn(
        `[sync] Telegram failed: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }
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
