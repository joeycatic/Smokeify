import "server-only";

import {
  Prisma,
  PricingRunStatus,
  type PricingRecommendationStatus,
  type PrismaClient,
} from "@prisma/client";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  calculatePricingRecommendation,
  type PricingCalculationInput,
  type PricingCalculationResult,
} from "@/lib/pricingAutomationEngine";
import { getPricingAutomationConfig } from "@/lib/pricingAutomationConfig";
import {
  DEFAULT_MARKET_REPORT_PATH,
  importMarketReportCompetitorData,
  refreshBloomtechPublicCompetitorData,
} from "@/lib/pricingCompetitorSync";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id?: string | null;
  email?: string | null;
};

type RunPricingAutomationOptions = {
  prismaClient?: PrismaClient;
  mode?: "PREVIEW" | "APPLY";
  actor?: AdminActor | null;
  limit?: number;
  now?: Date;
  notes?: string | null;
  refreshPublicCompetitorData?: boolean;
  marketReportPath?: string | null;
};

type DemandSignals = {
  views: number;
  unitsSold: number;
  salesVelocity: number;
  conversionRate: number;
};

const VARIANT_PRICING_PROFILE_SELECT = {
  supplierShippingCostCents: true,
  inboundShippingCostCents: true,
  packagingCostCents: true,
  handlingCostCents: true,
  paymentFeePercentBasisPoints: true,
  paymentFixedFeeCents: true,
  returnRiskBufferBasisPoints: true,
  targetMarginBasisPoints: true,
  competitorMinPriceCents: true,
  competitorAveragePriceCents: true,
  competitorHighPriceCents: true,
  publicCompareAtCents: true,
  competitorObservedAt: true,
  competitorSourceLabel: true,
  competitorReliabilityScore: true,
  productSegment: true,
  autoRepriceEnabled: true,
} satisfies Prisma.VariantPricingProfileSelect;

const getDateDaysAgo = (now: Date, daysAgo: number) => {
  const value = new Date(now);
  value.setDate(value.getDate() - daysAgo);
  value.setHours(0, 0, 0, 0);
  return value;
};

const buildVariantDemandMap = async (
  db: PrismaClient,
  variantIds: string[],
  since: Date,
  windowDays: number
) => {
  if (variantIds.length === 0) {
    return new Map<string, DemandSignals>();
  }

  const [viewGroups, salesGroups] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["variantId"],
      where: {
        createdAt: { gte: since },
        eventName: "view_item",
        variantId: { in: variantIds },
      },
      _count: { _all: true },
    }),
    db.orderItem.groupBy({
      by: ["variantId"],
      where: {
        variantId: { in: variantIds },
        order: {
          createdAt: { gte: since },
          paymentStatus: { in: ["paid", "succeeded", "refunded", "partially_refunded"] },
        },
      },
      _sum: { quantity: true },
    }),
  ]);

  const map = new Map<string, DemandSignals>();

  for (const group of viewGroups) {
    if (!group.variantId) continue;
    map.set(group.variantId, {
      views: group._count._all,
      unitsSold: 0,
      salesVelocity: 0,
      conversionRate: 0,
    });
  }

  for (const group of salesGroups) {
    if (!group.variantId) continue;
    const current = map.get(group.variantId) ?? {
      views: 0,
      unitsSold: 0,
      salesVelocity: 0,
      conversionRate: 0,
    };
    const unitsSold = group._sum.quantity ?? 0;
    current.unitsSold = unitsSold;
    current.salesVelocity = unitsSold > 0 ? unitsSold / windowDays : 0;
    current.conversionRate = current.views > 0 ? unitsSold / current.views : 0;
    map.set(group.variantId, current);
  }

  for (const [variantId, current] of map.entries()) {
    map.set(variantId, {
      ...current,
      salesVelocity: current.unitsSold > 0 ? current.unitsSold / windowDays : 0,
      conversionRate: current.views > 0 ? current.unitsSold / current.views : 0,
    });
  }

  return map;
};

const toInputJsonValue = (
  value: Prisma.JsonValue
): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
};

