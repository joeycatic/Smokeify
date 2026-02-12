import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);

const hasFlag = (flag) => args.includes(flag);

const readFlagValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const LIMIT = toInt(readFlagValue("--limit"), 100);
const INCLUDE_ALL_STATUSES = hasFlag("--all-statuses");
const rawTimeoutMs = toPositiveNumber(readFlagValue("--timeout-ms"), 15000);
const TIMEOUT_MS = Math.max(1000, rawTimeoutMs || 15000);
const RETRIES = Math.max(0, toInt(readFlagValue("--retries"), 0));
const RETRY_TIMEOUTS = hasFlag("--retry-timeouts");
const DELAY_MS = toPositiveNumber(readFlagValue("--delay-ms"), 800);
const SHOP_DELAY_MS = toPositiveNumber(readFlagValue("--shop-delay-ms"), 250);
const SHOP_CONCURRENCY = Math.max(1, toInt(readFlagValue("--shop-concurrency"), 4));
const SHOP_TIMEOUT_SKIP_AFTER = Math.max(
  1,
  toInt(readFlagValue("--shop-timeout-skip-after"), 3)
);
const MAX_HTML_BYTES = toInt(readFlagValue("--max-html-bytes"), 800000);
const MAX_SHOPS = toInt(readFlagValue("--max-shops"), 100);
const ONLY_SHOP = (readFlagValue("--only-shop") ?? "").trim().toLowerCase();
const SOURCES_PATH =
  readFlagValue("--sources") ?? "scripts/market/shop-sources.json";
const DEBUG_HTML_DIR = readFlagValue("--debug-html-dir");
const SHOW_LINKS = hasFlag("--show-links");
const SHOW_REACHABLE_LINKS = hasFlag("--show-reachable-links");
const MAX_MATCHED_LINKS_PER_SHOP = Math.max(
  1,
  toInt(readFlagValue("--max-matched-links-per-shop"), 3)
);
const VERIFY_PRODUCT_PAGES = !hasFlag("--no-verify-product-pages");
const OUTPUT_JSON =
  readFlagValue("--output-json") ?? "scripts/market/shops-price-report.json";
const OUTPUT_CSV =
  readFlagValue("--output-csv") ?? "scripts/market/shops-price-report.csv";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class HttpStatusError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

const normalizeLocalizedAmount = (raw) => {
  if (!raw) return null;
  const value = raw.replace(/[^\d,.\s]/g, "").replace(/\s+/g, "");
  if (!value) return null;

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  let normalized = value;

  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = value.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = value.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = value.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = value.replace(/,/g, "");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  if (amount <= 0 || amount > 1_000_000) return null;
  return amount;
};

const filterByReferencePrice = (prices, referencePrice) => {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    return prices;
  }
  const min = referencePrice * 0.35;
  const max = referencePrice * 2.8;
  const filtered = prices.filter((price) => price >= min && price <= max);
  return filtered.length > 0 ? filtered : prices;
};

const extractPricesFromHtml = (html, referencePrice) => {
  const normalizedHtml = html
    .replace(/\\u20ac/gi, "€")
    .replace(/\\u00a0/gi, " ")
    .replace(/\\xa0/gi, " ");

  const collected = [];
  const add = (rawValue) => {
    const parsed = normalizeLocalizedAmount(rawValue);
    if (parsed !== null) collected.push(parsed);
  };

  const patterns = [
    /"price"\s*:\s*"([^"]+)"/gi,
    /"price"\s*:\s*([0-9][0-9.,]*)/gi,
    /"offerPrice"\s*:\s*"([^"]+)"/gi,
    /itemprop=["']price["'][^>]*content=["']([^"']+)["']/gi,
    /data-price=["']([^"']+)["']/gi,
    /(?:€|EUR)\s*([0-9][0-9.,\s]*)/gi,
    /([0-9][0-9.,\s]*)\s*(?:€|EUR)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalizedHtml))) {
      add(match[1]);
    }
  }

  const unique = Array.from(
    new Set(collected.map((value) => Number(value.toFixed(2))))
  );
  return filterByReferencePrice(unique, referencePrice);
};

