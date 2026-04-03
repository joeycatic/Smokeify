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

type GrowvaultRequestOptions = {
  forwardedCookieHeader?: string | null;
  searchParams?: Record<string, string | number | boolean | null | undefined>;
};

type GrowvaultSafeResult<T> = {
  data: T | null;
  error: string | null;
};

type JsonObject = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 15_000;

export class GrowvaultAdminIntegrationError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "GrowvaultAdminIntegrationError";
    this.status = status;
  }
}

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const toIntegrationMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Shared admin pricing integration failed.";

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
  const variantUpdatedAt = asString(record?.updatedAt);

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

const resolveBaseUrl = () => {
  const raw =
    process.env.SMOKEIFY_ADMIN_API_BASE_URL?.trim() ??
    process.env.GROWVAULT_ADMIN_API_BASE_URL?.trim();
  if (!raw) {
    throw new GrowvaultAdminIntegrationError(
      "SMOKEIFY_ADMIN_API_BASE_URL is required for pricing integration. GROWVAULT_ADMIN_API_BASE_URL is still supported as a legacy alias."
    );
  }

  try {
    return new URL(raw.endsWith("/") ? raw : `${raw}/`);
  } catch {
    throw new GrowvaultAdminIntegrationError(
      "SMOKEIFY_ADMIN_API_BASE_URL must be a valid absolute URL."
    );
  }
};

const getCookieCandidates = (forwardedCookieHeader?: string | null) => {
  const forwarded = forwardedCookieHeader?.trim();
  const configured =
    process.env.SMOKEIFY_ADMIN_SESSION_COOKIE?.trim() ??
    process.env.GROWVAULT_ADMIN_SESSION_COOKIE?.trim();
  const candidates = [forwarded, configured].filter(
    (value, index, source): value is string => Boolean(value) && source.indexOf(value) === index
  );

  if (candidates.length === 0) {
    throw new GrowvaultAdminIntegrationError(
      "Shared admin session is unavailable. Forward a shared admin session cookie or configure SMOKEIFY_ADMIN_SESSION_COOKIE."
    );
  }

  return candidates;
};

const buildUrl = (
  path: string,
  searchParams?: Record<string, string | number | boolean | null | undefined>
) => {
  const baseUrl = resolveBaseUrl();
  const url = new URL(path.replace(/^\//, ""), baseUrl);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "undefined" || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
};

const parseErrorMessage = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return `Growvault request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(text) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Fall through to raw text.
  }

  return text;
};

async function requestGrowvaultAdminJson<T>(
  path: string,
  init: RequestInit = {},
  options: GrowvaultRequestOptions = {}
) {
  const url = buildUrl(path, options.searchParams);
  const cookieCandidates = getCookieCandidates(options.forwardedCookieHeader);
  let lastError: GrowvaultAdminIntegrationError | null = null;

  for (const cookieHeader of cookieCandidates) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const headers = new Headers(init.headers);
      headers.set("accept", "application/json");
      headers.set("cookie", cookieHeader);

      const method = (init.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        headers.set("origin", url.origin);
        headers.set("referer", `${url.origin}/admin/pricing`);
      }

      const response = await fetch(url, {
        ...init,
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        const error = new GrowvaultAdminIntegrationError(message, response.status);
        if ((response.status === 401 || response.status === 403) && lastError === null) {
          lastError = error;
          continue;
        }
        throw error;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof GrowvaultAdminIntegrationError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new GrowvaultAdminIntegrationError(
          "Growvault pricing request timed out."
        );
      }
      throw new GrowvaultAdminIntegrationError(toIntegrationMessage(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw (
    lastError ??
    new GrowvaultAdminIntegrationError("Growvault pricing request was not authorized.", 401)
  );
}

export async function getAdminPricingOverview(
  options: GrowvaultRequestOptions = {}
): Promise<PricingOverviewSnapshot> {
  const payload = await requestGrowvaultAdminJson<unknown>(
    "/api/admin/pricing",
    undefined,
    options
  );
  return normalizePricingOverview(payload);
}

export async function getAdminPricingOverviewSafe(
  options: GrowvaultRequestOptions = {}
): Promise<GrowvaultSafeResult<PricingOverviewSnapshot>> {
  try {
    return {
      data: await getAdminPricingOverview(options),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toIntegrationMessage(error),
    };
  }
}

export async function runAdminPricingAutomation(
  body: {
    mode: PricingRunMode;
    limit?: number;
    notes?: string | null;
  },
  options: GrowvaultRequestOptions = {}
): Promise<{ summary: PricingRunSummary & { runId: string } }> {
  return requestGrowvaultAdminJson(
    "/api/admin/pricing/run",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    options
  );
}

export async function reviewAdminPricingRecommendation(
  recommendationId: string,
  action: PricingRecommendationAction,
  options: GrowvaultRequestOptions = {}
): Promise<{ ok: true; status: PricingRecommendationStatus }> {
  return requestGrowvaultAdminJson(
    `/api/admin/pricing/recommendations/${recommendationId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ action }),
    },
    options
  );
}

export async function getGrowvaultProductVariantPricing(
  productId: string,
  options: GrowvaultRequestOptions = {}
): Promise<Record<string, VariantPricingProfileRecord>> {
  const payload = await requestGrowvaultAdminJson<unknown>(
    `/api/admin/products/${productId}`,
    undefined,
    options
  );
  return extractVariantPricingProfilesFromProductPayload(payload);
}

export async function getGrowvaultProductVariantPricingSafe(
  productId: string,
  options: GrowvaultRequestOptions = {}
): Promise<GrowvaultSafeResult<Record<string, VariantPricingProfileRecord>>> {
  try {
    return {
      data: await getGrowvaultProductVariantPricing(productId, options),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toIntegrationMessage(error),
    };
  }
}

export async function updateGrowvaultVariantPricingProfile(
  variantId: string,
  body: {
    pricingProfile: PricingProfilePatch;
    expectedUpdatedAt?: string | null;
  },
  options: GrowvaultRequestOptions = {}
): Promise<VariantPricingProfileRecord> {
  const payload = await requestGrowvaultAdminJson<unknown>(
    `/api/admin/variants/${variantId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    options
  );
  const variant = normalizeVariantPricingRecord(asObject(payload)?.variant);
  if (!variant) {
    throw new GrowvaultAdminIntegrationError(
      "Growvault variant response was missing pricing profile data."
    );
  }
  return variant;
}
