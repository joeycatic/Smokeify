const DEFAULT_MAX_RUNTIME_MS = 240000;
const DEFAULT_MAX_PRODUCTS = 0;
const DEFAULT_REQUEST_DELAY_MS = 1000;
const DEFAULT_PAGE_SIZE = 50;
const STATUS_REGEX = /<span[^>]*class=["'][^"']*status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const PLANTPLANET_STATUS_REGEX =
  /<div[^>]*class=["'][^"']*status[^"']*["'][^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i;
const TELEGRAM_MESSAGE_LIMIT = 3500;
const DROPSHIP_DEMAND_PAYMENT_STATUSES = ["paid", "succeeded", "partially_refunded"];
const DROPSHIP_DEMAND_FINAL_ORDER_STATUSES = [
  "shipped",
  "fulfilled",
  "canceled",
  "cancelled",
  "refunded",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const parseNumberSetting = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createLogger = (logger) => {
  if (logger && typeof logger.info === "function" && typeof logger.warn === "function") {
    return logger;
  }

  return {
    info(message) {
      console.log(message);
    },
    warn(message) {
      console.warn(message);
    },
  };
};

const sendTelegramMessage = async ({ env, text }) => {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
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

export const formatSupplierSyncChangeLine = (change) => {
  const diff = change.next - change.previous;
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
  const supplierStock =
    typeof change.supplierReportedStock === "number"
      ? ` supplier=${change.supplierReportedStock}`
      : "";
  const pendingDemand =
    typeof change.pendingDropshipDemand === "number" && change.pendingDropshipDemand > 0
      ? ` pending=${change.pendingDropshipDemand}`
      : "";
  return `${change.supplier} ${change.title} ${change.previous} -> ${change.next} (${diffLabel})${supplierStock}${pendingDemand}`;
};

export const calculateDropshipSellableStock = ({
  supplierReportedStock,
  pendingDropshipDemand = 0,
}) => {
  const parsedSupplierStock = Number(supplierReportedStock);
  const parsedPendingDemand = Number(pendingDropshipDemand);
  const supplierStock = Number.isFinite(parsedSupplierStock)
    ? Math.max(0, Math.floor(parsedSupplierStock))
    : 0;
  const pendingDemand = Number.isFinite(parsedPendingDemand)
    ? Math.max(0, Math.floor(parsedPendingDemand))
    : 0;
  return Math.max(0, supplierStock - pendingDemand);
};

const getPendingDropshipDemandByVariant = async (prisma, variantIds) => {
  const uniqueVariantIds = Array.from(new Set(variantIds.filter(Boolean)));
  if (uniqueVariantIds.length === 0) return new Map();

  const rows = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: uniqueVariantIds },
      order: {
        paymentStatus: { in: DROPSHIP_DEMAND_PAYMENT_STATUSES },
        status: { notIn: DROPSHIP_DEMAND_FINAL_ORDER_STATUSES },
      },
    },
    _sum: { quantity: true },
  });

  return new Map(
    rows
      .filter((row) => typeof row.variantId === "string")
      .map((row) => [row.variantId, Math.max(0, row._sum.quantity ?? 0)]),
  );
};

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

const parseB2BHeadshopStock = (html) => {
  const match = html.match(STATUS_REGEX);
  const statusText = match ? normalizeText(match[1]) : "";
  const lower = statusText.toLowerCase();
  if (/sofort\s+verf(u|ü)gbar/.test(lower)) {
    return { statusText, quantity: 20, inStock: true };
  }

  const hasSchemaInStock =
    html.toLowerCase().includes('itemprop="availability"') &&
    html.toLowerCase().includes("schema.org/instock");
  if (hasSchemaInStock) {
    return { statusText: statusText || "InStock", quantity: 20, inStock: true };
  }

  if (!match) {
    return { statusText: null, quantity: null, inStock: null };
  }

  return { statusText, quantity: 0, inStock: false };
};

const parsePlantPlanetStock = (html) => {
  const match = html.match(PLANTPLANET_STATUS_REGEX);
  const statusText = match ? normalizeText(match[1]) : "";
  const lower = statusText.toLowerCase();
  if (!statusText) {
    return { statusText: null, quantity: null, inStock: null };
  }
  if (lower.includes("nicht auf lager")) {
    return { statusText, quantity: 0, inStock: false };
  }
  const qtyMatch = statusText.match(/(\d+)/);
  if (qtyMatch) {
    return { statusText, quantity: Number(qtyMatch[1]), inStock: true };
  }
  if (lower.includes("auf lager")) {
    return { statusText, quantity: null, inStock: true };
  }
  return { statusText, quantity: 0, inStock: false };
};

