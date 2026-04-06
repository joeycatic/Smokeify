import type { PricingProductSegment } from "@prisma/client";
import type { PricingAutomationConfig } from "@/lib/pricingAutomationConfig";

export const PRICING_REASON_CODES = {
  missingBaseCost: "missing_base_cost",
  missingSupplierShippingCost: "missing_supplier_shipping_cost",
  missingInboundShippingCost: "missing_inbound_shipping_cost",
  missingPackagingCost: "missing_packaging_cost",
  missingHandlingCost: "missing_handling_cost",
  autoRepriceDisabled: "auto_reprice_disabled",
  productTooNew: "product_too_new",
  lowData: "low_data",
  competitorMissing: "competitor_missing",
  competitorStale: "competitor_stale",
  competitorUnreliable: "competitor_unreliable",
  competitorAwareTarget: "competitor_aware_target",
  marketFallbackToCurrent: "market_fallback_to_current_price",
  sellerSoftCapApplied: "seller_soft_cap_applied",
  sellerSoftCapExceededByFloor: "seller_soft_cap_exceeded_by_floor",
  inventoryPressureDown: "inventory_pressure_down",
  inventoryPressureUp: "inventory_pressure_up",
  guardrailHigherPriceReviewExceeded: "guardrail_higher_price_review_exceeded",
  floorPriceProtection: "floor_price_protection",
  roundedToPsychologicalEnding: "rounded_to_psychological_ending",
  compareAtFromPublicListPrice: "compare_at_from_public_list_price",
  compareAtFromMarketHigh: "compare_at_from_market_high",
  compareAtFromMarketAverage: "compare_at_from_market_average",
  compareAtCleared: "compare_at_cleared",
} as const;

export type PricingReasonCode =
  (typeof PRICING_REASON_CODES)[keyof typeof PRICING_REASON_CODES];

export type PricingCalculationInput = {
  variantId: string;
  productId: string;
  sku: string | null;
  title: string;
  currentPriceCents: number;
  currentCompareAtCents: number | null;
  baseCostCents: number | null;
  supplierShippingCostCents: number | null;
  inboundShippingCostCents: number | null;
  packagingCostCents: number | null;
  handlingCostCents: number | null;
  paymentFeePercentBasisPoints: number;
  paymentFixedFeeCents: number;
  returnRiskBufferBasisPoints: number;
  targetMarginBasisPoints: number;
  competitorMinPriceCents: number | null;
  competitorAveragePriceCents: number | null;
  competitorHighPriceCents: number | null;
  publicCompareAtCents: number | null;
  competitorObservedAt: Date | null;
  competitorSourceLabel?: string | null;
  competitorReliabilityScore: number | null;
  productSegment: PricingProductSegment;
  autoRepriceEnabled: boolean;
  stockOnHand: number;
  reservedUnits: number;
  recentSalesVelocity: number;
  recentConversionRate: number;
  recentViews: number;
  recentUnitsSold: number;
  productCreatedAt: Date;
  now: Date;
};

export type PricingValidationResult = {
  missingFields: PricingReasonCode[];
  productAgeDays: number;
  competitorDataAvailable: boolean;
  competitorDataFresh: boolean;
  competitorDataReliable: boolean;
  lowData: boolean;
};