const serializeInputSnapshot = (
  input: PricingCalculationInput,
  config: ReturnType<typeof getPricingAutomationConfig>
) => ({
  variantId: input.variantId,
  productId: input.productId,
  sku: input.sku,
  title: input.title,
  currentPriceCents: input.currentPriceCents,
  currentCompareAtCents: input.currentCompareAtCents,
  baseCostCents: input.baseCostCents,
  supplierShippingCostCents: input.supplierShippingCostCents,
  inboundShippingCostCents: input.inboundShippingCostCents,
  packagingCostCents: input.packagingCostCents,
  handlingCostCents: input.handlingCostCents,
  paymentFeePercentBasisPoints: input.paymentFeePercentBasisPoints,
  paymentFixedFeeCents: input.paymentFixedFeeCents,
  returnRiskBufferBasisPoints: input.returnRiskBufferBasisPoints,
  targetMarginBasisPoints: input.targetMarginBasisPoints,
  competitorMinPriceCents: input.competitorMinPriceCents,
  competitorAveragePriceCents: input.competitorAveragePriceCents,
  competitorHighPriceCents: input.competitorHighPriceCents,
  publicCompareAtCents: input.publicCompareAtCents,
  competitorObservedAt: input.competitorObservedAt?.toISOString() ?? null,
  competitorSourceLabel: input.competitorSourceLabel ?? null,
  competitorReliabilityScore: input.competitorReliabilityScore,
  productSegment: input.productSegment,
  autoRepriceEnabled: input.autoRepriceEnabled,
  stockOnHand: input.stockOnHand,
  reservedUnits: input.reservedUnits,
  recentSalesVelocity: input.recentSalesVelocity,
  recentConversionRate: input.recentConversionRate,
  recentViews: input.recentViews,
  recentUnitsSold: input.recentUnitsSold,
  productCreatedAt: input.productCreatedAt.toISOString(),
  config: {
    maxAutoPriceMoveBasisPoints: config.maxAutoPriceMoveBasisPoints,
    minProductAgeDays: config.minProductAgeDays,
    competitorMaxAgeHours: config.competitorMaxAgeHours,
    competitorMinReliabilityScore: config.competitorMinReliabilityScore,
    lowDataMinViews: config.lowDataMinViews,
    lowDataMinUnitsSold: config.lowDataMinUnitsSold,
    higherPriceReviewThresholdBasisPoints:
      config.higherPriceReviewThresholdBasisPoints,
    compareAtMinLiftBasisPoints: config.compareAtMinLiftBasisPoints,
    compareAtMinDeltaCents: config.compareAtMinDeltaCents,
    segmentConfig: config.segmentConfigs[input.productSegment],
  },
});

const serializeOutputSnapshot = (result: PricingCalculationResult) => ({
  baseLandedCostCents: result.baseLandedCostCents,
  hardMinimumPriceCents: result.hardMinimumPriceCents,
  marketTargetPriceCents: result.marketTargetPriceCents,
  recommendedTargetPriceCents: result.recommendedTargetPriceCents,
  publishablePriceCents: result.publishablePriceCents,
  recommendedCompareAtCents: result.recommendedCompareAtCents,
  publishableCompareAtCents: result.publishableCompareAtCents,
  compareAtSource: result.compareAtSource,
  stockCoverDays: result.stockCoverDays,
  inventoryAdjustmentBasisPoints: result.inventoryAdjustmentBasisPoints,
  confidenceScore: result.confidenceScore,
  validation: {
    ...result.validation,
  },
});

const buildRecommendationStatus = (
  mode: "PREVIEW" | "APPLY",
  result: PricingCalculationResult
): PricingRecommendationStatus => {
  if (mode === "PREVIEW") return "PREVIEW";
  if (result.blocked) return "BLOCKED";
  if (result.reviewRequired) return "PENDING_REVIEW";
  return "APPLIED";
};