const parseStockForUrl = (url, html) => {
  const normalized = url.toLowerCase();
  if (normalized.includes("plantplanet.de")) {
    return parsePlantPlanetStock(html);
  }
  if (normalized.includes("b2b-headshop.de")) {
    return parseB2BHeadshopStock(html);
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("plantplanet.de")) {
      return parsePlantPlanetStock(html);
    }
    if (host.includes("b2b-headshop.de")) {
      return parseB2BHeadshopStock(html);
    }
  } catch {
    // Ignore invalid URLs and fall back to generic parsing.
  }
  return parseStockFromHtml(html);
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

const updateProductStock = async ({ prisma, product, quantity, isDryRun }) => {
  const variantIds = product.variants.map((variant) => variant.id);
  if (variantIds.length === 0) return { updated: 0, changes: [] };

  const byVariant = new Map(
    product.variants.map((variant) => [
      variant.id,
      {
        quantityOnHand: variant.inventory?.quantityOnHand ?? 0,
        supplierReportedStock: variant.inventory?.supplierReportedStock ?? null,
      },
    ]),
  );
  const pendingDropshipDemandByVariant = await getPendingDropshipDemandByVariant(
    prisma,
    variantIds,
  );

  let updatedCount = 0;
  const changes = [];
  const syncedAt = new Date();
  if (isDryRun) {
    for (const variantId of variantIds) {
      const previousSnapshot = byVariant.get(variantId) ?? {
        quantityOnHand: 0,
        supplierReportedStock: null,
      };
      const previous = previousSnapshot.quantityOnHand;
      const pendingDropshipDemand = pendingDropshipDemandByVariant.get(variantId) ?? 0;
      const next = calculateDropshipSellableStock({
        supplierReportedStock: quantity,
        pendingDropshipDemand,
      });
      if (
        previous === next &&
        previousSnapshot.supplierReportedStock === quantity
      ) {
        continue;
      }
      changes.push({
        productId: product.id,
        variantId,
        title: product.title,
        previous,
        next,
        supplierReportedStock: quantity,
        previousSupplierReportedStock: previousSnapshot.supplierReportedStock,
        pendingDropshipDemand,
      });
      updatedCount += 1;
    }
    return { updated: updatedCount, changes };
  }

  await prisma.$transaction(async (tx) => {
    for (const variantId of variantIds) {
      const previousSnapshot = byVariant.get(variantId) ?? {
        quantityOnHand: 0,
        supplierReportedStock: null,
      };
      const previous = previousSnapshot.quantityOnHand;
      const pendingDropshipDemand = pendingDropshipDemandByVariant.get(variantId) ?? 0;
      const next = calculateDropshipSellableStock({
        supplierReportedStock: quantity,
        pendingDropshipDemand,
      });
      if (
        previous === next &&
        previousSnapshot.supplierReportedStock === quantity
      ) {
        continue;
      }
      await tx.variantInventory.upsert({
        where: { variantId },
        update: {
          quantityOnHand: next,
          supplierReportedStock: quantity,
          supplierStockSyncedAt: syncedAt,
          supplierStockSource: product.sellerUrl,
        },
        create: {
          variantId,
          quantityOnHand: next,
          reserved: 0,
          supplierReportedStock: quantity,
          supplierStockSyncedAt: syncedAt,
          supplierStockSource: product.sellerUrl,
        },
      });
      if (next !== previous) {
        await tx.inventoryAdjustment.create({
          data: {
            variantId,
            productId: product.id,
            quantityDelta: next - previous,
            reason: "supplier_scrape",
            sourceType: "SUPPLIER_STOCK_SYNC",
            sourceReference: product.sellerUrl,
            note:
              `Supplier reported ${quantity}; pending dropship demand ${pendingDropshipDemand}; ` +
              `sellable stock reconciled from ${previous} to ${next}.`,
          },
        });
      }
      changes.push({
        productId: product.id,
        variantId,
        title: product.title,
        previous,
        next,
        supplierReportedStock: quantity,
        previousSupplierReportedStock: previousSnapshot.supplierReportedStock,
        pendingDropshipDemand,
      });
      updatedCount += 1;
    }
  });

  return { updated: updatedCount, changes };
};

/**
 * @param {{
 *   prisma: {
 *     product: { findMany: Function };
 *     $transaction: Function;
 *   };
 *   isDryRun?: boolean;
 *   sendTelegramReport?: boolean;
 *   logger?: { info: (message: string) => void; warn: (message: string) => void };
 *   env?: NodeJS.ProcessEnv;
 * }} options
 */
