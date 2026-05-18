import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const REQUEST_DELAY_MS = Number(process.env.GTIN_OVERRIDE_DELAY_MS ?? 400);
const REQUEST_TIMEOUT_MS = Number(process.env.GTIN_OVERRIDE_TIMEOUT_MS ?? 15000);

const SELLERS = {
  bloomtech: {
    key: "bloomtech",
    envPrefix: "BLOOMTECH",
    defaultSellerName: "Bloomtech",
    defaultSellerUrl: "https://bloomtech.de",
    defaultInput: "scripts/bloomtech/supplier-preview.json",
  },
  "b2b-headshop": {
    key: "b2b-headshop",
    envPrefix: "B2B_HEADSHOP",
    defaultSellerName: "B2B Headshop",
    defaultSellerUrl: "https://b2b-headshop.de",
    defaultInput: "scripts/b2b-headshop/supplier-preview.json",
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };

  return {
    apply: args.includes("--apply"),
    limit: Number(getValue("--limit") ?? 0),
    seller: getValue("--seller") ?? "all",
    source: getValue("--source") ?? "live",
    inputBloomtech: getValue("--input-bloomtech"),
    inputB2BHeadshop: getValue("--input-b2b-headshop"),
  };
};

const parseSource = (rawValue) => {
  const normalized = String(rawValue ?? "live").trim().toLowerCase();
  if (normalized === "live" || normalized === "preview" || normalized === "auto") {
    return normalized;
  }
  throw new Error(`Invalid --source value: ${rawValue}. Use live, preview, or auto.`);
};

const parseSellerSelection = (rawValue) => {
  const normalized = String(rawValue ?? "all").trim().toLowerCase();
  if (!normalized || normalized === "all") return Object.keys(SELLERS);
  const values = normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const invalid = values.filter((value) => !SELLERS[value]);
  if (invalid.length > 0) {
    throw new Error(
      `Invalid --seller value: ${invalid.join(", ")}. Use bloomtech, b2b-headshop, or all.`
    );
  }
  return Array.from(new Set(values));
};

const normalizeUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    parsed.search = "";
    parsed.hash = "";
    let normalized = parsed.toString();
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return normalized.toLowerCase();
  } catch {
    return null;
  }
};

const normalizeGtin = (value) => {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (![8, 12, 13, 14].includes(digits.length)) return "";
  return digits;
};

