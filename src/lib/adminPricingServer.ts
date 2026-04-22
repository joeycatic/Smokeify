import "server-only";

import { Prisma, type PricingProductSegment } from "@prisma/client";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  normalizePricingOverview,
  type PricingOverviewSnapshot,
  type PricingProfilePatch,
  type PricingRecommendationAction,
  type PricingRecommendationStatus,
  type PricingRunMode,
  type PricingRunSummary,
  type VariantPricingProfileRecord,
  PRICING_PRODUCT_SEGMENTS,
} from "@/lib/adminPricingIntegration";
import {
  approvePricingRecommendation,
  rejectPricingRecommendation,
  runPricingAutomation,
} from "@/lib/pricingAutomationService";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id?: string | null;
  email?: string | null;
};

type PricingSafeResult<T> = {
  data: T | null;
  error: string | null;
};

const PRICING_PROFILE_INTEGER_FIELDS = [
  "supplierShippingCostCents",
  "inboundShippingCostCents",
  "packagingCostCents",
  "handlingCostCents",
  "paymentFeePercentBasisPoints",
  "paymentFixedFeeCents",
  "returnRiskBufferBasisPoints",
  "targetMarginBasisPoints",
  "competitorMinPriceCents",
  "competitorAveragePriceCents",
  "competitorHighPriceCents",
  "publicCompareAtCents",
  "competitorSourceCount",
] as const;

type PricingProfileIntegerField = (typeof PRICING_PROFILE_INTEGER_FIELDS)[number];

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
  competitorSourceCount: true,
  competitorReliabilityScore: true,
  productSegment: true,
  autoRepriceEnabled: true,
  updatedAt: true,
} satisfies Prisma.VariantPricingProfileSelect;

export class AdminPricingError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AdminPricingError";
    this.status = status;
  }
}

const toMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Pricing operation failed.";

const parseIntegerValue = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
};

const parseFloatValue = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const serializeVariantPricingRecord = (variant: {
  id: string;
  title: string;
  sku: string | null;
  updatedAt: Date;
  pricingProfile: {
    supplierShippingCostCents: number | null;
    inboundShippingCostCents: number | null;
    packagingCostCents: number | null;
    handlingCostCents: number | null;
    paymentFeePercentBasisPoints: number | null;
    paymentFixedFeeCents: number | null;
    returnRiskBufferBasisPoints: number | null;
    targetMarginBasisPoints: number | null;
    competitorMinPriceCents: number | null;
    competitorAveragePriceCents: number | null;
    competitorHighPriceCents: number | null;
    publicCompareAtCents: number | null;
    competitorObservedAt: Date | null;
    competitorSourceLabel: string | null;
    competitorSourceCount: number | null;
    competitorReliabilityScore: number | null;
    productSegment: PricingProductSegment;
    autoRepriceEnabled: boolean;
    updatedAt: Date;
  } | null;
}): VariantPricingProfileRecord | null => {
  if (!variant.pricingProfile) return null;

  return {
    variantId: variant.id,
    variantTitle: variant.title,
    sku: variant.sku,
    variantUpdatedAt: variant.pricingProfile.updatedAt.toISOString(),
    pricingProfile: {
      supplierShippingCostCents: variant.pricingProfile.supplierShippingCostCents,
      inboundShippingCostCents: variant.pricingProfile.inboundShippingCostCents,
      packagingCostCents: variant.pricingProfile.packagingCostCents,
      handlingCostCents: variant.pricingProfile.handlingCostCents,
      paymentFeePercentBasisPoints:
        variant.pricingProfile.paymentFeePercentBasisPoints,
      paymentFixedFeeCents: variant.pricingProfile.paymentFixedFeeCents,
      returnRiskBufferBasisPoints:
        variant.pricingProfile.returnRiskBufferBasisPoints,
      targetMarginBasisPoints: variant.pricingProfile.targetMarginBasisPoints,
      competitorMinPriceCents: variant.pricingProfile.competitorMinPriceCents,
      competitorAveragePriceCents:
        variant.pricingProfile.competitorAveragePriceCents,
      competitorHighPriceCents: variant.pricingProfile.competitorHighPriceCents,
      publicCompareAtCents: variant.pricingProfile.publicCompareAtCents,
      competitorObservedAt:
        variant.pricingProfile.competitorObservedAt?.toISOString() ?? null,
      competitorSourceLabel: variant.pricingProfile.competitorSourceLabel,
      competitorSourceCount: variant.pricingProfile.competitorSourceCount,
      competitorReliabilityScore:
        variant.pricingProfile.competitorReliabilityScore,
      productSegment: variant.pricingProfile.productSegment,
      autoRepriceEnabled: variant.pricingProfile.autoRepriceEnabled,
    },
  };
};