const detectBlockedPage = (html) => {
  const lowered = html.toLowerCase();
  const signals = [
    "access denied",
    "forbidden",
    "captcha",
    "too many requests",
    "rate limit",
    "request blocked",
    "just a moment",
    "attention required",
  ];
  for (const signal of signals) {
    if (lowered.includes(signal)) return signal;
  }
  return null;
};

const decodeHtmlEntities = (value) =>
  String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
    });

const normalizeForMatch = (value) =>
  decodeHtmlEntities(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const createTitleMatcher = (product) => {
  const title = normalizeForMatch(product?.title ?? "");
  const manufacturer = normalizeForMatch(product?.manufacturer ?? "");
  const tokens = [manufacturer, title]
    .filter(Boolean)
    .join(" ")
    .split(" ")
    .filter((token) => token.length >= 2)
    .filter(
      (token) =>
        ![
          "the",
          "and",
          "mit",
          "und",
          "der",
          "die",
          "das",
          "with",
          "fur",
          "für",
        ].includes(token)
    );
  const uniqueTokens = Array.from(new Set(tokens));
  return {
    uniqueTokens,
    numericTokens: uniqueTokens.filter((token) => /\d/.test(token)),
    wordTokens: uniqueTokens.filter((token) => !/\d/.test(token)),
  };
};

const tokenMatchScore = (text, matcher) => {
  const normalized = normalizeForMatch(text);
  if (!normalized || !matcher) return { ok: false, score: 0 };

  const numericMatches = matcher.numericTokens.filter((token) =>
    normalized.includes(token)
  ).length;
  if (
    matcher.numericTokens.length > 0 &&
    numericMatches < matcher.numericTokens.length
  ) {
    return { ok: false, score: 0 };
  }

  const wordMatches = matcher.wordTokens.filter((token) =>
    normalized.includes(token)
  ).length;
  const requiredWords = Math.min(2, matcher.wordTokens.length || 0);
  if (wordMatches < requiredWords) return { ok: false, score: 0 };

  return { ok: true, score: numericMatches * 5 + wordMatches };
};

const isRelevantToTitle = (html, matcher) => tokenMatchScore(html, matcher).ok;

const extractMatchedLinks = (html, searchUrl, matcher, maxCount) => {
  const matches = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html))) {
    const rawHref = (match[1] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) {
      continue;
    }
    let url;
    try {
      url = new URL(rawHref, searchUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);

    if (/(\/search|\/suche|\?|cart|warenkorb|checkout|login|konto)/i.test(url)) {
      continue;
    }

    const anchorText = decodeHtmlEntities(String(match[2] ?? "")).replace(
      /<[^>]+>/g,
      " "
    );
    const score = tokenMatchScore(`${url} ${anchorText}`, matcher);
    if (!score.ok) continue;
    matches.push({ url, score: score.score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxCount).map((entry) => entry.url);
};

const computeStats = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    lowest: Number(sorted[0].toFixed(2)),
    average: Number((sum / sorted.length).toFixed(2)),
    highest: Number(sorted[sorted.length - 1].toFixed(2)),
    samples: sorted.length,
  };
};

const fetchWithTimeout = async (url, timeoutMs, referer = null) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "accept-language": "de-DE,de;q=0.9,en;q=0.8",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        ...(referer ? { referer } : {}),
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchWithRetry = async (url, timeoutMs, retries, referer = null) => {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs, referer);
      if (!response.ok) {
        throw new HttpStatusError(response.status);
      }
      return response;
    } catch (error) {
      lastError = error;
      const isAbort = error?.name === "AbortError";
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) break;
      if (isAbort && !RETRY_TIMEOUTS) break;
      await sleep(800 * (attempt + 1));
    }
  }

  throw lastError;
};

const readResponseTextLimited = async (response, maxBytes) => {
  const body = response.body;
  if (!body || typeof body.getReader !== "function") {
    return response.text();
  }

  const reader = body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = maxBytes - received;
    if (remaining <= 0) break;
    const slice = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(slice);
    received += slice.byteLength;
    if (received >= maxBytes) break;
  }
  try {
    await reader.cancel();
  } catch {
    // ignore
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
};

