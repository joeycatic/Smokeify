import { describe, expect, it } from "vitest";
import {
  calculateBaseLandedCostCents,
  calculateHardMinimumPriceCents,
  calculatePricingRecommendation,
  roundToPsychologicalEnding,
} from "@/lib/pricingAutomationEngine";
import { getPricingAutomationConfig } from "@/lib/pricingAutomationConfig";

const config = getPricingAutomationConfig({});

const buildInput = (
  overrides: Partial<Parameters<typeof calculatePricingRecommendation>[0]> = {}
) => ({
  variantId: "variant_1",
  productId: "product_1",
  sku: "SKU-1",
  title: "Test product / Default",
  currentPriceCents: 20_000,
  baseCostCents: 9_000,
  supplierShippingCostCents: 600,
  inboundShippingCostCents: 300,
  packagingCostCents: 120,
  handlingCostCents: 80,
  paymentFeePercentBasisPoints: 150,
  paymentFixedFeeCents: 25,
  returnRiskBufferBasisPoints: 300,
  targetMarginBasisPoints: 2_500,
  competitorMinPriceCents: 21_000,
  competitorAveragePriceCents: 22_000,
  competitorObservedAt: new Date("2026-04-01T10:00:00.000Z"),
  competitorReliabilityScore: 0.9,
  productSegment: "CORE" as const,
  autoRepriceEnabled: true,
  stockOnHand: 120,
  reservedUnits: 5,
  recentSalesVelocity: 0.02,
  recentConversionRate: 0.008,
  recentViews: 240,
  recentUnitsSold: 8,
  productCreatedAt: new Date("2026-02-15T10:00:00.000Z"),
  now: new Date("2026-04-03T10:00:00.000Z"),
  ...overrides,
});

describe("pricingAutomationEngine", () => {
  it("calculates landed cost from all required cost inputs", () => {
    const input = buildInput();
    expect(calculateBaseLandedCostCents(input)).toBe(10_100);
  });

  it("builds a hard minimum floor that includes fixed fees and protected margin", () => {
    const input = buildInput();
    const landedCost = calculateBaseLandedCostCents(input);
    expect(landedCost).not.toBeNull();
    expect(calculateHardMinimumPriceCents(landedCost!, input)).toBe(14_362);
  });

  it("never publishes below the hard minimum even when competitor prices are lower", () => {
    const result = calculatePricingRecommendation(
      buildInput({
        competitorMinPriceCents: 9_999,
        competitorAveragePriceCents: 10_500,
        currentPriceCents: 18_000,
      }),
      config
    );

    expect(result.hardMinimumPriceCents).toBe(14_362);
    expect(result.publishablePriceCents).toBeGreaterThanOrEqual(14_362);
  });

  it("applies downward inventory pressure for high stock and weak demand", () => {
    const result = calculatePricingRecommendation(buildInput(), config);
    expect(result.inventoryAdjustmentBasisPoints).toBe(-200);
    expect(result.reasonCodes).toContain("inventory_pressure_down");
  });

  it("applies upward inventory pressure for low stock and strong demand", () => {
    const result = calculatePricingRecommendation(
      buildInput({
        stockOnHand: 4,
        reservedUnits: 0,
        recentSalesVelocity: 0.7,
        recentConversionRate: 0.06,
        recentViews: 180,
        recentUnitsSold: 36,
      }),
      config
    );

    expect(result.inventoryAdjustmentBasisPoints).toBe(150);
    expect(result.reasonCodes).toContain("inventory_pressure_up");
    expect(result.publishablePriceCents).toBeGreaterThan(result.marketTargetPriceCents);
  });

  it("routes low-data products to review instead of aggressive autopricing", () => {
    const result = calculatePricingRecommendation(
      buildInput({
        recentViews: 12,
        recentUnitsSold: 1,
      }),
      config
    );

    expect(result.reviewRequired).toBe(true);
    expect(result.reasonCodes).toContain("low_data");
  });

  it("routes stale competitor data to review and falls back from market targeting", () => {
    const result = calculatePricingRecommendation(
      buildInput({
        competitorObservedAt: new Date("2026-03-20T10:00:00.000Z"),
      }),
      config
    );

    expect(result.reviewRequired).toBe(true);
    expect(result.reasonCodes).toContain("competitor_stale");
    expect(result.reasonCodes).toContain("market_fallback_to_current_price");
  });

  it("blocks autonomous repricing when required cost data is missing", () => {
    const result = calculatePricingRecommendation(
      buildInput({
        packagingCostCents: null,
      }),
      config
    );

    expect(result.blocked).toBe(true);
    expect(result.hardMinimumPriceCents).toBeNull();
    expect(result.reasonCodes).toContain("missing_packaging_cost");
  });

  it("marks oversized automatic price moves for review", () => {
    const result = calculatePricingRecommendation(
      buildInput({
        currentPriceCents: 14_000,
        competitorMinPriceCents: 24_000,
        competitorAveragePriceCents: 26_000,
        stockOnHand: 2,
        recentSalesVelocity: 1.2,
        recentConversionRate: 0.08,
        recentUnitsSold: 24,
      }),
      config
    );

    expect(Math.abs(result.priceDeltaBasisPoints)).toBeGreaterThan(
      config.maxAutoPriceMoveBasisPoints
    );
    expect(result.reviewRequired).toBe(true);
    expect(result.reasonCodes).toContain("guardrail_max_auto_move_exceeded");
  });

  it("rounds to the configured psychological ending without dropping below the minimum", () => {
    expect(roundToPsychologicalEnding(15_642, 95, 14_483)).toBe(15_595);
    expect(roundToPsychologicalEnding(14_490, 90, 14_483)).toBe(14_490);
  });
});
