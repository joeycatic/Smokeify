import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_INPUT = "scripts/b2b-headshop/supplier-preview.json";
const DEFAULT_SELLER_NAME = "B2B Headshop";
const DEFAULT_SELLER_URL = "https://b2b-headshop.de";
const DEFAULT_MARGIN_PERCENT_BELOW_THRESHOLD = 15;
const DEFAULT_MARGIN_PERCENT_ABOVE_THRESHOLD = 20;
const DEFAULT_ROUNDING_STRATEGY = "nearest_99";
const DEFAULT_MIN_PRICE_EUR = 10;
const DEFAULT_MIN_PRICE_DELTA_EUR = 0.5;
const DEFAULT_MARGIN_THRESHOLD_EUR = 100;
const DEFAULT_SOURCE = "auto";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };

  return {
    input: getValue("--input"),
    apply: args.includes("--apply"),
    limit: Number(getValue("--limit") ?? 0),
    marginPercent: getValue("--margin-percent"),
    marginPercentBelowThreshold: getValue("--margin-percent-below-threshold"),
    marginPercentAboveThreshold: getValue("--margin-percent-above-threshold"),
    marginThresholdEur: getValue("--margin-threshold-eur"),
    rounding: getValue("--rounding"),
    minPriceEur: getValue("--min-price-eur"),
    minPriceDeltaEur: getValue("--min-price-delta-eur"),
    source: getValue("--source") ?? DEFAULT_SOURCE,
  };
};

const toCents = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
};

const ceilToNextWithEndings = (targetCents, endings) => {
  const normalized = Math.max(0, Math.ceil(targetCents));
  const euros = Math.floor(normalized / 100);
  const candidateEuros = [euros, euros + 1];
  const candidates = candidateEuros.flatMap((value) =>
    endings.map((ending) => value * 100 + ending)
  );
  return candidates
    .filter((candidate) => candidate >= normalized)
    .sort((a, b) => a - b)[0] ?? normalized;
};

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

const parseMarginPercent = (rawValue, defaultValue = DEFAULT_MARGIN_PERCENT_BELOW_THRESHOLD) => {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return defaultValue;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid margin percent: ${rawValue}`);
  }
  if (parsed < 0 || parsed >= 100) {
    throw new Error("Margin percent must be >= 0 and < 100.");
  }
  return parsed;
};

const parseMarginThresholdEur = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return DEFAULT_MARGIN_THRESHOLD_EUR;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid margin threshold EUR: ${rawValue}`);
  }
  return parsed;
};

const parseRoundingStrategy = (rawValue) => {
  if (!rawValue) return DEFAULT_ROUNDING_STRATEGY;
  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === "none" || normalized === "99" || normalized === "nearest_99") return normalized;
  if (normalized === "49_or_99" || normalized === "45_or_99") return "99";
  throw new Error(`Invalid rounding strategy: ${rawValue}`);
};

const parseMinPriceEur = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return DEFAULT_MIN_PRICE_EUR;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid minimum price EUR: ${rawValue}`);
  }
  return parsed;
};

const parseMinPriceDeltaEur = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return DEFAULT_MIN_PRICE_DELTA_EUR;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid minimum price delta EUR: ${rawValue}`);
  }
  return parsed;
};

