export const PRICING_PRODUCT_SEGMENTS = [
  "TRAFFIC_DRIVER",
  "CORE",
  "PREMIUM",
  "CLEARANCE",
] as const;

export type PricingProductSegment = (typeof PRICING_PRODUCT_SEGMENTS)[number];
export type PricingRunMode = "PREVIEW" | "APPLY";
export type PricingRecommendationAction = "approve" | "reject";
export type PricingRecommendationStatus =
  | "PREVIEW"
  | "BLOCKED"
  | "PENDING_REVIEW"
  | "APPLIED"
  | "REJECTED";

export type PricingRunSummary = {
  enabled: boolean;
  mode: PricingRunMode;
  processed: number;
  applied: number;
  review: number;
  blocked: number;
};

export type PricingOverviewRun = {
  id: string;
  status: string;
  mode: PricingRunMode;
  startedAt: string;
  finishedAt: string | null;
  summary: PricingRunSummary | null;
};

export type PricingRecommendationItem = {
  id: string;
  status: PricingRecommendationStatus;
  confidenceScore: number | null;
  reviewRequired: boolean;
  reasonCodes: string[];
  explanation: string | null;
  currentPriceCents: number;
  hardMinimumPriceCents: number | null;
  recommendedTargetPriceCents: number | null;
  publishablePriceCents: number | null;
  priceDeltaBasisPoints: number | null;
  createdAt: string;
  reviewedAt?: string | null;
  appliedAt?: string | null;
  product: {
    id: string;
    title: string;
    handle: string;
  };
  variant: {
    id: string;
    title: string;
    sku: string | null;
  };
  run: {
    id: string;
    mode: PricingRunMode;
    startedAt: string;
  };
};

export type PricingChangeItem = {
  id: string;
  source: string | null;
  oldPriceCents: number;
  newPriceCents: number;
  hardMinimumPriceCents: number | null;
  reasonCodes: string[];
  createdAt: string;
  product: {
    id: string;
    title: string;
    handle: string;
  };
  variant: {
    id: string;
    title: string;
    sku: string | null;
  };
  actor: {
    id: string;
    email: string | null;
  } | null;
};

export type PricingOverviewSnapshot = {
  latestRun: PricingOverviewRun | null;
  reviewQueue: PricingRecommendationItem[];
  recentRecommendations: PricingRecommendationItem[];
  recentChanges: PricingChangeItem[];
};

export type PricingProfile = {
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
  competitorObservedAt: string | null;
  competitorSourceLabel: string | null;
  competitorSourceCount: number | null;
  competitorReliabilityScore: number | null;
  productSegment: PricingProductSegment;
  autoRepriceEnabled: boolean;
};

export type VariantPricingProfileRecord = {
  variantId: string;
  variantTitle: string;
  sku: string | null;
  variantUpdatedAt: string;
  pricingProfile: PricingProfile;
};

export type PricingProfilePatch = Partial<PricingProfile>;

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const asNullableString = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : value instanceof Date
      ? value.toISOString()
      : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const normalizeMode = (value: unknown): PricingRunMode =>
  value === "PREVIEW" ? "PREVIEW" : "APPLY";

const normalizeStatus = (value: unknown): PricingRecommendationStatus => {
  if (
    value === "PREVIEW" ||
    value === "BLOCKED" ||
    value === "PENDING_REVIEW" ||
    value === "APPLIED" ||
    value === "REJECTED"
  ) {
    return value;
  }
  return "PREVIEW";
};

const normalizeSummary = (value: unknown): PricingRunSummary | null => {
  const record = asObject(value);
  if (!record) return null;

  return {
    enabled: asBoolean(record.enabled) ?? true,
    mode: normalizeMode(record.mode),
    processed: asNumber(record.processed) ?? 0,
    applied: asNumber(record.applied) ?? 0,
    review: asNumber(record.review) ?? 0,
    blocked: asNumber(record.blocked) ?? 0,
  };
};

export const normalizePricingProfile = (value: unknown): PricingProfile => {
  const record = asObject(value);
  const segment =
    record && typeof record.productSegment === "string"
      ? record.productSegment.toUpperCase()
      : null;
  const productSegment = PRICING_PRODUCT_SEGMENTS.includes(
    segment as PricingProductSegment
  )
    ? (segment as PricingProductSegment)
    : "CORE";

  return {
    supplierShippingCostCents: record ? asNumber(record.supplierShippingCostCents) : null,
    inboundShippingCostCents: record ? asNumber(record.inboundShippingCostCents) : null,
    packagingCostCents: record ? asNumber(record.packagingCostCents) : null,
    handlingCostCents: record ? asNumber(record.handlingCostCents) : null,
    paymentFeePercentBasisPoints: record
      ? asNumber(record.paymentFeePercentBasisPoints)
      : null,
    paymentFixedFeeCents: record ? asNumber(record.paymentFixedFeeCents) : null,
    returnRiskBufferBasisPoints: record
      ? asNumber(record.returnRiskBufferBasisPoints)
      : null,
    targetMarginBasisPoints: record ? asNumber(record.targetMarginBasisPoints) : null,
    competitorMinPriceCents: record ? asNumber(record.competitorMinPriceCents) : null,
    competitorAveragePriceCents: record
      ? asNumber(record.competitorAveragePriceCents)
      : null,
    competitorObservedAt: record ? asNullableString(record.competitorObservedAt) : null,
    competitorSourceLabel: record ? asNullableString(record.competitorSourceLabel) : null,
    competitorSourceCount: record ? asNumber(record.competitorSourceCount) : null,
    competitorReliabilityScore: record
      ? asNumber(record.competitorReliabilityScore)
      : null,
    productSegment,
    autoRepriceEnabled: record ? asBoolean(record.autoRepriceEnabled) ?? true : true,
  };
};