export async function runPricingAutomation({
  prismaClient,
  mode = "APPLY",
  actor,
  limit,
  now = new Date(),
  notes,
  refreshPublicCompetitorData = true,
  marketReportPath,
}: RunPricingAutomationOptions = {}) {
  const db = prismaClient ?? prisma;
  const config = getPricingAutomationConfig();

  const runningRun = await db.pricingRun.findFirst({
    where: { status: PricingRunStatus.RUNNING },
    orderBy: { startedAt: "desc" },
  });
  if (runningRun) {
    throw new Error("A pricing run is already in progress.");
  }

  const run = await db.pricingRun.create({
    data: {
      mode,
      status: PricingRunStatus.RUNNING,
      triggeredById: actor?.id ?? null,
      notes: notes ?? null,
      startedAt: now,
    },
  });

  try {
    if (!config.enabled) {
      await db.pricingRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          summary: {
            enabled: false,
            processed: 0,
            applied: 0,
            review: 0,
            blocked: 0,
            refreshPublicCompetitorData,
            marketReportPath: marketReportPath ?? null,
          },
        },
      });

      return {
        runId: run.id,
        enabled: false,
        processed: 0,
        applied: 0,
        review: 0,
        blocked: 0,
        mode,
      };
    }

    const initialVariants = await db.variant.findMany({
      where: {
        product: {
          status: "ACTIVE",
          NOT: {
            supplier: { equals: "B2B Headshop", mode: "insensitive" },
          },
        },
      },
      take: limit,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        inventory: true,
        pricingProfile: {
          select: VARIANT_PRICING_PROFILE_SELECT,
        },
        product: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            handle: true,
            sellerUrl: true,
            sellerName: true,
            supplier: true,
          },
        },
      },
    });

    let publicRefreshStats: {
      productsRefreshed: number;
      variantsUpdated: number;
      skipped: number;
    } | null = null;
    let marketImportStats: {
      reportPath: string;
      variantsUpdated: number;
      skipped: number;
    } | null = null;

    if (refreshPublicCompetitorData) {
      publicRefreshStats = await refreshBloomtechPublicCompetitorData(
        db,
        initialVariants,
        now
      );
    }

    if (marketReportPath !== null) {
      marketImportStats = await importMarketReportCompetitorData(
        db,
        initialVariants,
        marketReportPath || DEFAULT_MARKET_REPORT_PATH
      );
    }

    const variantIdOrder = initialVariants.map((variant) => variant.id);
    const orderMap = new Map(variantIdOrder.map((id, index) => [id, index]));
    const variants = await db.variant.findMany({
      where: { id: { in: variantIdOrder } },
      include: {
        inventory: true,
        pricingProfile: {
          select: VARIANT_PRICING_PROFILE_SELECT,
        },
        product: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            handle: true,
            sellerUrl: true,
            sellerName: true,
            supplier: true,
          },
        },
      },
    });
    variants.sort(
      (left, right) =>
        (orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );

    const since = getDateDaysAgo(now, config.recommendationWindowDays - 1);
    const demandMap = await buildVariantDemandMap(
      db,
      variants.map((variant) => variant.id),
      since,
      config.recommendationWindowDays
    );

    let applied = 0;
    let review = 0;
    let blocked = 0;

    for (const variant of variants) {
      const demand = demandMap.get(variant.id) ?? {
        views: 0,
        unitsSold: 0,
        salesVelocity: 0,
        conversionRate: 0,
      };
      const input: PricingCalculationInput = {
        variantId: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        title: `${variant.product.title} / ${variant.title}`,
        currentPriceCents: variant.priceCents,
        currentCompareAtCents: variant.compareAtCents,
        baseCostCents: variant.costCents > 0 ? variant.costCents : null,
        supplierShippingCostCents:
          variant.pricingProfile?.supplierShippingCostCents ?? null,
        inboundShippingCostCents:
          variant.pricingProfile?.inboundShippingCostCents ?? null,
        packagingCostCents: variant.pricingProfile?.packagingCostCents ?? null,
        handlingCostCents: variant.pricingProfile?.handlingCostCents ?? null,
        paymentFeePercentBasisPoints:
          variant.pricingProfile?.paymentFeePercentBasisPoints ??
          config.defaultPaymentFeePercentBasisPoints,
        paymentFixedFeeCents:
          variant.pricingProfile?.paymentFixedFeeCents ??
          config.defaultPaymentFixedFeeCents,
        returnRiskBufferBasisPoints:
          variant.pricingProfile?.returnRiskBufferBasisPoints ??
          config.defaultReturnRiskBufferBasisPoints,
        targetMarginBasisPoints:
          variant.pricingProfile?.targetMarginBasisPoints ??
          config.defaultTargetMarginBasisPoints,
        competitorMinPriceCents:
          variant.pricingProfile?.competitorMinPriceCents ?? null,
        competitorAveragePriceCents:
          variant.pricingProfile?.competitorAveragePriceCents ?? null,
        competitorHighPriceCents:
          variant.pricingProfile?.competitorHighPriceCents ?? null,
        publicCompareAtCents:
          variant.pricingProfile?.publicCompareAtCents ?? null,
        competitorObservedAt:
          variant.pricingProfile?.competitorObservedAt ?? null,
        competitorSourceLabel:
          variant.pricingProfile?.competitorSourceLabel ?? null,
        competitorReliabilityScore:
          variant.pricingProfile?.competitorReliabilityScore ?? null,
        productSegment: variant.pricingProfile?.productSegment ?? "CORE",
        autoRepriceEnabled: variant.pricingProfile?.autoRepriceEnabled ?? true,
        stockOnHand: variant.inventory?.quantityOnHand ?? 0,
        reservedUnits: variant.inventory?.reserved ?? 0,
        recentSalesVelocity: demand.salesVelocity,
        recentConversionRate: demand.conversionRate,
        recentViews: demand.views,
        recentUnitsSold: demand.unitsSold,
        productCreatedAt: variant.product.createdAt,
        now,
      };

      const result = calculatePricingRecommendation(input, config);
      const status = buildRecommendationStatus(mode, result);

      const recommendation = await db.pricingRecommendation.create({
        data: {
          runId: run.id,
          variantId: variant.id,
          productId: variant.productId,
          status,
          confidenceScore: result.confidenceScore,
          reviewRequired: result.reviewRequired,
          reasonCodes: result.reasonCodes,
          explanation: result.explanation,
          currency: config.currency,
          currentPriceCents: variant.priceCents,
          hardMinimumPriceCents: result.hardMinimumPriceCents,
          recommendedTargetPriceCents: result.recommendedTargetPriceCents,
          publishablePriceCents: result.publishablePriceCents,
          priceDeltaBasisPoints: result.priceDeltaBasisPoints,
          inputSnapshot: serializeInputSnapshot(input, config) as Prisma.InputJsonValue,
          outputSnapshot: serializeOutputSnapshot(result) as Prisma.InputJsonValue,
          appliedAt: status === "APPLIED" ? now : null,
        },
      });

      if (status === "APPLIED") {
        applied += 1;
        if (variant.priceCents !== result.publishablePriceCents) {
          await db.$transaction(async (tx) => {
            const changeAuditData: Prisma.PricingChangeAuditUncheckedCreateInput = {
              recommendationId: recommendation.id,
              variantId: variant.id,
              productId: variant.productId,
              actorId: actor?.id ?? null,
              source: "AUTOMATION",
              oldPriceCents: variant.priceCents,
              newPriceCents: result.publishablePriceCents,
              oldCompareAtCents: variant.compareAtCents,
              newCompareAtCents: result.publishableCompareAtCents,
              hardMinimumPriceCents: result.hardMinimumPriceCents,
              reasonCodes: result.reasonCodes,
              inputSnapshot: serializeInputSnapshot(input, config) as Prisma.InputJsonValue,
              metadata: {
                runId: run.id,
                explanation: result.explanation,
              } as Prisma.InputJsonValue,
            };
            const changeAudit = await tx.pricingChangeAudit.create({
              data: changeAuditData,
            });

            await tx.variant.update({
              where: { id: variant.id },
              data: {
                priceCents: result.publishablePriceCents,
                compareAtCents: result.publishableCompareAtCents,
              },
            });

            await tx.pricingRecommendation.update({
              where: { id: recommendation.id },
              data: { priceChange: { connect: { id: changeAudit.id } } },
            });
          });
        }
      } else if (status === "PENDING_REVIEW") {
        review += 1;
      } else if (status === "BLOCKED") {
        blocked += 1;
      }
    }

    const summary = {
      enabled: true,
      mode,
      processed: variants.length,
      applied,
      review,
      blocked,
      refreshPublicCompetitorData,
      marketReportPath: marketImportStats?.reportPath ?? marketReportPath ?? null,
      publicRefreshStats,
      marketImportStats,
    };

    await db.pricingRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        summary: summary as Prisma.InputJsonValue,
      },
    });

    await logAdminAction({
      actor,
      action: mode === "PREVIEW" ? "pricing.run.preview" : "pricing.run.apply",
      targetType: "pricing_run",
      targetId: run.id,
      summary: `Pricing ${mode.toLowerCase()} processed ${variants.length} variants`,
      metadata: summary as Prisma.InputJsonValue,
    });

    return {
      runId: run.id,
      ...summary,
    };
  } catch (error) {
    await db.pricingRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        summary: {
          enabled: true,
          error: error instanceof Error ? error.message : "Unknown pricing automation error",
        },
      },
    });
    throw error;
  }
}