const resolvePricingConfig = ({
  marginPercentArg,
  marginPercentBelowThresholdArg,
  marginPercentAboveThresholdArg,
  marginThresholdEurArg,
  roundingArg,
  minPriceEurArg,
  minPriceDeltaEurArg,
}) => {
  const marginPercentBelowThreshold = parseMarginPercent(
    marginPercentBelowThresholdArg ??
      process.env.B2B_HEADSHOP_TARGET_MARGIN_PERCENT_BELOW_THRESHOLD ??
      marginPercentArg ??
      process.env.B2B_HEADSHOP_TARGET_MARGIN_PERCENT,
    DEFAULT_MARGIN_PERCENT_BELOW_THRESHOLD
  );
  const marginPercentAboveThreshold = parseMarginPercent(
    marginPercentAboveThresholdArg ??
      process.env.B2B_HEADSHOP_TARGET_MARGIN_PERCENT_ABOVE_THRESHOLD ??
      marginPercentArg ??
      process.env.B2B_HEADSHOP_TARGET_MARGIN_PERCENT,
    DEFAULT_MARGIN_PERCENT_ABOVE_THRESHOLD
  );
  const marginThresholdEur = parseMarginThresholdEur(
    marginThresholdEurArg ?? process.env.B2B_HEADSHOP_MARGIN_THRESHOLD_EUR
  );
  const rounding = parseRoundingStrategy(
    roundingArg ?? process.env.B2B_HEADSHOP_PRICE_ROUNDING
  );
  const minPriceEur = parseMinPriceEur(
    minPriceEurArg ?? process.env.B2B_HEADSHOP_MIN_PRICE_EUR
  );
  const minPriceDeltaEur = parseMinPriceDeltaEur(
    minPriceDeltaEurArg ?? process.env.B2B_HEADSHOP_MIN_PRICE_DELTA_EUR
  );
  return {
    marginPercentBelowThreshold,
    marginPercentAboveThreshold,
    marginThresholdCents: Math.round(marginThresholdEur * 100),
    rounding,
    minPriceCents: Math.round(minPriceEur * 100),
    minPriceDeltaCents: Math.round(minPriceDeltaEur * 100),
    currency: "EUR",
  };
};

const buildSellPriceCents = (costCents, pricingConfig) => {
  if (typeof costCents !== "number" || !Number.isFinite(costCents)) return 0;
  const marginPercent =
    costCents < pricingConfig.marginThresholdCents
      ? pricingConfig.marginPercentBelowThreshold
      : pricingConfig.marginPercentAboveThreshold;
  // Tax is intentionally excluded from this pricing formula.
  const marginMultiplier = 1 - marginPercent / 100;
  if (marginMultiplier <= 0) {
    throw new Error("Invalid margin configuration produced divisor <= 0.");
  }
  const targetSellCents = costCents / marginMultiplier;
  if (pricingConfig.rounding === "none") return Math.ceil(targetSellCents);
  if (pricingConfig.rounding === "99") return ceilToNextWithEndings(Math.ceil(targetSellCents), [99]);
  return roundToNearest99(targetSellCents, costCents);
};

const isSignificantPriceChange = (prevCents, nextCents, minDeltaCents) =>
  prevCents !== nextCents && Math.abs(nextCents - prevCents) >= minDeltaCents;

const buildUpdatesFromDbCosts = (variants, pricingConfig) => {
  const eligibleEntries = [];
  let missingCostCount = 0;

  for (const variant of variants) {
    if (
      typeof variant.costCents !== "number" ||
      !Number.isFinite(variant.costCents) ||
      variant.costCents <= 0
    ) {
      missingCostCount += 1;
      continue;
    }

    const nextPriceCents = buildSellPriceCents(variant.costCents, pricingConfig);
    eligibleEntries.push({
      id: variant.id,
      title: variant.title,
      prevCostCents: variant.costCents,
      prevPriceCents: variant.priceCents,
      nextCostCents: variant.costCents,
      nextPriceCents,
    });
  }

  return {
    missingCostCount,
    eligibleCount: eligibleEntries.length,
    variantUpdates: eligibleEntries.filter((entry) =>
      isSignificantPriceChange(entry.prevPriceCents, entry.nextPriceCents, pricingConfig.minPriceDeltaCents)
    ),
  };
};

const applyMinimumPriceFloor = (updates, minPriceCents) => {
  const allowedUpdates = [];
  let skippedBelowMinPrice = 0;
  for (const update of updates) {
    if (update.nextPriceCents < minPriceCents) {
      skippedBelowMinPrice += 1;
      continue;
    }
    allowedUpdates.push(update);
  }
  return {
    allowedUpdates,
    skippedBelowMinPrice,
  };
};

const formatCents = (cents) => (cents / 100).toFixed(2);

const loadPreview = (inputPath) => {
  const absolute = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(process.cwd(), inputPath);
  const raw = fs.readFileSync(absolute, "utf8");
  return JSON.parse(raw);
};

