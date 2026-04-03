import { describe, expect, it } from "vitest";
import {
  extractVariantPricingProfilesFromProductPayload,
  normalizePricingOverview,
  normalizePricingProfile,
} from "@/lib/adminPricingIntegration";

describe("normalizePricingProfile", () => {
  it("fills safe defaults for sparse upstream payloads", () => {
    expect(normalizePricingProfile({})).toEqual({
      supplierShippingCostCents: null,
      inboundShippingCostCents: null,
      packagingCostCents: null,
      handlingCostCents: null,
      paymentFeePercentBasisPoints: null,
      paymentFixedFeeCents: null,
      returnRiskBufferBasisPoints: null,
      targetMarginBasisPoints: null,
      competitorMinPriceCents: null,
      competitorAveragePriceCents: null,
      competitorObservedAt: null,
      competitorSourceLabel: null,
      competitorSourceCount: null,
      competitorReliabilityScore: null,
      productSegment: "CORE",
      autoRepriceEnabled: true,
    });
  });
});

describe("normalizePricingOverview", () => {
  it("normalizes review queue, lifecycle dates, and latest run summary", () => {
    const snapshot = normalizePricingOverview({
      latestRun: {
        id: "run_1",
        status: "COMPLETED",
        mode: "PREVIEW",
        startedAt: "2026-04-02T10:00:00.000Z",
        finishedAt: "2026-04-02T10:10:00.000Z",
        summary: {
          enabled: true,
          mode: "PREVIEW",
          processed: 12,
          applied: 0,
          review: 5,
          blocked: 7,
        },
      },
      reviewQueue: [
        {
          id: "rec_1",
          status: "PENDING_REVIEW",
          confidenceScore: 0.82,
          reviewRequired: true,
          reasonCodes: ["competitor_aware_target", "floor_price_protection"],
          explanation: "Margin floor kept the recommendation conservative.",
          currentPriceCents: 1999,
          hardMinimumPriceCents: 1899,
          recommendedTargetPriceCents: 2099,
          publishablePriceCents: 2099,
          priceDeltaBasisPoints: 500,
          createdAt: "2026-04-02T10:05:00.000Z",
          product: {
            id: "prod_1",
            title: "Smokeify Grinder",
            handle: "smokeify-grinder",
          },
          variant: {
            id: "var_1",
            title: "Black",
            sku: "GRINDER-BLK",
          },
          run: {
            id: "run_1",
            mode: "PREVIEW",
            startedAt: "2026-04-02T10:00:00.000Z",
          },
        },
      ],
      recentRecommendations: [
        {
          id: "rec_2",
          status: "APPLIED",
          confidenceScore: 0.91,
          reviewRequired: false,
          reasonCodes: ["inventory_pressure_up"],
          explanation: "Low stock justified a measured increase.",
          currentPriceCents: 2499,
          hardMinimumPriceCents: 2199,
          recommendedTargetPriceCents: 2599,
          publishablePriceCents: 2599,
          priceDeltaBasisPoints: 400,
          createdAt: "2026-04-02T10:06:00.000Z",
          reviewedAt: "2026-04-02T10:07:00.000Z",
          appliedAt: "2026-04-02T10:08:00.000Z",
          product: {
            id: "prod_2",
            title: "Grow Light",
            handle: "grow-light",
          },
          variant: {
            id: "var_2",
            title: "240W",
            sku: "LIGHT-240",
          },
          run: {
            id: "run_1",
            mode: "PREVIEW",
            startedAt: "2026-04-02T10:00:00.000Z",
          },
        },
      ],
      recentChanges: [
        {
          id: "chg_1",
          source: "AUTOMATION",
          oldPriceCents: 2499,
          newPriceCents: 2599,
          hardMinimumPriceCents: 2199,
          reasonCodes: ["inventory_pressure_up"],
          createdAt: "2026-04-02T10:08:00.000Z",
          product: {
            id: "prod_2",
            title: "Grow Light",
            handle: "grow-light",
          },
          variant: {
            id: "var_2",
            title: "240W",
            sku: "LIGHT-240",
          },
          actor: {
            id: "user_1",
            email: "ops@example.com",
          },
        },
      ],
    });

    expect(snapshot.latestRun?.summary?.blocked).toBe(7);
    expect(snapshot.reviewQueue[0]?.status).toBe("PENDING_REVIEW");
    expect(snapshot.recentRecommendations[0]?.appliedAt).toBe(
      "2026-04-02T10:08:00.000Z"
    );
    expect(snapshot.recentChanges[0]?.actor?.email).toBe("ops@example.com");
  });
});

describe("extractVariantPricingProfilesFromProductPayload", () => {
  it("maps Growvault product variants into pricing records keyed by variant id", () => {
    const profiles = extractVariantPricingProfilesFromProductPayload({
      product: {
        variants: [
          {
            id: "var_1",
            title: "Default",
            sku: "SKU-1",
            updatedAt: "2026-04-03T09:00:00.000Z",
            pricingProfile: {
              supplierShippingCostCents: 120,
              inboundShippingCostCents: 80,
              packagingCostCents: 40,
              handlingCostCents: 20,
              paymentFeePercentBasisPoints: 150,
              paymentFixedFeeCents: 25,
              returnRiskBufferBasisPoints: 200,
              targetMarginBasisPoints: 3200,
              competitorMinPriceCents: 1599,
              competitorAveragePriceCents: 1699,
              competitorObservedAt: "2026-04-02T08:00:00.000Z",
              competitorSourceLabel: "Idealo",
              competitorSourceCount: 4,
              competitorReliabilityScore: 0.88,
              productSegment: "PREMIUM",
              autoRepriceEnabled: false,
            },
          },
        ],
      },
    });

    expect(profiles.var_1).toEqual({
      variantId: "var_1",
      variantTitle: "Default",
      sku: "SKU-1",
      variantUpdatedAt: "2026-04-03T09:00:00.000Z",
      pricingProfile: {
        supplierShippingCostCents: 120,
        inboundShippingCostCents: 80,
        packagingCostCents: 40,
        handlingCostCents: 20,
        paymentFeePercentBasisPoints: 150,
        paymentFixedFeeCents: 25,
        returnRiskBufferBasisPoints: 200,
        targetMarginBasisPoints: 3200,
        competitorMinPriceCents: 1599,
        competitorAveragePriceCents: 1699,
        competitorObservedAt: "2026-04-02T08:00:00.000Z",
        competitorSourceLabel: "Idealo",
        competitorSourceCount: 4,
        competitorReliabilityScore: 0.88,
        productSegment: "PREMIUM",
        autoRepriceEnabled: false,
      },
    });
  });
});