export type PricingCalculationResult = {
  reasonCodes: PricingReasonCode[];
  explanation: string;
  confidenceScore: number;
  reviewRequired: boolean;
  blocked: boolean;
  currentPriceCents: number;
  baseLandedCostCents: number | null;
  hardMinimumPriceCents: number | null;
  marketTargetPriceCents: number;
  recommendedTargetPriceCents: number;
  publishablePriceCents: number;
  recommendedCompareAtCents: number | null;
  publishableCompareAtCents: number | null;
  compareAtSource: "public" | "market_high" | "market_average" | null;
  priceDeltaBasisPoints: number;
  stockCoverDays: number | null;
  inventoryAdjustmentBasisPoints: number;
  validation: PricingValidationResult;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const roundToInt = (value: number) => Math.round(value);

const safeRatio = (basisPoints: number) => Math.max(0, basisPoints) / 10_000;

const isPublicCustomerPriceSource = (sourceLabel?: string | null) => {
  if (!sourceLabel) return false;
  const normalized = sourceLabel.trim().toLowerCase();
  return (
    normalized.includes("public") ||
    normalized.includes("guest") ||
    normalized.includes("customer")
  );
};

const isMeaningfullyHigherThanPrice = (
  candidateCents: number | null,
  priceCents: number,
  config: PricingAutomationConfig
) => {
  if (typeof candidateCents !== "number" || candidateCents <= priceCents) {
    return false;
  }

  const minimumDeltaCents = Math.max(
    config.compareAtMinDeltaCents,
    Math.ceil(priceCents * safeRatio(config.compareAtMinLiftBasisPoints))
  );

  return candidateCents - priceCents >= minimumDeltaCents;
};

const buildPriceEndingCandidates = (targetCents: number, endingCents: number) => {
  const euroFloor = Math.floor(Math.max(0, targetCents) / 100);
  const candidates = new Set<number>();
  for (let euro = Math.max(0, euroFloor - 2); euro <= euroFloor + 3; euro += 1) {
    candidates.add(euro * 100 + endingCents);
  }
  return Array.from(candidates).sort((left, right) => left - right);
};

export const roundToPsychologicalEnding = (
  targetCents: number,
  endingCents: number,
  minimumCents: number
) => {
  const candidates = buildPriceEndingCandidates(targetCents, endingCents).filter(
    (candidate) => candidate >= minimumCents
  );

  if (candidates.length === 0) {
    const nextEuro = Math.ceil(minimumCents / 100);
    return nextEuro * 100 + endingCents >= minimumCents
      ? nextEuro * 100 + endingCents
      : (nextEuro + 1) * 100 + endingCents;
  }

  return candidates.reduce((best, candidate) => {
    const bestDistance = Math.abs(best - targetCents);
    const candidateDistance = Math.abs(candidate - targetCents);
    if (candidateDistance < bestDistance) return candidate;
    if (candidateDistance === bestDistance && candidate < best) return candidate;
    return best;
  });
};

export const calculateBaseLandedCostCents = (input: PricingCalculationInput) => {
  if (
    input.baseCostCents === null ||
    input.supplierShippingCostCents === null ||
    input.inboundShippingCostCents === null ||
    input.packagingCostCents === null ||
    input.handlingCostCents === null
  ) {
    return null;
  }

  return (
    input.baseCostCents +
    input.supplierShippingCostCents +
    input.inboundShippingCostCents +
    input.packagingCostCents +
    input.handlingCostCents
  );
};

export const calculateHardMinimumPriceCents = (
  landedCostCents: number,
  input: PricingCalculationInput
) => {
  const variableRate =
    safeRatio(input.paymentFeePercentBasisPoints) +
    safeRatio(input.returnRiskBufferBasisPoints) +
    safeRatio(input.targetMarginBasisPoints);
  const denominator = 1 - variableRate;
  if (denominator <= 0) {
    throw new Error("Pricing automation rates exceed or equal 100%.");
  }

  return Math.ceil((landedCostCents + input.paymentFixedFeeCents) / denominator);
};

export const validatePricingInput = (
  input: PricingCalculationInput,
  config: PricingAutomationConfig
): PricingValidationResult => {
  const missingFields: PricingReasonCode[] = [];

  if (input.baseCostCents === null || input.baseCostCents <= 0) {
    missingFields.push(PRICING_REASON_CODES.missingBaseCost);
  }
  if (input.supplierShippingCostCents === null) {
    missingFields.push(PRICING_REASON_CODES.missingSupplierShippingCost);
  }
  if (input.inboundShippingCostCents === null) {
    missingFields.push(PRICING_REASON_CODES.missingInboundShippingCost);
  }
  if (input.packagingCostCents === null) {
    missingFields.push(PRICING_REASON_CODES.missingPackagingCost);
  }
  if (input.handlingCostCents === null) {
    missingFields.push(PRICING_REASON_CODES.missingHandlingCost);
  }

  const productAgeMs = input.now.getTime() - input.productCreatedAt.getTime();
  const productAgeDays = Math.floor(productAgeMs / (24 * 60 * 60 * 1000));
  const lowData =
    input.recentViews < config.lowDataMinViews ||
    input.recentUnitsSold < config.lowDataMinUnitsSold;

  const competitorDataAvailable =
    typeof input.competitorMinPriceCents === "number" ||
    typeof input.competitorAveragePriceCents === "number";
  const competitorAgeHours =
    input.competitorObservedAt instanceof Date
      ? (input.now.getTime() - input.competitorObservedAt.getTime()) /
        (60 * 60 * 1000)
      : Number.POSITIVE_INFINITY;
  const competitorDataFresh =
    competitorDataAvailable && competitorAgeHours <= config.competitorMaxAgeHours;
  const competitorDataReliable =
    !competitorDataAvailable ||
    (input.competitorReliabilityScore ?? 0) >=
      config.competitorMinReliabilityScore;

  return {
    missingFields,
    productAgeDays,
    competitorDataAvailable,
    competitorDataFresh,
    competitorDataReliable,
    lowData,
  };
};

const calculateMarketReferencePriceCents = (
  input: PricingCalculationInput,
  hardMinimumPriceCents: number,
  config: PricingAutomationConfig,
  reasonCodes: PricingReasonCode[]
) => {
  const segmentConfig = config.segmentConfigs[input.productSegment];
  const competitorCandidates = [
    typeof input.competitorMinPriceCents === "number"
      ? {
          cents: input.competitorMinPriceCents,
          weight: segmentConfig.competitorMinWeightBasisPoints,
        }
      : null,
    typeof input.competitorAveragePriceCents === "number"
      ? {
          cents: input.competitorAveragePriceCents,
          weight: segmentConfig.competitorAverageWeightBasisPoints,
        }
      : null,
  ].filter(Boolean) as Array<{ cents: number; weight: number }>;

  if (competitorCandidates.length === 0) {
    reasonCodes.push(PRICING_REASON_CODES.marketFallbackToCurrent);
    return Math.max(hardMinimumPriceCents, input.currentPriceCents);
  }

  const weightedTotal = competitorCandidates.reduce(
    (sum, candidate) => sum + candidate.cents * candidate.weight,
    0
  );
  const totalWeight = competitorCandidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0
  );
  const marketReference =
    totalWeight > 0 ? weightedTotal / totalWeight : input.currentPriceCents;
  const biasedMarketReference = roundToInt(
    marketReference * (1 + segmentConfig.marketBiasBasisPoints / 10_000)
  );
  const publicSoftCapCents =
    isPublicCustomerPriceSource(input.competitorSourceLabel) &&
    typeof input.competitorAveragePriceCents === "number"
      ? input.competitorAveragePriceCents
      : null;
  const softCappedMarketReference =
    typeof publicSoftCapCents === "number"
      ? Math.min(biasedMarketReference, publicSoftCapCents)
      : biasedMarketReference;
  if (
    typeof publicSoftCapCents === "number" &&
    softCappedMarketReference !== biasedMarketReference
  ) {
    reasonCodes.push(PRICING_REASON_CODES.sellerSoftCapApplied);
  }
  const marketWeight = clamp(
    isPublicCustomerPriceSource(input.competitorSourceLabel)
      ? Math.max(
          segmentConfig.marketWeightBasisPoints,
          config.publicCompetitorMarketWeightFloorBasisPoints
        )
      : segmentConfig.marketWeightBasisPoints,
    0,
    10_000
  );
  const blendedTarget = roundToInt(
    (hardMinimumPriceCents * (10_000 - marketWeight) +
      softCappedMarketReference * marketWeight) /
      10_000
  );
  reasonCodes.push(PRICING_REASON_CODES.competitorAwareTarget);
  const marketTarget = Math.max(hardMinimumPriceCents, blendedTarget);
  if (
    typeof publicSoftCapCents === "number" &&
    marketTarget > publicSoftCapCents
  ) {
    reasonCodes.push(PRICING_REASON_CODES.sellerSoftCapExceededByFloor);
  }
  return marketTarget;
};