const resolvePreviewInputPath = (inputArg) => {
  const inputPath = inputArg ?? DEFAULT_INPUT;
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.join(process.cwd(), inputPath);
};

const parseSource = (rawValue) => {
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  if (
    normalized === "auto" ||
    normalized === "preview" ||
    normalized === "db" ||
    normalized === "hybrid"
  ) {
    return normalized;
  }
  throw new Error(`Invalid source: ${rawValue}. Use auto, preview, db, or hybrid.`);
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
  if (normalizedGtin) {
    withoutGtin.push(`GTIN: ${normalizedGtin}`);
  }
  return withoutGtin.length ? withoutGtin.join("; ") : null;
};

const resolveSupplier = async () => {
  const supplierId = process.env.B2B_HEADSHOP_SUPPLIER_ID ?? null;
  const supplierName = process.env.B2B_HEADSHOP_SUPPLIER_NAME ?? null;

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });
    if (!supplier) {
      throw new Error(`Supplier not found for id=${supplierId}`);
    }
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

const buildSupplierFilter = ({ supplierId, sellerName, sellerHost }) => ({
  OR: [
    ...(supplierId ? [{ supplierId }] : []),
    { supplier: { equals: sellerName, mode: "insensitive" } },
    { sellerName: { equals: sellerName, mode: "insensitive" } },
    { sellerUrl: { contains: sellerHost, mode: "insensitive" } },
  ],
});