export async function runSupplierSync({
  prisma,
  isDryRun = false,
  sendTelegramReport = false,
  logger,
  env = process.env,
} = {}) {
  if (!prisma) {
    throw new Error("runSupplierSync requires a prisma client.");
  }

  const log = createLogger(logger);
  const maxRuntimeMs = parseNumberSetting(env.SUPPLIER_SYNC_MAX_MS, DEFAULT_MAX_RUNTIME_MS);
  const maxProducts = parseNumberSetting(env.SUPPLIER_SYNC_MAX_PRODUCTS, DEFAULT_MAX_PRODUCTS);
  const requestDelayMs = parseNumberSetting(env.SUPPLIER_SYNC_DELAY_MS, DEFAULT_REQUEST_DELAY_MS);
  const pageSize = parseNumberSetting(env.SUPPLIER_SYNC_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const startAfterId = env.SUPPLIER_SYNC_START_AFTER_ID ?? null;

  const startedAt = Date.now();
  const deadline =
    Number.isFinite(maxRuntimeMs) && maxRuntimeMs > 0 ? startedAt + maxRuntimeMs : null;

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const changes = [];
  const unavailable = [];
  let processed = 0;
  let cursorId = startAfterId;
  let timedOut = false;

  const remainingLimit =
    Number.isFinite(maxProducts) && maxProducts > 0 ? maxProducts : null;

  while (true) {
    if (deadline !== null && Date.now() >= deadline) {
      timedOut = true;
      break;
    }
    const remaining = remainingLimit ? remainingLimit - processed : null;
    if (remaining !== null && remaining <= 0) break;
    const take = remaining !== null ? Math.min(pageSize, remaining) : pageSize;

    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        sellerUrl: { not: null },
      },
      orderBy: { id: "asc" },
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        sellerUrl: true,
        variants: {
          select: {
            id: true,
            inventory: {
              select: {
                quantityOnHand: true,
                supplierReportedStock: true,
              },
            },
          },
        },
      },
    });

    if (!products.length) break;

    for (const product of products) {
      if (deadline !== null && Date.now() >= deadline) {
        timedOut = true;
        break;
      }
      const url = product.sellerUrl;
      if (!url) {
        skipped += 1;
        processed += 1;
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
          log.warn(`[sync] Missing status span for ${product.title}`);
          unavailable.push({
            title: product.title,
            url,
            reason: "Status nicht gefunden",
          });
          failed += 1;
          processed += 1;
          continue;
        }
        if (parsed.inStock && parsed.quantity === null) {
          log.warn(`[sync] Missing quantity for ${product.title}: ${parsed.statusText}`);
          unavailable.push({
            title: product.title,
            url,
            reason: "Menge nicht gefunden",
          });
          failed += 1;
          processed += 1;
          continue;
        }
        const quantity = parsed.quantity ?? 0;
        const result = await updateProductStock({
          prisma,
          product,
          quantity,
          isDryRun,
        });
        updated += result.updated;
        const withSupplier = result.changes.map((change) => ({
          ...change,
          supplier,
        }));
        changes.push(...withSupplier);
        withSupplier.forEach((change) => {
          log.info(formatSupplierSyncChangeLine(change));
        });
      } catch (error) {
        log.warn(
          `[sync] Failed ${product.title}: ${error instanceof Error ? error.message : "unknown"}`,
        );
        unavailable.push({
          title: product.title,
          url,
          reason: error instanceof Error ? error.message : "unknown",
          supplier,
        });
        failed += 1;
      }
      processed += 1;
      if (requestDelayMs > 0) {
        await sleep(requestDelayMs);
      }
    }

    cursorId = products[products.length - 1]?.id ?? cursorId;
    if (timedOut) break;
  }

  const durationMs = Date.now() - startedAt;
  const elapsedSeconds = Math.round(durationMs / 1000);
  if (timedOut) {
    log.warn(
      `[sync] Time budget hit after ${elapsedSeconds}s, stopping early. lastId=${cursorId ?? "none"} processed=${processed}`,
    );
  }
  log.info(
    `Supplier sync done. updated=${updated} skipped=${skipped} failed=${failed} duration=${elapsedSeconds}s`,
  );

  if (!isDryRun && sendTelegramReport) {
    const changeLines = changes.map(formatSupplierSyncChangeLine);
    const changeText =
      changeLines.length > 0
        ? changeLines.slice(0, 20).join("\n") +
          (changeLines.length > 20 ? `\n… +${changeLines.length - 20} weitere` : "")
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
      `Dauer: ${elapsedSeconds}s\n` +
      `Updates: ${updated}\n` +
      `Skipped: ${skipped}\n` +
      `Failed: ${failed}\n\n` +
      `<b>Änderungen</b>\n${changeText}\n\n` +
      `<b>Nicht verfügbar / fehlerhaft</b>\n${unavailableText}`;
    if (message.length > TELEGRAM_MESSAGE_LIMIT) {
      message = `${message.slice(0, TELEGRAM_MESSAGE_LIMIT - 3)}...`;
    }
    try {
      await sendTelegramMessage({ env, text: message });
    } catch (error) {
      log.warn(
        `[sync] Telegram failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return {
    updated,
    skipped,
    failed,
    processed,
    timedOut,
    cursorId,
    durationMs,
    changes,
    unavailable,
  };
}
