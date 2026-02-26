import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_MARGIN_PERCENT_BELOW_THRESHOLD = 15;
const DEFAULT_MARGIN_PERCENT_ABOVE_THRESHOLD = 20;
const DEFAULT_ROUNDING_STRATEGY = "nearest_99";
const DEFAULT_MIN_PRICE_EUR = 10;
const DEFAULT_MIN_PRICE_DELTA_EUR = 0.5;
const DEFAULT_MARGIN_THRESHOLD_EUR = 100;

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
    marginPercent: getValue("--margin-percent"),
    marginPercentBelowThreshold: getValue("--margin-percent-below-threshold"),
    marginPercentAboveThreshold: getValue("--margin-percent-above-threshold"),
    marginThresholdEur: getValue("--margin-threshold-eur"),
    rounding: getValue("--rounding"),
    minPriceEur: getValue("--min-price-eur"),
    minPriceDeltaEur: getValue("--min-price-delta-eur"),
  };
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
      process.env.CATALOG_TARGET_MARGIN_PERCENT_BELOW_THRESHOLD ??
      marginPercentArg ??
      process.env.CATALOG_TARGET_MARGIN_PERCENT,
    DEFAULT_MARGIN_PERCENT_BELOW_THRESHOLD
  );
  const marginPercentAboveThreshold = parseMarginPercent(
    marginPercentAboveThresholdArg ??
      process.env.CATALOG_TARGET_MARGIN_PERCENT_ABOVE_THRESHOLD ??
      marginPercentArg ??
      process.env.CATALOG_TARGET_MARGIN_PERCENT,
    DEFAULT_MARGIN_PERCENT_ABOVE_THRESHOLD
  );
  const marginThresholdEur = parseMarginThresholdEur(
    marginThresholdEurArg ?? process.env.CATALOG_MARGIN_THRESHOLD_EUR
  );
  const rounding = parseRoundingStrategy(
    roundingArg ?? process.env.CATALOG_PRICE_ROUNDING
  );
  const minPriceEur = parseMinPriceEur(
    minPriceEurArg ?? process.env.CATALOG_MIN_PRICE_EUR
  );
  const minPriceDeltaEur = parseMinPriceDeltaEur(
    minPriceDeltaEurArg ?? process.env.CATALOG_MIN_PRICE_DELTA_EUR
  );

  return {
    marginPercentBelowThreshold,
    marginPercentAboveThreshold,
    marginThresholdCents: Math.round(marginThresholdEur * 100),
    rounding,
    minPriceCents: Math.round(minPriceEur * 100),
    minPriceDeltaCents: Math.round(minPriceDeltaEur * 100),
  };
};

const buildSellPriceCents = (costCents, pricingConfig) => {
  if (typeof costCents !== "number" || !Number.isFinite(costCents)) return 0;
  const marginPercent =
    costCents < pricingConfig.marginThresholdCents
      ? pricingConfig.marginPercentBelowThreshold
      : pricingConfig.marginPercentAboveThreshold;
  const marginMultiplier = 1 - marginPercent / 100;
  if (marginMultiplier <= 0) {
    throw new Error("Invalid margin configuration produced divisor <= 0.");
  }
  const targetSellCents = costCents / marginMultiplier;
  if (pricingConfig.rounding === "none") return Math.ceil(targetSellCents);
  if (pricingConfig.rounding === "99") return ceilToNextWithEndings(Math.ceil(targetSellCents), [99]);
  return roundToNearest99(targetSellCents, costCents);
};

const formatCents = (cents) => (cents / 100).toFixed(2);

const main = async () => {
  const args = parseArgs();
  const allowWrite = process.env.CATALOG_REPRICE_ALLOW_WRITE === "1";
  const apply = args.apply && allowWrite;
  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : null;

  const pricingConfig = resolvePricingConfig({
    marginPercentArg: args.marginPercent,
    marginPercentBelowThresholdArg: args.marginPercentBelowThreshold,
    marginPercentAboveThresholdArg: args.marginPercentAboveThreshold,
    marginThresholdEurArg: args.marginThresholdEur,
    roundingArg: args.rounding,
    minPriceEurArg: args.minPriceEur,
    minPriceDeltaEurArg: args.minPriceDeltaEur,
  });

  if (args.apply && !allowWrite) {
    console.log(
      "[catalog-pricing] Dry run only. Set CATALOG_REPRICE_ALLOW_WRITE=1 and pass --apply to write."
    );
  }

  console.log(`[catalog-pricing] mode=${apply ? "apply" : "dry-run"}`);
  console.log(
    `[catalog-pricing] marginBelow=${pricingConfig.marginPercentBelowThreshold}% marginAbove=${pricingConfig.marginPercentAboveThreshold}% threshold=${formatCents(pricingConfig.marginThresholdCents)} min=${formatCents(pricingConfig.minPriceCents)} minDelta=${formatCents(pricingConfig.minPriceDeltaCents)} rounding=${pricingConfig.rounding}`
  );

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      title: true,
      handle: true,
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

  if (products.length === 0) {
    console.log("[catalog-pricing] No active products found.");
    return;
  }

  let inspectedProducts = 0;
  let updatedProducts = 0;
  let inspectedVariants = 0;
  let updatedVariants = 0;
  let skippedNoVariants = 0;
  let skippedMissingCost = 0;
  let skippedBelowMin = 0;

  for (const product of products) {
    inspectedProducts += 1;
    if (!product.variants.length) {
      skippedNoVariants += 1;
      console.log(
        `[catalog-pricing] skip handle=${product.handle} reason=no_variants`
      );
      continue;
    }

    const variantUpdates = [];

    for (const variant of product.variants) {
      inspectedVariants += 1;
      if (
        typeof variant.costCents !== "number" ||
        !Number.isFinite(variant.costCents) ||
        variant.costCents <= 0
      ) {
        skippedMissingCost += 1;
        continue;
      }

      const nextPriceCents = buildSellPriceCents(variant.costCents, pricingConfig);
      if (nextPriceCents < pricingConfig.minPriceCents) {
        skippedBelowMin += 1;
        continue;
      }

      if (
        nextPriceCents !== variant.priceCents &&
        Math.abs(nextPriceCents - variant.priceCents) >= pricingConfig.minPriceDeltaCents
      ) {
        variantUpdates.push({
          id: variant.id,
          title: variant.title,
          prevPriceCents: variant.priceCents,
          nextPriceCents,
          costCents: variant.costCents,
        });
      }
    }

    if (!variantUpdates.length) {
      continue;
    }

    updatedProducts += 1;
    updatedVariants += variantUpdates.length;

    for (const update of variantUpdates) {
      console.log(
        `[catalog-pricing] ${apply ? "apply" : "preview"} handle=${product.handle} variant=${update.title} cost=${formatCents(update.costCents)} price=${formatCents(update.prevPriceCents)}->${formatCents(update.nextPriceCents)}`
      );

      if (apply) {
        await prisma.variant.update({
          where: { id: update.id },
          data: { priceCents: update.nextPriceCents },
        });
      }
    }
  }

  console.log(
    `[catalog-pricing] done inspectedProducts=${inspectedProducts} updatedProducts=${updatedProducts} inspectedVariants=${inspectedVariants} updatedVariants=${updatedVariants} skippedNoVariants=${skippedNoVariants} skippedMissingCost=${skippedMissingCost} skippedBelowMin=${skippedBelowMin} mode=${apply ? "apply" : "dry-run"}`
  );
};

main()
  .catch((error) => {
    console.error("[catalog-pricing] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
