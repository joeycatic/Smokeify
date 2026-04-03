import type { PricingProductSegment } from "@prisma/client";

export type PricingAutomationSegmentConfig = {
  marketWeightBasisPoints: number;
  competitorMinWeightBasisPoints: number;
  competitorAverageWeightBasisPoints: number;
  marketBiasBasisPoints: number;
  inventoryDownshiftBasisPoints: number;
  inventoryUpshiftBasisPoints: number;
  priceEndingCents: number;
};

export type PricingAutomationConfig = {
  enabled: boolean;
  currency: string;
  recommendationWindowDays: number;
  maxAutoPriceMoveBasisPoints: number;
  minProductAgeDays: number;
  competitorMaxAgeHours: number;
  competitorMinReliabilityScore: number;
  lowDataMinViews: number;
  lowDataMinUnitsSold: number;
  weakConversionRate: number;
  strongConversionRate: number;
  weakSalesVelocityPerDay: number;
  strongSalesVelocityPerDay: number;
  highStockCoverDays: number;
  lowStockCoverDays: number;
  defaultPaymentFeePercentBasisPoints: number;
  defaultPaymentFixedFeeCents: number;
  defaultReturnRiskBufferBasisPoints: number;
  defaultTargetMarginBasisPoints: number;
  segmentConfigs: Record<PricingProductSegment, PricingAutomationSegmentConfig>;
};

const parseInteger = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parsePriceEnding = (value: string | undefined, fallback: number) => {
  const parsed = parseInteger(value, fallback);
  if (parsed < 0 || parsed > 99) return fallback;
  return parsed;
};

const segmentConfig = (
  env: NodeJS.ProcessEnv,
  segment: PricingProductSegment,
  defaults: PricingAutomationSegmentConfig
): PricingAutomationSegmentConfig => {
  const prefix = `PRICING_AUTOMATION_${segment}`;
  return {
    marketWeightBasisPoints: parseInteger(
      env[`${prefix}_MARKET_WEIGHT_BPS`],
      defaults.marketWeightBasisPoints
    ),
    competitorMinWeightBasisPoints: parseInteger(
      env[`${prefix}_COMPETITOR_MIN_WEIGHT_BPS`],
      defaults.competitorMinWeightBasisPoints
    ),
    competitorAverageWeightBasisPoints: parseInteger(
      env[`${prefix}_COMPETITOR_AVERAGE_WEIGHT_BPS`],
      defaults.competitorAverageWeightBasisPoints
    ),
    marketBiasBasisPoints: parseInteger(
      env[`${prefix}_MARKET_BIAS_BPS`],
      defaults.marketBiasBasisPoints
    ),
    inventoryDownshiftBasisPoints: parseInteger(
      env[`${prefix}_INVENTORY_DOWNSHIFT_BPS`],
      defaults.inventoryDownshiftBasisPoints
    ),
    inventoryUpshiftBasisPoints: parseInteger(
      env[`${prefix}_INVENTORY_UPSHIFT_BPS`],
      defaults.inventoryUpshiftBasisPoints
    ),
    priceEndingCents: parsePriceEnding(
      env[`${prefix}_PRICE_ENDING_CENTS`],
      defaults.priceEndingCents
    ),
  };
};