const calculateCompareAtRecommendation = (
  input: PricingCalculationInput,
  publishablePriceCents: number,
  config: PricingAutomationConfig,
  validation: PricingValidationResult,
  reasonCodes: PricingReasonCode[]
) => {
  const canUseMarketData =
    validation.competitorDataAvailable &&
    validation.competitorDataFresh &&
    validation.competitorDataReliable;

  if (
    isMeaningfullyHigherThanPrice(
      input.publicCompareAtCents,
      publishablePriceCents,
      config
    )
  ) {
    reasonCodes.push(PRICING_REASON_CODES.compareAtFromPublicListPrice);
    return {
      compareAtCents: input.publicCompareAtCents,
      source: "public" as const,
    };
  }

  if (
    canUseMarketData &&
    isMeaningfullyHigherThanPrice(
      input.competitorHighPriceCents,
      publishablePriceCents,
      config
    )
  ) {
    reasonCodes.push(PRICING_REASON_CODES.compareAtFromMarketHigh);
    return {
      compareAtCents: input.competitorHighPriceCents,
      source: "market_high" as const,
    };
  }

  if (
    canUseMarketData &&
    isMeaningfullyHigherThanPrice(
      input.competitorAveragePriceCents,
      publishablePriceCents,
      config
    )
  ) {
    reasonCodes.push(PRICING_REASON_CODES.compareAtFromMarketAverage);
    return {
      compareAtCents: input.competitorAveragePriceCents,
      source: "market_average" as const,
    };
  }

  if (input.currentCompareAtCents !== null) {
    reasonCodes.push(PRICING_REASON_CODES.compareAtCleared);
  }

  return {
    compareAtCents: null,
    source: null,
  };
};