export async function approvePricingRecommendation(
  recommendationId: string,
  actor: AdminActor,
  customPriceCents?: number | null,
  prismaClient?: PrismaClient
) {
  const db = prismaClient ?? prisma;
  const recommendation = await db.pricingRecommendation.findUnique({
    where: { id: recommendationId },
    include: {
      variant: {
        select: {
          id: true,
          priceCents: true,
          compareAtCents: true,
          productId: true,
        },
      },
    },
  });

  if (!recommendation) {
    throw new Error("Pricing recommendation not found.");
  }
  if (recommendation.status !== "PENDING_REVIEW") {
    throw new Error("Only review-queue recommendations can be approved.");
  }

  const appliedPriceCents =
    typeof customPriceCents === "number"
      ? Math.round(customPriceCents)
      : recommendation.publishablePriceCents;

  if (!Number.isInteger(appliedPriceCents) || appliedPriceCents <= 0) {
    throw new Error("Manual approval price must be a positive amount in cents.");
  }

  const outputSnapshot =
    recommendation.outputSnapshot &&
    typeof recommendation.outputSnapshot === "object" &&
    !Array.isArray(recommendation.outputSnapshot)
      ? (recommendation.outputSnapshot as Record<string, unknown>)
      : null;
  const recommendedCompareAtCents =
    outputSnapshot &&
    typeof outputSnapshot.publishableCompareAtCents === "number" &&
    Number.isFinite(outputSnapshot.publishableCompareAtCents)
      ? Math.round(outputSnapshot.publishableCompareAtCents)
      : null;
  const appliedCompareAtCents =
    typeof recommendedCompareAtCents === "number" &&
    recommendedCompareAtCents > appliedPriceCents
      ? recommendedCompareAtCents
      : null;

  await db.$transaction(async (tx) => {
    const changeAuditData: Prisma.PricingChangeAuditUncheckedCreateInput = {
      recommendationId: recommendation.id,
      variantId: recommendation.variantId,
      productId: recommendation.productId,
      actorId: actor.id ?? null,
      source: "MANUAL_REVIEW",
      oldPriceCents: recommendation.variant.priceCents,
      newPriceCents: appliedPriceCents,
      oldCompareAtCents: recommendation.variant.compareAtCents,
      newCompareAtCents: appliedCompareAtCents,
      hardMinimumPriceCents: recommendation.hardMinimumPriceCents,
      reasonCodes: recommendation.reasonCodes,
      inputSnapshot: toInputJsonValue(recommendation.inputSnapshot),
      metadata: {
        approvedFromReviewQueue: true,
        recommendedPublishablePriceCents: recommendation.publishablePriceCents,
        manualOverrideApplied:
          appliedPriceCents !== recommendation.publishablePriceCents,
      } as Prisma.InputJsonValue,
    };
    const changeAudit = await tx.pricingChangeAudit.create({
      data: changeAuditData,
    });

    await tx.variant.update({
      where: { id: recommendation.variantId },
      data: {
        priceCents: appliedPriceCents,
        compareAtCents: appliedCompareAtCents,
      },
    });

    await tx.pricingRecommendation.update({
      where: { id: recommendation.id },
      data: {
        status: "APPLIED",
        reviewedById: actor.id ?? null,
        reviewedAt: new Date(),
        appliedAt: new Date(),
        priceChange: { connect: { id: changeAudit.id } },
      },
    });
  });

  await logAdminAction({
    actor,
    action: "pricing.recommendation.approve",
    targetType: "pricing_recommendation",
    targetId: recommendation.id,
    summary: `Approved pricing recommendation for variant ${recommendation.variantId}`,
    metadata: {
      oldPriceCents: recommendation.variant.priceCents,
      newPriceCents: appliedPriceCents,
      oldCompareAtCents: recommendation.variant.compareAtCents,
      newCompareAtCents: appliedCompareAtCents,
      recommendedPublishablePriceCents: recommendation.publishablePriceCents,
      manualOverrideApplied:
        appliedPriceCents !== recommendation.publishablePriceCents,
    } as Prisma.InputJsonValue,
  });
}

export async function rejectPricingRecommendation(
  recommendationId: string,
  actor: AdminActor,
  prismaClient?: PrismaClient
) {
  const db = prismaClient ?? prisma;
  const recommendation = await db.pricingRecommendation.findUnique({
    where: { id: recommendationId },
    select: { id: true, status: true, variantId: true },
  });

  if (!recommendation) {
    throw new Error("Pricing recommendation not found.");
  }
  if (recommendation.status !== "PENDING_REVIEW") {
    throw new Error("Only review-queue recommendations can be rejected.");
  }

  await db.pricingRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: "REJECTED",
      reviewedById: actor.id ?? null,
      reviewedAt: new Date(),
    },
  });

  await logAdminAction({
    actor,
    action: "pricing.recommendation.reject",
    targetType: "pricing_recommendation",
    targetId: recommendationId,
    summary: `Rejected pricing recommendation for variant ${recommendation.variantId}`,
  });
}