const createSearchQuery = (product) => {
  const manufacturer = product.manufacturer?.trim() ?? "";
  const title = product.title?.trim() ?? "";
  const parts = [manufacturer, title].filter(Boolean);

  const deduped = [];
  const seen = new Set();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(part);
  }
  return deduped.join(" ").trim();
};

const formatProductLabel = (product) => {
  const manufacturer = product.manufacturer?.trim() ?? "";
  const title = product.title?.trim() ?? "";
  return [manufacturer, title].filter(Boolean).join(" ").trim() || product.title;
};

const safeFileSlug = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";

const toCsvLine = (values) =>
  values
    .map((value) => {
      const text = String(value ?? "");
      const escaped = text.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(",");

const formatLinksForCli = (shopSummaries, includeReachable = false) => {
  const allowedStatuses = includeReachable
    ? new Set(["ok", "no_prices_found", "blocked"])
    : new Set(["ok"]);
  const unique = [];
  const seen = new Set();
  for (const entry of shopSummaries) {
    if (!allowedStatuses.has(String(entry.status))) continue;
    const candidates = Array.isArray(entry?.matchedLinks)
      ? entry.matchedLinks
      : [];
    for (const candidate of candidates) {
      const url = String(candidate ?? "").trim();
      if (!url) continue;
      const key = `${entry.status}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (entry.status === "ok") {
        unique.push(
          `${url}  low=${entry.lowest} avg=${entry.average} high=${entry.highest} (n=${entry.samples})`
        );
      } else if (includeReachable) {
        const info = entry.info ? ` (${entry.info})` : "";
        unique.push(`${url}  status=${entry.status}${info}`);
      }
    }
  }
  return unique;
};

const renderTemplate = (template, query) =>
  template.replaceAll("{query}", encodeURIComponent(query));

const loadShops = async () => {
  const raw = await fs.readFile(SOURCES_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.shops) ? parsed.shops : [];

  const filtered = list
    .filter((shop) => shop && shop.enabled !== false)
    .filter((shop) =>
      ONLY_SHOP
        ? String(shop.name ?? "")
            .toLowerCase()
            .includes(ONLY_SHOP)
        : true
    )
    .slice(0, MAX_SHOPS > 0 ? MAX_SHOPS : undefined);

  return filtered;
};

const createShopHealth = () => ({
  runs: 0,
  avgDurationMs: 0,
  timeoutsInRow: 0,
  skipped: 0,
});

const isTimeoutLike = (summary) => {
  if (summary.status !== "error") return false;
  const info = String(summary.info ?? "").toLowerCase();
  return info.includes("timeout") || info.includes("http 429") || info.includes("http 503");
};

const shouldSkipShop = (health) =>
  health.timeoutsInRow >= SHOP_TIMEOUT_SKIP_AFTER;

const updateShopHealth = (map, shopName, summary) => {
  const current = map.get(shopName) ?? createShopHealth();
  const duration = Number(summary.durationMs ?? 0);
  current.runs += 1;
  current.avgDurationMs =
    current.runs <= 1
      ? duration
      : Number(
          (
            (current.avgDurationMs * (current.runs - 1) + duration) /
            current.runs
          ).toFixed(2)
        );

  if (summary.status === "skipped") {
    current.skipped += 1;
  } else if (isTimeoutLike(summary)) {
    current.timeoutsInRow += 1;
  } else {
    current.timeoutsInRow = 0;
  }

  map.set(shopName, current);
};

const processShopForProduct = async ({
  productIndex,
  product,
  query,
  referencePrice,
  shop,
  shopHealthMap,
}) => {
  const shopName = String(shop.name ?? "unknown-shop");
  const health = shopHealthMap.get(shopName) ?? createShopHealth();
  if (shouldSkipShop(health)) {
    const summary = {
      shop: shopName,
      status: "skipped",
      info: `Auto-skip nach ${health.timeoutsInRow} Timeout/Throttle Fehlern in Folge`,
      durationMs: 0,
    };
    updateShopHealth(shopHealthMap, shopName, summary);
    return { summary, prices: [] };
  }

  const templates = Array.isArray(shop.searchUrlTemplates)
    ? shop.searchUrlTemplates
    : [];
  if (!templates.length) {
    const summary = {
      shop: shopName,
      status: "error",
      info: "Keine Search-Template Variante konfiguriert",
      durationMs: 0,
    };
    updateShopHealth(shopHealthMap, shopName, summary);
    return { summary, prices: [] };
  }

  const startedAt = Date.now();
  const titleMatcher = createTitleMatcher(product);

  const fetchPricesFromMatchedLinks = async (matchedLinks, fallbackReferer) => {
    const collected = [];
    for (let i = 0; i < matchedLinks.length; i += 1) {
      const link = matchedLinks[i];
      try {
        const response = await fetchWithRetry(
          link,
          TIMEOUT_MS,
          0,
          fallbackReferer
        );
        const pageHtml = await readResponseTextLimited(response, MAX_HTML_BYTES);
        if (!isRelevantToTitle(pageHtml, titleMatcher)) {
          continue;
        }
        const prices = extractPricesFromHtml(pageHtml, referencePrice);
        if (prices.length) {
          collected.push(...prices);
        }
      } catch {
        // ignore individual product-page fetch failures
      }
    }
    return Array.from(new Set(collected.map((value) => Number(value.toFixed(2)))));
  };

  for (let templateIndex = 0; templateIndex < templates.length; templateIndex += 1) {
    const template = templates[templateIndex];
    const searchUrl = renderTemplate(template, query);
    try {
      const response = await fetchWithRetry(
        searchUrl,
        TIMEOUT_MS,
        RETRIES,
        `https://${shop.domain ?? "www.preisvergleich.de"}`
      );
      const html = await readResponseTextLimited(response, MAX_HTML_BYTES);
      const blockedSignal = detectBlockedPage(html);
      if (blockedSignal) {
        const summary = {
          shop: shopName,
          status: "blocked",
          url: searchUrl,
          info: blockedSignal,
          durationMs: Date.now() - startedAt,
        };
        updateShopHealth(shopHealthMap, shopName, summary);
        return { summary, prices: [] };
      }

      const matchedLinks = extractMatchedLinks(
        html,
        searchUrl,
        titleMatcher,
        MAX_MATCHED_LINKS_PER_SHOP
      );
      const pageRelevant = isRelevantToTitle(html, titleMatcher);
      if (!pageRelevant && matchedLinks.length === 0) {
        if (templateIndex < templates.length - 1) {
          continue;
        }
        const summary = {
          shop: shopName,
          status: "no_prices_found",
          url: searchUrl,
          info: "Titel-Match fehlt",
          durationMs: Date.now() - startedAt,
        };
        updateShopHealth(shopHealthMap, shopName, summary);
        return { summary, prices: [] };
      }

      if (VERIFY_PRODUCT_PAGES && matchedLinks.length === 0) {
        if (templateIndex < templates.length - 1) {
          continue;
        }
        const summary = {
          shop: shopName,
          status: "no_prices_found",
          url: searchUrl,
          info: "Keine gematchten Produktlinks",
          durationMs: Date.now() - startedAt,
        };
        updateShopHealth(shopHealthMap, shopName, summary);
        return { summary, prices: [] };
      }

      const pricesFromMatchedPages =
        matchedLinks.length > 0
          ? await fetchPricesFromMatchedLinks(matchedLinks, searchUrl)
          : [];
      const prices = VERIFY_PRODUCT_PAGES
        ? pricesFromMatchedPages
        : pricesFromMatchedPages.length > 0
          ? pricesFromMatchedPages
          : extractPricesFromHtml(html, referencePrice);
      if (!prices.length) {
        if (templateIndex < templates.length - 1) {
          continue;
        }
        if (DEBUG_HTML_DIR) {
          const file = `${String(productIndex + 1).padStart(3, "0")}-${safeFileSlug(product.handle ?? product.title)}-${safeFileSlug(shopName)}.html`;
          await fs.mkdir(DEBUG_HTML_DIR, { recursive: true });
          await fs.writeFile(path.join(DEBUG_HTML_DIR, file), html, "utf8");
        }
        const summary = {
          shop: shopName,
          status: "no_prices_found",
          url: searchUrl,
          info: VERIFY_PRODUCT_PAGES
            ? "Keine Preise auf gematchten Produktseiten"
            : undefined,
          durationMs: Date.now() - startedAt,
        };
        updateShopHealth(shopHealthMap, shopName, summary);
        return { summary, prices: [] };
      }

      const stats = computeStats(prices);
      const preferredUrl = matchedLinks[0] ?? searchUrl;
      const summary = {
        shop: shopName,
        status: "ok",
        url: preferredUrl,
        matchedLinks,
        ...stats,
        durationMs: Date.now() - startedAt,
      };
      updateShopHealth(shopHealthMap, shopName, summary);
      return { summary, prices };
    } catch (error) {
      if (templateIndex < templates.length - 1) {
        continue;
      }
      const message =
        error instanceof HttpStatusError
          ? `HTTP ${error.status}`
          : error?.name === "AbortError"
            ? `Timeout nach ${TIMEOUT_MS}ms`
            : error instanceof Error
              ? error.message
              : "Unbekannter Fehler";
      const summary = {
        shop: shopName,
        status: "error",
        url: searchUrl,
        info: message,
        durationMs: Date.now() - startedAt,
      };
      updateShopHealth(shopHealthMap, shopName, summary);
      return { summary, prices: [] };
    }
  }

  const summary = {
    shop: shopName,
    status: "error",
    info: "Keine Search-Template Variante erfolgreich",
    durationMs: Date.now() - startedAt,
  };
  updateShopHealth(shopHealthMap, shopName, summary);
  return { summary, prices: [] };
};

const run = async () => {
  if (rawTimeoutMs <= 0) {
    console.log(
      `[shops] Hinweis: timeout-ms=${rawTimeoutMs} ist ungueltig. Verwende ${TIMEOUT_MS}ms.`
    );
  }

  const shops = await loadShops();
  if (!shops.length) {
    console.log("[shops] Keine aktiven Shops gefunden.");
    return;
  }

  const products = await prisma.product.findMany({
    where: INCLUDE_ALL_STATUSES ? undefined : { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    take: LIMIT > 0 ? LIMIT : undefined,
    include: {
      variants: {
        orderBy: { position: "asc" },
        select: { priceCents: true },
        take: 1,
      },
    },
  });

  if (!products.length) {
    console.log("[shops] Keine Produkte gefunden.");
    return;
  }

  console.log(
    `[shops] Starte Preisvergleich fuer ${products.length} Produkte ueber ${shops.length} Shops.`
  );
  console.log(
    `[shops] Konfiguration: timeout=${TIMEOUT_MS}ms retries=${RETRIES} shopConcurrency=${SHOP_CONCURRENCY} shopDelay=${SHOP_DELAY_MS}ms`
  );

  const results = [];
  const shopHealthMap = new Map();

  for (let productIndex = 0; productIndex < products.length; productIndex += 1) {
    const product = products[productIndex];
    const productLabel = formatProductLabel(product);
    const query = createSearchQuery(product);
    const referencePrice = (product.variants?.[0]?.priceCents ?? 0) / 100;
    const allPrices = [];
    const shopSummaries = [];
    const startedAt = Date.now();

    for (let start = 0; start < shops.length; start += SHOP_CONCURRENCY) {
      const batch = shops.slice(start, start + SHOP_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((shop) =>
          processShopForProduct({
            productIndex,
            product,
            query,
            referencePrice,
            shop,
            shopHealthMap,
          })
        )
      );

      for (const item of batchResults) {
        shopSummaries.push(item.summary);
        allPrices.push(...item.prices);
      }

      if (start + SHOP_CONCURRENCY < shops.length && SHOP_DELAY_MS > 0) {
        await sleep(SHOP_DELAY_MS);
      }
    }

    const finalStats = computeStats(allPrices);
    const okShops = shopSummaries.filter((item) => item.status === "ok").length;
    const blockedShops = shopSummaries.filter(
      (item) => item.status === "blocked"
    ).length;

    results.push({
      productId: product.id,
      title: product.title,
      handle: product.handle,
      manufacturer: product.manufacturer ?? null,
      query,
      status: finalStats ? "ok" : "no_prices_found",
      referencePrice: Number.isFinite(referencePrice) && referencePrice > 0
        ? Number(referencePrice.toFixed(2))
        : null,
      ...finalStats,
      sampledShops: okShops,
      blockedShops,
      totalShops: shops.length,
      links: shopSummaries
        .filter((item) => String(item.status) === "ok")
        .flatMap((item) =>
          Array.isArray(item.matchedLinks) && item.matchedLinks.length
            ? item.matchedLinks
            : []
        )
        .filter((value) => typeof value === "string" && value.length > 0),
      shopResults: shopSummaries,
    });

    if (finalStats) {
      console.log(
        `[${productIndex + 1}/${products.length}] ${productLabel}: low=${finalStats.lowest} avg=${finalStats.average} high=${finalStats.highest} (n=${finalStats.samples}, shops=${okShops}/${shops.length}) [${Date.now() - startedAt}ms]`
      );
    } else {
      console.log(
        `[${productIndex + 1}/${products.length}] ${productLabel}: keine Preise gefunden (shops ok=${okShops}, blocked=${blockedShops}) [${Date.now() - startedAt}ms]`
      );
    }

    if (SHOW_LINKS) {
      const lines = formatLinksForCli(shopSummaries, SHOW_REACHABLE_LINKS);
      if (lines.length) {
        console.log(`[links] ${productLabel}`);
        for (const line of lines) {
          console.log(`  ${line}`);
        }
      } else {
        console.log(`[links] ${productLabel}: keine passenden Links`);
      }
    }

    if (productIndex < products.length - 1 && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    provider: "shop-list",
    sourcesPath: SOURCES_PATH,
    shopConcurrency: SHOP_CONCURRENCY,
    shopTimeoutSkipAfter: SHOP_TIMEOUT_SKIP_AFTER,
    totalProducts: products.length,
    totalShops: shops.length,
    shopHealth: Array.from(shopHealthMap.entries()).map(([shop, state]) => ({
      shop,
      ...state,
    })),
    results,
  };

  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, JSON.stringify(payload, null, 2), "utf8");

  const csvLines = [
    toCsvLine([
      "productId",
      "manufacturer",
      "title",
      "handle",
      "query",
      "status",
      "referencePrice",
      "lowest",
      "average",
      "highest",
      "samples",
      "sampledShops",
      "blockedShops",
      "totalShops",
    ]),
  ];

  for (const row of results) {
    csvLines.push(
      toCsvLine([
        row.productId,
        row.manufacturer ?? "",
        row.title,
        row.handle,
        row.query,
        row.status,
        row.referencePrice ?? "",
        row.lowest ?? "",
        row.average ?? "",
        row.highest ?? "",
        row.samples ?? "",
        row.sampledShops ?? "",
        row.blockedShops ?? "",
        row.totalShops ?? "",
      ])
    );
  }

  await fs.mkdir(path.dirname(OUTPUT_CSV), { recursive: true });
  await fs.writeFile(OUTPUT_CSV, `${csvLines.join("\n")}\n`, "utf8");

  const okCount = results.filter((row) => row.status === "ok").length;
  const noPriceCount = results.filter(
    (row) => row.status === "no_prices_found"
  ).length;

  console.log(`[shops] Fertig. ok=${okCount} no_prices=${noPriceCount}`);
  console.log(`[shops] JSON: ${OUTPUT_JSON}`);
  console.log(`[shops] CSV:  ${OUTPUT_CSV}`);
};

run()
  .catch((error) => {
    console.error("[shops] Fatal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