export const getPricingAutomationConfig = (
  env: NodeJS.ProcessEnv = process.env
): PricingAutomationConfig => {
  const defaultSegments: Record<
    PricingProductSegment,
    PricingAutomationSegmentConfig
  > = {
    TRAFFIC_DRIVER: {
      marketWeightBasisPoints: 7_000,
      competitorMinWeightBasisPoints: 6_500,
      competitorAverageWeightBasisPoints: 3_500,
      marketBiasBasisPoints: -150,
      inventoryDownshiftBasisPoints: 250,
      inventoryUpshiftBasisPoints: 100,
      priceEndingCents: 90,
    },
    CORE: {
      marketWeightBasisPoints: 5_500,
      competitorMinWeightBasisPoints: 4_000,
      competitorAverageWeightBasisPoints: 6_000,
      marketBiasBasisPoints: 0,
      inventoryDownshiftBasisPoints: 200,
      inventoryUpshiftBasisPoints: 150,
      priceEndingCents: 95,
    },
    PREMIUM: {
      marketWeightBasisPoints: 3_000,
      competitorMinWeightBasisPoints: 1_500,
      competitorAverageWeightBasisPoints: 8_500,
      marketBiasBasisPoints: 350,
      inventoryDownshiftBasisPoints: 100,
      inventoryUpshiftBasisPoints: 250,
      priceEndingCents: 99,
    },
    CLEARANCE: {
      marketWeightBasisPoints: 8_000,
      competitorMinWeightBasisPoints: 7_000,
      competitorAverageWeightBasisPoints: 3_000,
      marketBiasBasisPoints: -500,
      inventoryDownshiftBasisPoints: 400,
      inventoryUpshiftBasisPoints: 0,
      priceEndingCents: 90,
    },
  };

  return {
    enabled: parseBoolean(env.PRICING_AUTOMATION_ENABLED, true),
    currency: env.PRICING_AUTOMATION_CURRENCY?.trim() || "EUR",
    recommendationWindowDays: parseInteger(
      env.PRICING_AUTOMATION_WINDOW_DAYS,
      30
    ),
    maxAutoPriceMoveBasisPoints: parseInteger(
      env.PRICING_AUTOMATION_MAX_AUTO_MOVE_BPS,
      500
    ),
    minProductAgeDays: parseInteger(
      env.PRICING_AUTOMATION_MIN_PRODUCT_AGE_DAYS,
      14
    ),
    competitorMaxAgeHours: parseInteger(
      env.PRICING_AUTOMATION_COMPETITOR_MAX_AGE_HOURS,
      72
    ),
    competitorMinReliabilityScore: parseFloatNumber(
      env.PRICING_AUTOMATION_COMPETITOR_MIN_RELIABILITY,
      0.6
    ),
    lowDataMinViews: parseInteger(
      env.PRICING_AUTOMATION_LOW_DATA_MIN_VIEWS,
      50
    ),
    lowDataMinUnitsSold: parseInteger(
      env.PRICING_AUTOMATION_LOW_DATA_MIN_UNITS_SOLD,
      2
    ),
    weakConversionRate: parseFloatNumber(
      env.PRICING_AUTOMATION_WEAK_CONVERSION_RATE,
      0.012
    ),
    strongConversionRate: parseFloatNumber(
      env.PRICING_AUTOMATION_STRONG_CONVERSION_RATE,
      0.035
    ),
    weakSalesVelocityPerDay: parseFloatNumber(
      env.PRICING_AUTOMATION_WEAK_SALES_VELOCITY,
      0.05
    ),
    strongSalesVelocityPerDay: parseFloatNumber(
      env.PRICING_AUTOMATION_STRONG_SALES_VELOCITY,
      0.35
    ),
    highStockCoverDays: parseFloatNumber(
      env.PRICING_AUTOMATION_HIGH_STOCK_COVER_DAYS,
      60
    ),
    lowStockCoverDays: parseFloatNumber(
      env.PRICING_AUTOMATION_LOW_STOCK_COVER_DAYS,
      14
    ),
    defaultPaymentFeePercentBasisPoints: parseInteger(
      env.PRICING_AUTOMATION_PAYMENT_FEE_PERCENT_BPS,
      150
    ),
    defaultPaymentFixedFeeCents: parseInteger(
      env.PRICING_AUTOMATION_PAYMENT_FIXED_FEE_CENTS,
      25
    ),
    defaultReturnRiskBufferBasisPoints: parseInteger(
      env.PRICING_AUTOMATION_RETURN_BUFFER_BPS,
      300
    ),
    defaultTargetMarginBasisPoints: parseInteger(
      env.PRICING_AUTOMATION_TARGET_MARGIN_BPS,
      2_500
    ),
    segmentConfigs: {
      TRAFFIC_DRIVER: segmentConfig(
        env,
        "TRAFFIC_DRIVER",
        defaultSegments.TRAFFIC_DRIVER
      ),
      CORE: segmentConfig(env, "CORE", defaultSegments.CORE),
      PREMIUM: segmentConfig(env, "PREMIUM", defaultSegments.PREMIUM),
      CLEARANCE: segmentConfig(env, "CLEARANCE", defaultSegments.CLEARANCE),
    },
  };
};