const run = async () => {
  const {
    input,
    apply,
    limit,
    marginPercent,
    marginPercentBelowThreshold,
    marginPercentAboveThreshold,
    marginThresholdEur,
    rounding,
    minPriceEur,
    source,
  } =
    parseArgs();
  const allowWrite = process.env.B2B_HEADSHOP_REPRICE_ALLOW_WRITE === "1";
  const pricingConfig = resolvePricingConfig({
    marginPercentArg: marginPercent,
    marginPercentBelowThresholdArg: marginPercentBelowThreshold,
    marginPercentAboveThresholdArg: marginPercentAboveThreshold,
    marginThresholdEurArg: marginThresholdEur,
    roundingArg: rounding,
    minPriceEurArg: minPriceEur,
    minPriceDeltaEurArg: minPriceDeltaEur,
  });
  const pricingSource = parseSource(source);

  if (!apply || !allowWrite) {
    console.log(
      "[override] Dry run only. Set B2B_HEADSHOP_REPRICE_ALLOW_WRITE=1 and pass --apply to write."
    );
  }

  const previewPath = resolvePreviewInputPath(input);
  const hasPreviewFile = fs.existsSync(previewPath);
  const effectiveSource =
    pricingSource === "auto" ? (hasPreviewFile ? "hybrid" : "db") : pricingSource;
  if (effectiveSource === "preview" && !hasPreviewFile) {
    throw new Error(
      `Preview file not found at ${previewPath}. Pass --source db or provide --input.`
    );
  }

  const previewByHandle = new Map();
  const previewByUrl = new Map();
  if (effectiveSource === "preview" || effectiveSource === "hybrid") {
    const payload = loadPreview(previewPath);
    const previewItems = Array.isArray(payload.items) ? payload.items : [];
    for (const item of previewItems) {
      const handle =
        typeof item?.handle === "string" ? item.handle.trim().toLowerCase() : "";
      if (!handle) continue;
      previewByHandle.set(handle, item);
      const normalizedSourceUrl = normalizeUrl(item?.sourceUrl);
      if (normalizedSourceUrl) {
        previewByUrl.set(normalizedSourceUrl, item);
      }
    }
  }

  const sellerName =
    process.env.B2B_HEADSHOP_SELLER_NAME ?? DEFAULT_SELLER_NAME;
  const sellerUrl = process.env.B2B_HEADSHOP_SELLER_URL ?? DEFAULT_SELLER_URL;
  const sellerHost = new URL(sellerUrl).hostname.toLowerCase();
  const supplier = await resolveSupplier();
  const where = buildSupplierFilter({
    supplierId: supplier?.id ?? null,
    sellerName,
    sellerHost,
  });

  const products = await prisma.product.findMany({
    where,
    orderBy: { handle: "asc" },
    select: {
      id: true,
      title: true,
      handle: true,
      sellerUrl: true,
      technicalDetails: true,
      variants: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          costCents: true,
          priceCents: true,
        },
      },
    },
  });

  const targets = limit > 0 ? products.slice(0, limit) : products;
  const results = {
    supplierProductsFound: products.length,
    inspected: 0,
    updatedProducts: 0,
    updatedVariants: 0,
    skippedNoPreviewMatch: 0,
    skippedMissingPreviewPrice: 0,
    skippedMissingDbCost: 0,
    skippedBelowMinPrice: 0,
    skippedNoVariants: 0,
    unchangedVariants: 0,
    updatedTechnicalDetails: 0,
  };

  for (const product of targets) {
    results.inspected += 1;

    if (!product.variants.length) {
      results.skippedNoVariants += 1;
      console.log(`[override] skip handle=${product.handle} reason=no_variants`);
      continue;
    }

    let variantUpdates = [];
    let unchangedVariantCount = product.variants.length;
    let technicalDetailsUpdate = null;
    if (effectiveSource === "preview" || effectiveSource === "hybrid") {
      const previewItem =
        previewByHandle.get(product.handle.toLowerCase()) ??
        previewByUrl.get(normalizeUrl(product.sellerUrl));
      if (!previewItem) {
        if (effectiveSource === "preview") {
          results.skippedNoPreviewMatch += 1;
          console.log(
            `[override] skip handle=${product.handle} reason=no_preview_match`
          );
          continue;
        }
      }

      const previewCostCents =
        previewItem && toCents(previewItem.price) !== null
          ? toCents(previewItem.price)
          : null;
      if (previewItem && previewCostCents === null && effectiveSource === "preview") {
        results.skippedMissingPreviewPrice += 1;
        console.log(
          `[override] skip handle=${product.handle} reason=missing_preview_price`
        );
        continue;
      }

      if (previewCostCents !== null) {
        const nextPriceCents = buildSellPriceCents(previewCostCents, pricingConfig);
        variantUpdates = product.variants
          .map((variant) => ({
            id: variant.id,
            title: variant.title,
            prevCostCents: variant.costCents,
            prevPriceCents: variant.priceCents,
            nextCostCents: previewCostCents,
            nextPriceCents,
          }))
          .filter(
            (entry) =>
              entry.prevCostCents !== entry.nextCostCents ||
              isSignificantPriceChange(entry.prevPriceCents, entry.nextPriceCents, pricingConfig.minPriceDeltaCents)
          );
      } else {
        if (previewItem && effectiveSource === "hybrid") {
          results.skippedMissingPreviewPrice += 1;
        }
        const dbResult = buildUpdatesFromDbCosts(product.variants, pricingConfig);
        variantUpdates = dbResult.variantUpdates;
        unchangedVariantCount = dbResult.eligibleCount;
        if (dbResult.eligibleCount === 0) {
          results.skippedMissingDbCost += product.variants.length;
          console.log(
            `[override] skip handle=${product.handle} reason=missing_db_cost`
          );
          continue;
        }
        if (dbResult.missingCostCount > 0) {
          results.skippedMissingDbCost += dbResult.missingCostCount;
        }
      }

      const previewGtin = extractGtinFromPreviewItem(previewItem);
      if (previewGtin) {
        const nextTechnicalDetails = mergeTechnicalDetailsWithGtin(
          product.technicalDetails,
          previewGtin
        );
        const previousTechnicalDetails =
          typeof product.technicalDetails === "string"
            ? product.technicalDetails.trim() || null
            : null;
        if (nextTechnicalDetails !== previousTechnicalDetails) {
          technicalDetailsUpdate = {
            nextTechnicalDetails,
            gtin: previewGtin,
          };
        }
      }
    } else {
      const dbResult = buildUpdatesFromDbCosts(product.variants, pricingConfig);
      variantUpdates = dbResult.variantUpdates;
      unchangedVariantCount = dbResult.eligibleCount;
      if (dbResult.eligibleCount === 0) {
        results.skippedMissingDbCost += product.variants.length;
        console.log(
          `[override] skip handle=${product.handle} reason=missing_db_cost`
        );
        continue;
      }
      if (dbResult.missingCostCount > 0) {
        results.skippedMissingDbCost += dbResult.missingCostCount;
      }
    }

    const floorResult = applyMinimumPriceFloor(
      variantUpdates,
      pricingConfig.minPriceCents
    );
    variantUpdates = floorResult.allowedUpdates;
    if (floorResult.skippedBelowMinPrice > 0) {
      results.skippedBelowMinPrice += floorResult.skippedBelowMinPrice;
    }

    if (!variantUpdates.length && !technicalDetailsUpdate) {
      if (floorResult.skippedBelowMinPrice > 0) {
        console.log(
          `[override] skip handle=${product.handle} reason=below_min_price min=${formatCents(pricingConfig.minPriceCents)}`
        );
        continue;
      }
      results.unchangedVariants += unchangedVariantCount;
      console.log(
        `[override] unchanged handle=${product.handle} variants=${unchangedVariantCount}`
      );
      continue;
    }

    if (!apply || !allowWrite) {
      for (const update of variantUpdates) {
        console.log(
          `[override] preview handle=${product.handle} variant=${update.title} cost=${formatCents(update.prevCostCents)}->${formatCents(update.nextCostCents)} price=${formatCents(update.prevPriceCents)}->${formatCents(update.nextPriceCents)}`
        );
      }
      if (technicalDetailsUpdate) {
        console.log(
          `[override] preview handle=${product.handle} technicalDetails=GTIN:${technicalDetailsUpdate.gtin}`
        );
      }
      results.updatedProducts += 1;
      results.updatedVariants += variantUpdates.length;
      if (technicalDetailsUpdate) {
        results.updatedTechnicalDetails += 1;
      }
      continue;
    }

    const writeOps = variantUpdates.map((update) =>
      prisma.variant.update({
        where: { id: update.id },
        data: {
          costCents: update.nextCostCents,
          priceCents: update.nextPriceCents,
        },
      })
    );
    if (technicalDetailsUpdate) {
      writeOps.push(
        prisma.product.update({
          where: { id: product.id },
          data: {
            technicalDetails: technicalDetailsUpdate.nextTechnicalDetails,
          },
        })
      );
    }
    await prisma.$transaction(writeOps);

    for (const update of variantUpdates) {
      console.log(
        `[override] apply handle=${product.handle} variant=${update.title} cost=${formatCents(update.prevCostCents)}->${formatCents(update.nextCostCents)} price=${formatCents(update.prevPriceCents)}->${formatCents(update.nextPriceCents)}`
      );
    }
    if (technicalDetailsUpdate) {
      console.log(
        `[override] apply handle=${product.handle} technicalDetails=GTIN:${technicalDetailsUpdate.gtin}`
      );
    }
    results.updatedProducts += 1;
    results.updatedVariants += variantUpdates.length;
    if (technicalDetailsUpdate) {
      results.updatedTechnicalDetails += 1;
    }
  }

  console.log(
    `[override] done found=${results.supplierProductsFound} inspected=${results.inspected} updatedProducts=${results.updatedProducts} updatedVariants=${results.updatedVariants} updatedTechnicalDetails=${results.updatedTechnicalDetails} unchangedVariants=${results.unchangedVariants} skippedNoPreviewMatch=${results.skippedNoPreviewMatch} skippedMissingPreviewPrice=${results.skippedMissingPreviewPrice} skippedMissingDbCost=${results.skippedMissingDbCost} skippedBelowMinPrice=${results.skippedBelowMinPrice} skippedNoVariants=${results.skippedNoVariants} source=${effectiveSource} minPrice=${formatCents(pricingConfig.minPriceCents)} marginBelow=${pricingConfig.marginPercentBelowThreshold}% marginAbove=${pricingConfig.marginPercentAboveThreshold}% threshold=${formatCents(pricingConfig.marginThresholdCents)} rounding=${pricingConfig.rounding} currency=${pricingConfig.currency}`
  );
};

run()
  .catch((error) => {
    console.error("[override] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