const stripTags = (html) =>
  String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractGtinsFromHtml = (html) => {
  const candidates = [];
  const pushIfValid = (value) => {
    const normalized = normalizeGtin(value);
    if (normalized) candidates.push(normalized);
  };

  const jsonPatterns = [
    /"gtin(?:8|12|13|14)"\s*:\s*"([^"]+)"/gi,
    /"ean"\s*:\s*"([^"]+)"/gi,
  ];
  for (const pattern of jsonPatterns) {
    let match = pattern.exec(html);
    while (match) {
      pushIfValid(match[1]);
      match = pattern.exec(html);
    }
  }

  const metaPatterns = [
    /itemprop=["']gtin(?:8|12|13|14)["'][^>]*content=["']([^"']+)["']/gi,
    /itemprop=["']ean["'][^>]*content=["']([^"']+)["']/gi,
  ];
  for (const pattern of metaPatterns) {
    let match = pattern.exec(html);
    while (match) {
      pushIfValid(match[1]);
      match = pattern.exec(html);
    }
  }

  const text = stripTags(html);
  const textPattern = /(?:GTIN|EAN|EAN-13)\s*[:#]?\s*([0-9][0-9\s-]{6,20})/gi;
  let textMatch = textPattern.exec(text);
  while (textMatch) {
    pushIfValid(textMatch[1]);
    textMatch = textPattern.exec(text);
  }

  return Array.from(new Set(candidates));
};

const mergeTechnicalDetailsWithGtin = (technicalDetails, gtin) => {
  const normalizedGtin = normalizeGtin(gtin);
  const source =
    typeof technicalDetails === "string" ? technicalDetails.trim() : "";
  const parts = source
    ? source
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  const withoutGtin = parts.filter(
    (part) => !/^(gtin|ean|ean-13)\s*:/i.test(part)
  );
  if (normalizedGtin) withoutGtin.push(`GTIN: ${normalizedGtin}`);
  return withoutGtin.length ? withoutGtin.join("; ") : null;
};

const resolveInputPath = (inputPath) => {
  if (!inputPath) return null;
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.join(process.cwd(), inputPath);
};

const loadPreviewMaps = (inputPath) => {
  const absolute = resolveInputPath(inputPath);
  if (!absolute || !fs.existsSync(absolute)) {
    return { byHandle: new Map(), byUrl: new Map(), absolute: absolute ?? "" };
  }
  const raw = fs.readFileSync(absolute, "utf8");
  const payload = JSON.parse(raw);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const byHandle = new Map();
  const byUrl = new Map();
  for (const item of items) {
    const handle =
      typeof item?.handle === "string" ? item.handle.trim().toLowerCase() : "";
    if (handle) byHandle.set(handle, item);
    const sourceUrl = normalizeUrl(item?.sourceUrl);
    if (sourceUrl) byUrl.set(sourceUrl, item);
  }
  return { byHandle, byUrl, absolute };
};

const extractGtinFromPreviewItem = (item) => {
  if (!item || typeof item !== "object") return "";
  const direct = normalizeGtin(item.gtin);
  if (direct) return direct;
  if (typeof item.technicalDetails === "string") {
    const match = item.technicalDetails.match(
      /(?:^|;\s*)(?:GTIN|EAN|EAN-13)\s*:\s*([0-9][0-9\s-]{6,20})/i
    );
    if (match) {
      const fromDetails = normalizeGtin(match[1]);
      if (fromDetails) return fromDetails;
    }
  }
  return "";
};

const buildFilter = ({ supplierId, sellerName, sellerHost }) => ({
  OR: [
    ...(supplierId ? [{ supplierId }] : []),
    { supplier: { equals: sellerName, mode: "insensitive" } },
    { sellerName: { equals: sellerName, mode: "insensitive" } },
    { sellerUrl: { contains: sellerHost, mode: "insensitive" } },
  ],
});

const resolveSupplier = async (envPrefix) => {
  const supplierId = process.env[`${envPrefix}_SUPPLIER_ID`] ?? null;
  const supplierName = process.env[`${envPrefix}_SUPPLIER_NAME`] ?? null;

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });
    if (!supplier) throw new Error(`Supplier not found for id=${supplierId}`);
    return supplier;
  }

  if (supplierName) {
    const supplier = await prisma.supplier.findUnique({
      where: { name: supplierName },
      select: { id: true, name: true },
    });
    if (supplier) return supplier;
  }

  return null;
};

const fetchHtmlWithTimeout = async (url, headers) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SmokeifyGTINBot/1.0; +https://smokeify.local)",
        "accept-language": "de-DE,de;q=0.9,en;q=0.8",
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
};