const getConcurrencyStamp = (variant: {
  updatedAt: Date;
  pricingProfile: { updatedAt: Date } | null;
}) => (variant.pricingProfile?.updatedAt ?? variant.updatedAt).toISOString();

const requireActor = (actor?: AdminActor | null) => {
  if (!actor?.id) {
    throw new AdminPricingError("Unauthorized", 401);
  }
  return actor;
};

export async function getAdminPricingOverview(): Promise<PricingOverviewSnapshot> {
  const latestRun = await prisma.pricingRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
  const [reviewQueue, recentRecommendations, recentChanges, latestRunRecommendations] =
    await Promise.all([
      prisma.pricingRecommendation.findMany({
        where: { status: "PENDING_REVIEW" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          product: { select: { id: true, title: true, handle: true } },
          variant: { select: { id: true, title: true, sku: true } },
          run: { select: { id: true, mode: true, startedAt: true } },
        },
      }),
      prisma.pricingRecommendation.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          product: { select: { id: true, title: true, handle: true } },
          variant: { select: { id: true, title: true, sku: true } },
          run: { select: { id: true, mode: true, startedAt: true } },
        },
      }),
      prisma.pricingChangeAudit.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          product: { select: { id: true, title: true, handle: true } },
          variant: { select: { id: true, title: true, sku: true } },
          actor: { select: { id: true, email: true } },
        },
      }),
      latestRun
        ? prisma.pricingRecommendation.findMany({
            where: { runId: latestRun.id },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
              product: { select: { id: true, title: true, handle: true } },
              variant: { select: { id: true, title: true, sku: true } },
              run: { select: { id: true, mode: true, startedAt: true } },
              priceChange: {
                include: {
                  product: { select: { id: true, title: true, handle: true } },
                  variant: { select: { id: true, title: true, sku: true } },
                  actor: { select: { id: true, email: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);
  const latestRunChanges = latestRunRecommendations
    .map((item) => item.priceChange)
    .filter((item): item is NonNullable<(typeof latestRunRecommendations)[number]["priceChange"]> => Boolean(item));

  return normalizePricingOverview({
    latestRun: latestRun
      ? {
          ...latestRun,
          startedAt: latestRun.startedAt.toISOString(),
          finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        }
      : null,
    reviewQueue: reviewQueue.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      run: {
        ...item.run,
        startedAt: item.run.startedAt.toISOString(),
      },
    })),
    recentRecommendations: recentRecommendations.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      appliedAt: item.appliedAt?.toISOString() ?? null,
      run: {
        ...item.run,
        startedAt: item.run.startedAt.toISOString(),
      },
    })),
    recentChanges: recentChanges.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    latestRunRecommendations: latestRunRecommendations.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      appliedAt: item.appliedAt?.toISOString() ?? null,
      run: {
        ...item.run,
        startedAt: item.run.startedAt.toISOString(),
      },
    })),
    latestRunChanges: latestRunChanges.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}

export async function getAdminPricingOverviewSafe(): Promise<
  PricingSafeResult<PricingOverviewSnapshot>
> {
  try {
    return {
      data: await getAdminPricingOverview(),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toMessage(error),
    };
  }
}

export async function runAdminPricingAutomation(
  body: {
    mode: PricingRunMode;
    limit?: number;
    notes?: string | null;
    refreshPublicCompetitorData?: boolean;
    marketReportPath?: string | null;
  },
  options: {
    actor?: AdminActor | null;
  } = {}
): Promise<{ summary: PricingRunSummary & { runId: string } }> {
  const actor = requireActor(options.actor);
  const result = await runPricingAutomation({
    mode: body.mode === "PREVIEW" ? "PREVIEW" : "APPLY",
    limit: body.limit,
    notes: body.notes ?? null,
    refreshPublicCompetitorData: body.refreshPublicCompetitorData !== false,
    marketReportPath:
      typeof body.marketReportPath === "string" ? body.marketReportPath : null,
    actor,
  });

  return {
    summary: {
      runId: result.runId,
      enabled: result.enabled,
      mode: result.mode,
      processed: result.processed,
      applied: result.applied,
      review: result.review,
      blocked: result.blocked,
    },
  };
}