const calculateInventoryAdjustmentBasisPoints = (
  input: PricingCalculationInput,
  config: PricingAutomationConfig,
  stockCoverDays: number | null,
  reasonCodes: PricingReasonCode[]
) => {
  const segmentConfig = config.segmentConfigs[input.productSegment];
  const hasWeakDemand =
    input.recentConversionRate <= config.weakConversionRate &&
    input.recentSalesVelocity <= config.weakSalesVelocityPerDay;
  const hasStrongDemand =
    input.recentConversionRate >= config.strongConversionRate ||
    input.recentSalesVelocity >= config.strongSalesVelocityPerDay;

  if (
    stockCoverDays !== null &&
    stockCoverDays >= config.highStockCoverDays &&
    hasWeakDemand
  ) {
    reasonCodes.push(PRICING_REASON_CODES.inventoryPressureDown);
    return -Math.max(0, segmentConfig.inventoryDownshiftBasisPoints);
  }

  if (
    stockCoverDays !== null &&
    stockCoverDays <= config.lowStockCoverDays &&
    hasStrongDemand
  ) {
    reasonCodes.push(PRICING_REASON_CODES.inventoryPressureUp);
    return Math.max(0, segmentConfig.inventoryUpshiftBasisPoints);
  }

  return 0;
};

const buildExplanation = (
  input: PricingCalculationInput,
  result: PricingCalculationResult
) => {
  const parts = [
    `Segment ${input.productSegment.toLowerCase()} with ${result.reasonCodes.join(", ")}.`,
  ];

  if (result.hardMinimumPriceCents !== null) {
    parts.push(
      `Hard floor ${(result.hardMinimumPriceCents / 100).toFixed(2)} EUR built from landed cost and protected margin.`
    );
  } else {
    parts.push("Hard floor unavailable because required cost inputs are incomplete.");
  }

  if (result.inventoryAdjustmentBasisPoints !== 0) {
    parts.push(
      `Inventory adjustment ${(result.inventoryAdjustmentBasisPoints / 100).toFixed(2)}% applied from stock cover and demand.`
    );
  }

  if (result.compareAtSource === "public") {
    parts.push("Compare-at uses the public seller list price.");
  } else if (result.compareAtSource === "market_high") {
    parts.push("Compare-at falls back to conservative market high pricing.");
  } else if (result.compareAtSource === "market_average") {
    parts.push("Compare-at falls back to market average because no public list price was available.");
  }

  parts.push(
    `Publishable recommendation ${(result.publishablePriceCents / 100).toFixed(2)} EUR from current ${(result.currentPriceCents / 100).toFixed(2)} EUR.`
  );

  return parts.join(" ");
};