const runForSeller = async ({
  sellerConfig,
  source,
  inputPath,
  limit,
  allowWrite,
  apply,
}) => {
  const previewMaps = loadPreviewMaps(inputPath);
  const sellerName =
    process.env[`${sellerConfig.envPrefix}_SELLER_NAME`] ??
    sellerConfig.defaultSellerName;
  const sellerUrl =
    process.env[`${sellerConfig.envPrefix}_SELLER_URL`] ??
    sellerConfig.defaultSellerUrl;
  const sellerHost = new URL(sellerUrl).hostname.toLowerCase();
  const supplier = await resolveSupplier(sellerConfig.envPrefix);
  const where = buildFilter({
    supplierId: supplier?.id ?? null,
    sellerName,
    sellerHost,
  });
  const cookie = process.env[`${sellerConfig.envPrefix}_COOKIE`]?.trim();

  const products = await prisma.product.findMany({
    where,
    orderBy: { handle: "asc" },
    select: {
      id: true,
      handle: true,
      sellerUrl: true,
      technicalDetails: true,
    },
  });

  const targets = limit > 0 ? products.slice(0, limit) : products;
  const stats = {
    seller: sellerConfig.key,
    source,
    previewPath: previewMaps.absolute,
    foundProducts: products.length,
    inspected: 0,
    updated: 0,
    unchanged: 0,
    skippedNoSellerUrl: 0,
    skippedNoPreviewMatch: 0,
    skippedMissingGtin: 0,
    failedFetch: 0,
  };

  for (const product of targets) {
    stats.inspected += 1;
    let gtin = "";

    const useLive = source === "live" || source === "auto";
    if (useLive) {
      const normalizedProductUrl = normalizeUrl(product.sellerUrl);
      if (!normalizedProductUrl) {
        stats.skippedNoSellerUrl += 1;
      } else {
        try {
          const html = await fetchHtmlWithTimeout(normalizedProductUrl, {
            ...(cookie ? { cookie } : {}),
          });
          const gtins = extractGtinsFromHtml(html);
          if (gtins.length > 0) gtin = gtins[0];
        } catch (error) {
          stats.failedFetch += 1;
          console.warn(
            `[gtin] fetch_failed seller=${sellerConfig.key} handle=${product.handle} url=${normalizedProductUrl} error=${error instanceof Error ? error.message : "unknown"}`
          );
        }
      }
    }

    if (!gtin && (source === "preview" || source === "auto")) {
      const previewItem =
        previewMaps.byHandle.get(product.handle.toLowerCase()) ??
        previewMaps.byUrl.get(normalizeUrl(product.sellerUrl));
      if (previewItem) {
        gtin = extractGtinFromPreviewItem(previewItem);
      } else if (source === "preview") {
        stats.skippedNoPreviewMatch += 1;
        continue;
      }
    }

    if (!gtin) {
      stats.skippedMissingGtin += 1;
      continue;
    }

    const nextTechnicalDetails = mergeTechnicalDetailsWithGtin(
      product.technicalDetails,
      gtin
    );
    const previousTechnicalDetails =
      typeof product.technicalDetails === "string"
        ? product.technicalDetails.trim() || null
        : null;

    if (nextTechnicalDetails === previousTechnicalDetails) {
      stats.unchanged += 1;
      continue;
    }

    if (!apply || !allowWrite) {
      console.log(
        `[gtin] preview seller=${sellerConfig.key} handle=${product.handle} gtin=${gtin}`
      );
      stats.updated += 1;
      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        technicalDetails: nextTechnicalDetails,
      },
    });
    console.log(
      `[gtin] apply seller=${sellerConfig.key} handle=${product.handle} gtin=${gtin}`
    );
    stats.updated += 1;

    if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `[gtin] done seller=${stats.seller} source=${stats.source} found=${stats.foundProducts} inspected=${stats.inspected} updated=${stats.updated} unchanged=${stats.unchanged} skippedNoSellerUrl=${stats.skippedNoSellerUrl} skippedNoPreviewMatch=${stats.skippedNoPreviewMatch} skippedMissingGtin=${stats.skippedMissingGtin} failedFetch=${stats.failedFetch} preview=${stats.previewPath || "-"}`
  );
};

const run = async () => {
  const {
    apply,
    limit,
    seller,
    source: sourceRaw,
    inputBloomtech,
    inputB2BHeadshop,
  } = parseArgs();
  const source = parseSource(sourceRaw);
  const allowWrite = process.env.GTIN_OVERRIDE_ALLOW_WRITE === "1";

  if (!apply || !allowWrite) {
    console.log(
      "[gtin] Dry run only. Set GTIN_OVERRIDE_ALLOW_WRITE=1 and pass --apply to write."
    );
  }

  const selectedSellers = parseSellerSelection(seller);
  for (const sellerKey of selectedSellers) {
    const sellerConfig = SELLERS[sellerKey];
    const inputPath =
      sellerKey === "bloomtech"
        ? inputBloomtech ?? sellerConfig.defaultInput
        : inputB2BHeadshop ?? sellerConfig.defaultInput;
    await runForSeller({
      sellerConfig,
      source,
      inputPath,
      limit,
      allowWrite,
      apply,
    });
  }
};

run()
  .catch((error) => {
    console.error("[gtin] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