export async function reviewAdminPricingRecommendation(
  recommendationId: string,
  action: PricingRecommendationAction,
  options: {
    actor?: AdminActor | null;
    customPriceCents?: number | null;
    reviewNote?: string | null;
  } = {}
): Promise<{ ok: true; status: PricingRecommendationStatus }> {
  const actor = requireActor(options.actor);

  if (action === "reject") {
    await rejectPricingRecommendation(recommendationId, actor, options.reviewNote);
    return { ok: true, status: "REJECTED" };
  }

  await approvePricingRecommendation(
    recommendationId,
    actor,
    options.customPriceCents,
    options.reviewNote,
  );
  return { ok: true, status: "APPLIED" };
}

export async function getAdminProductVariantPricingProfiles(
  productId: string
): Promise<Record<string, VariantPricingProfileRecord>> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      variants: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          sku: true,
          updatedAt: true,
          pricingProfile: {
            select: VARIANT_PRICING_PROFILE_SELECT,
          },
        },
      },
    },
  });

  if (!product) {
    throw new AdminPricingError("Product not found.", 404);
  }

  return Object.fromEntries(
    product.variants
      .map((variant) => serializeVariantPricingRecord(variant))
      .filter((record): record is VariantPricingProfileRecord => Boolean(record))
      .map((record) => [record.variantId, record])
  );
}

export async function getAdminProductVariantPricingProfilesSafe(
  productId: string
): Promise<PricingSafeResult<Record<string, VariantPricingProfileRecord>>> {
  try {
    return {
      data: await getAdminProductVariantPricingProfiles(productId),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toMessage(error),
    };
  }
}