export const calculatePricingRecommendation = (
  input: PricingCalculationInput,
  config: PricingAutomationConfig
): PricingCalculationResult => {
  const reasonCodes: PricingReasonCode[] = [];
  const validation = validatePricingInput(input, config);

  if (validation.missingFields.length > 0) {
    reasonCodes.push(...validation.missingFields);
  }
  if (!input.autoRepriceEnabled) {
    reasonCodes.push(PRICING_REASON_CODES.autoRepriceDisabled);
  }
  if (validation.productAgeDays < config.minProductAgeDays) {
    reasonCodes.push(PRICING_REASON_CODES.productTooNew);
  }
  if (validation.lowData) {
    reasonCodes.push(PRICING_REASON_CODES.lowData);
  }
  if (!validation.competitorDataAvailable) {
    reasonCodes.push(PRICING_REASON_CODES.competitorMissing);
  }
  if (validation.competitorDataAvailable && !validation.competitorDataFresh) {
    reasonCodes.push(PRICING_REASON_CODES.competitorStale);
  }
  if (!validation.competitorDataReliable) {
    reasonCodes.push(PRICING_REASON_CODES.competitorUnreliable);
  }

  const baseLandedCostCents = calculateBaseLandedCostCents(input);
  const stockOnHand = Math.max(0, input.stockOnHand - input.reservedUnits);
  const stockCoverDays =
    input.recentSalesVelocity > 0 ? stockOnHand / input.recentSalesVelocity : null;
  const blocked =
    validation.missingFields.length > 0 || !input.autoRepriceEnabled;

  let hardMinimumPriceCents: number | null = null;
  let marketTargetPriceCents = Math.max(0, input.currentPriceCents);
  let recommendedTargetPriceCents = marketTargetPriceCents;
  let publishablePriceCents = marketTargetPriceCents;
  let recommendedCompareAtCents: number | null = null;
  let publishableCompareAtCents: number | null = null;
  let compareAtSource: "public" | "market_high" | "market_average" | null = null;
  let inventoryAdjustmentBasisPoints = 0;

  if (baseLandedCostCents !== null) {
    hardMinimumPriceCents = calculateHardMinimumPriceCents(baseLandedCostCents, input);
    marketTargetPriceCents =
      validation.competitorDataAvailable &&
      validation.competitorDataFresh &&
      validation.competitorDataReliable
        ? calculateMarketReferencePriceCents(
            input,
            hardMinimumPriceCents,
            config,
            reasonCodes
          )
        : Math.max(hardMinimumPriceCents, input.currentPriceCents);

    if (
      validation.competitorDataAvailable &&
      (!validation.competitorDataFresh || !validation.competitorDataReliable)
    ) {
      reasonCodes.push(PRICING_REASON_CODES.marketFallbackToCurrent);
    }

    inventoryAdjustmentBasisPoints = calculateInventoryAdjustmentBasisPoints(
      input,
      config,
      stockCoverDays,
      reasonCodes
    );
    const adjustedTarget = Math.max(
      hardMinimumPriceCents,
      roundToInt(
        marketTargetPriceCents * (1 + inventoryAdjustmentBasisPoints / 10_000)
      )
    );
    recommendedTargetPriceCents = adjustedTarget;
    publishablePriceCents = roundToPsychologicalEnding(
      adjustedTarget,
      config.segmentConfigs[input.productSegment].priceEndingCents,
      hardMinimumPriceCents
    );
    if (publishablePriceCents !== adjustedTarget) {
      reasonCodes.push(PRICING_REASON_CODES.roundedToPsychologicalEnding);
    }
    if (publishablePriceCents < hardMinimumPriceCents) {
      publishablePriceCents = hardMinimumPriceCents;
      reasonCodes.push(PRICING_REASON_CODES.floorPriceProtection);
    }

    const compareAtRecommendation = calculateCompareAtRecommendation(
      input,
      publishablePriceCents,
      config,
      validation,
      reasonCodes
    );
    recommendedCompareAtCents = compareAtRecommendation.compareAtCents;
    publishableCompareAtCents = compareAtRecommendation.compareAtCents;
    compareAtSource = compareAtRecommendation.source;
  }

  const priceDeltaBasisPoints =
    input.currentPriceCents > 0
      ? roundToInt(
          ((publishablePriceCents - input.currentPriceCents) / input.currentPriceCents) *
            10_000
        )
      : 0;

  const reviewRequired =
    !blocked &&
    (validation.productAgeDays < config.minProductAgeDays ||
      validation.lowData ||
      (validation.competitorDataAvailable &&
        (!validation.competitorDataFresh || !validation.competitorDataReliable)) ||
      priceDeltaBasisPoints > config.higherPriceReviewThresholdBasisPoints);

  if (priceDeltaBasisPoints > config.higherPriceReviewThresholdBasisPoints) {
    reasonCodes.push(PRICING_REASON_CODES.guardrailHigherPriceReviewExceeded);
  }

  const confidenceBase =
    0.3 +
    (validation.competitorDataAvailable &&
    validation.competitorDataFresh &&
    validation.competitorDataReliable
      ? 0.2
      : 0) +
    (!validation.lowData ? 0.2 : -0.1) +
    (stockCoverDays !== null ? 0.1 : 0) +
    (!blocked ? 0.15 : -0.2) +
    (validation.productAgeDays >= config.minProductAgeDays ? 0.05 : -0.1);

  const result: PricingCalculationResult = {
    reasonCodes: Array.from(new Set(reasonCodes)),
    explanation: "",
    confidenceScore: clamp(Number(confidenceBase.toFixed(2)), 0, 1),
    reviewRequired,
    blocked,
    currentPriceCents: input.currentPriceCents,
    baseLandedCostCents,
    hardMinimumPriceCents,
    marketTargetPriceCents,
    recommendedTargetPriceCents,
    publishablePriceCents,
    recommendedCompareAtCents,
    publishableCompareAtCents,
    compareAtSource,
    priceDeltaBasisPoints,
    stockCoverDays,
    inventoryAdjustmentBasisPoints,
    validation,
  };

  result.explanation = buildExplanation(input, result);
  return result;
};