const normalizeRecommendationItem = (
  value: unknown,
  includeLifecycleDates: boolean
): PricingRecommendationItem | null => {
  const record = asObject(value);
  const product = asObject(record?.product);
  const variant = asObject(record?.variant);
  const run = asObject(record?.run);
  const id = asString(record?.id);
  const productId = asString(product?.id);
  const variantId = asString(variant?.id);
  const runId = asString(run?.id);
  const createdAt = asString(record?.createdAt);
  const startedAt = asString(run?.startedAt);

  if (
    !record ||
    !product ||
    !variant ||
    !run ||
    !id ||
    !productId ||
    !variantId ||
    !runId ||
    !createdAt ||
    !startedAt
  ) {
    return null;
  }

  return {
    id,
    status: normalizeStatus(record.status),
    confidenceScore: asNumber(record.confidenceScore),
    reviewRequired: asBoolean(record.reviewRequired) ?? false,
    reasonCodes: asStringArray(record.reasonCodes),
    explanation: asNullableString(record.explanation),
    currentPriceCents: asNumber(record.currentPriceCents) ?? 0,
    hardMinimumPriceCents: asNumber(record.hardMinimumPriceCents),
    recommendedTargetPriceCents: asNumber(record.recommendedTargetPriceCents),
    publishablePriceCents: asNumber(record.publishablePriceCents),
    priceDeltaBasisPoints: asNumber(record.priceDeltaBasisPoints),
    createdAt,
    ...(includeLifecycleDates
      ? {
          reviewedAt: asNullableString(record.reviewedAt),
          appliedAt: asNullableString(record.appliedAt),
        }
      : {}),
    product: {
      id: productId,
      title: asString(product.title) ?? "Unknown product",
      handle: asString(product.handle) ?? "",
    },
    variant: {
      id: variantId,
      title: asString(variant.title) ?? "Default",
      sku: asNullableString(variant.sku),
    },
    run: {
      id: runId,
      mode: normalizeMode(run.mode),
      startedAt,
    },
  };
};

const normalizeChangeItem = (value: unknown): PricingChangeItem | null => {
  const record = asObject(value);
  const product = asObject(record?.product);
  const variant = asObject(record?.variant);
  const actor = asObject(record?.actor);
  const id = asString(record?.id);
  const productId = asString(product?.id);
  const variantId = asString(variant?.id);
  const createdAt = asString(record?.createdAt);

  if (!record || !product || !variant || !id || !productId || !variantId || !createdAt) {
    return null;
  }

  return {
    id,
    source: asNullableString(record.source),
    oldPriceCents: asNumber(record.oldPriceCents) ?? 0,
    newPriceCents: asNumber(record.newPriceCents) ?? 0,
    hardMinimumPriceCents: asNumber(record.hardMinimumPriceCents),
    reasonCodes: asStringArray(record.reasonCodes),
    createdAt,
    product: {
      id: productId,
      title: asString(product.title) ?? "Unknown product",
      handle: asString(product.handle) ?? "",
    },
    variant: {
      id: variantId,
      title: asString(variant.title) ?? "Default",
      sku: asNullableString(variant.sku),
    },
    actor: actor
      ? {
          id: asString(actor.id) ?? "",
          email: asNullableString(actor.email),
        }
      : null,
  };
};

export const normalizePricingOverview = (value: unknown): PricingOverviewSnapshot => {
  const record = asObject(value);
  const latestRunRecord = asObject(record?.latestRun);

  return {
    latestRun:
      latestRunRecord &&
      asString(latestRunRecord.id) &&
      asString(latestRunRecord.startedAt)
        ? {
            id: asString(latestRunRecord.id) ?? "",
            status: asString(latestRunRecord.status) ?? "UNKNOWN",
            mode: normalizeMode(latestRunRecord.mode),
            startedAt: asString(latestRunRecord.startedAt) ?? "",
            finishedAt: asNullableString(latestRunRecord.finishedAt),
            summary: normalizeSummary(latestRunRecord.summary),
          }
        : null,
    reviewQueue: Array.isArray(record?.reviewQueue)
      ? record.reviewQueue
          .map((entry) => normalizeRecommendationItem(entry, false))
          .filter((entry): entry is PricingRecommendationItem => Boolean(entry))
      : [],
    recentRecommendations: Array.isArray(record?.recentRecommendations)
      ? record.recentRecommendations
          .map((entry) => normalizeRecommendationItem(entry, true))
          .filter((entry): entry is PricingRecommendationItem => Boolean(entry))
      : [],
    recentChanges: Array.isArray(record?.recentChanges)
      ? record.recentChanges
          .map((entry) => normalizeChangeItem(entry))
          .filter((entry): entry is PricingChangeItem => Boolean(entry))
      : [],
  };
};

const normalizeVariantPricingRecord = (value: unknown): VariantPricingProfileRecord | null => {
  const record = asObject(value);
  const variantId = asString(record?.id);
  const variantUpdatedAt = asNullableString(record?.updatedAt);

  if (!record || !variantId || !variantUpdatedAt) return null;

  return {
    variantId,
    variantTitle: asString(record.title) ?? "Default",
    sku: asNullableString(record.sku),
    variantUpdatedAt,
    pricingProfile: normalizePricingProfile(record.pricingProfile),
  };
};

export const extractVariantPricingProfilesFromProductPayload = (
  value: unknown
): Record<string, VariantPricingProfileRecord> => {
  const record = asObject(value);
  const product = asObject(record?.product);
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  return Object.fromEntries(
    variants
      .map((entry) => normalizeVariantPricingRecord(entry))
      .filter((entry): entry is VariantPricingProfileRecord => Boolean(entry))
      .map((entry) => [entry.variantId, entry])
  );
};