export async function updateAdminVariantPricingProfile(
  variantId: string,
  body: {
    pricingProfile: PricingProfilePatch;
    expectedUpdatedAt?: string | null;
  },
  options: {
    actor?: AdminActor | null;
  } = {}
): Promise<VariantPricingProfileRecord> {
  const actor = requireActor(options.actor);

  const existingVariant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      productId: true,
      title: true,
      sku: true,
      updatedAt: true,
      pricingProfile: {
        select: VARIANT_PRICING_PROFILE_SELECT,
      },
    },
  });

  if (!existingVariant) {
    throw new AdminPricingError("Variant not found.", 404);
  }

  const currentUpdatedAt = getConcurrencyStamp(existingVariant);
  if (body.expectedUpdatedAt && currentUpdatedAt !== body.expectedUpdatedAt) {
    throw new AdminPricingError(
      "This pricing profile was updated by another admin. Reload the latest product data before saving.",
      409
    );
  }

  const updateData: Prisma.VariantPricingProfileUncheckedUpdateInput = {};
  const integerPatch: Partial<Record<PricingProfileIntegerField, number | null>> = {};
  const changedFields: string[] = [];

  const assignNullableInteger = (
    key: PricingProfileIntegerField,
    value: unknown
  ) => {
    if (typeof value === "undefined") return;
    changedFields.push(key);
    if (value === null || value === "") {
      integerPatch[key] = null;
      return;
    }
    const parsed = parseIntegerValue(value);
    if (parsed === null) {
      throw new AdminPricingError(`Invalid value for ${key}.`, 400);
    }
    integerPatch[key] = parsed;
  };

  for (const key of PRICING_PROFILE_INTEGER_FIELDS) {
    assignNullableInteger(key, body.pricingProfile[key]);
  }
  Object.assign(updateData, integerPatch);

  if (typeof body.pricingProfile.competitorReliabilityScore !== "undefined") {
    changedFields.push("competitorReliabilityScore");
    if (body.pricingProfile.competitorReliabilityScore === null) {
      updateData.competitorReliabilityScore = null;
    } else {
      const parsed = parseFloatValue(body.pricingProfile.competitorReliabilityScore);
      if (parsed === null) {
        throw new AdminPricingError("Competitor reliability is invalid.", 400);
      }
      updateData.competitorReliabilityScore = parsed;
    }
  }

  if (typeof body.pricingProfile.competitorObservedAt !== "undefined") {
    changedFields.push("competitorObservedAt");
    if (!body.pricingProfile.competitorObservedAt) {
      updateData.competitorObservedAt = null;
    } else {
      const parsed = new Date(body.pricingProfile.competitorObservedAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new AdminPricingError("Competitor observed date is invalid.", 400);
      }
      updateData.competitorObservedAt = parsed;
    }
  }

  if (typeof body.pricingProfile.competitorSourceLabel !== "undefined") {
    changedFields.push("competitorSourceLabel");
    updateData.competitorSourceLabel =
      body.pricingProfile.competitorSourceLabel?.trim() || null;
  }

  if (typeof body.pricingProfile.productSegment !== "undefined") {
    const segment = body.pricingProfile.productSegment?.toUpperCase();
    if (!PRICING_PRODUCT_SEGMENTS.includes(segment as PricingProductSegment)) {
      throw new AdminPricingError("Pricing segment is invalid.", 400);
    }
    changedFields.push("productSegment");
    updateData.productSegment = segment as PricingProductSegment;
  }

  if (typeof body.pricingProfile.autoRepriceEnabled === "boolean") {
    changedFields.push("autoRepriceEnabled");
    updateData.autoRepriceEnabled = body.pricingProfile.autoRepriceEnabled;
  }

  const createData: Prisma.VariantPricingProfileUncheckedCreateInput = {
    variantId,
    productSegment:
      (updateData.productSegment as PricingProductSegment | undefined) ?? "CORE",
    autoRepriceEnabled:
      (updateData.autoRepriceEnabled as boolean | undefined) ?? true,
  };

  for (const key of PRICING_PROFILE_INTEGER_FIELDS) {
    if (typeof integerPatch[key] !== "undefined") {
      Object.assign(createData, { [key]: integerPatch[key] });
    }
  }
  if (typeof updateData.competitorReliabilityScore !== "undefined") {
    createData.competitorReliabilityScore =
      updateData.competitorReliabilityScore as number | null;
  }
  if (typeof updateData.competitorObservedAt !== "undefined") {
    createData.competitorObservedAt = updateData.competitorObservedAt as Date | null;
  }
  if (typeof updateData.competitorSourceLabel !== "undefined") {
    createData.competitorSourceLabel =
      updateData.competitorSourceLabel as string | null;
  }

  const pricingProfile = await prisma.variantPricingProfile.upsert({
    where: { variantId },
    update: updateData,
    create: createData,
  });

  await logAdminAction({
    actor,
    action: "pricing.profile.update",
    targetType: "variant_pricing_profile",
    targetId: pricingProfile.id,
    summary: `Updated pricing profile for variant ${variantId}`,
    metadata: {
      changedFields,
      variantId,
      productId: existingVariant.productId,
    } as Prisma.InputJsonValue,
  });

  return {
    variantId,
    variantTitle: existingVariant.title,
    sku: existingVariant.sku,
    variantUpdatedAt: pricingProfile.updatedAt.toISOString(),
    pricingProfile: {
      supplierShippingCostCents: pricingProfile.supplierShippingCostCents,
      inboundShippingCostCents: pricingProfile.inboundShippingCostCents,
      packagingCostCents: pricingProfile.packagingCostCents,
      handlingCostCents: pricingProfile.handlingCostCents,
      paymentFeePercentBasisPoints: pricingProfile.paymentFeePercentBasisPoints,
      paymentFixedFeeCents: pricingProfile.paymentFixedFeeCents,
      returnRiskBufferBasisPoints: pricingProfile.returnRiskBufferBasisPoints,
      targetMarginBasisPoints: pricingProfile.targetMarginBasisPoints,
      competitorMinPriceCents: pricingProfile.competitorMinPriceCents,
      competitorAveragePriceCents: pricingProfile.competitorAveragePriceCents,
      competitorHighPriceCents: pricingProfile.competitorHighPriceCents,
      publicCompareAtCents: pricingProfile.publicCompareAtCents,
      competitorObservedAt: pricingProfile.competitorObservedAt?.toISOString() ?? null,
      competitorSourceLabel: pricingProfile.competitorSourceLabel,
      competitorSourceCount: pricingProfile.competitorSourceCount,
      competitorReliabilityScore: pricingProfile.competitorReliabilityScore,
      productSegment: pricingProfile.productSegment,
      autoRepriceEnabled: pricingProfile.autoRepriceEnabled,
    },
  };
}
