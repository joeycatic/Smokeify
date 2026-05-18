import { collectMerchantPolicyViolations } from "@/lib/merchantTextPolicy";

export const PRODUCT_COMPLIANCE_STATUSES = [
  "DRAFT_REVIEW",
  "APPROVED",
  "NEEDS_CHANGES",
  "BLOCKED",
] as const;

export type ProductComplianceStatus = (typeof PRODUCT_COMPLIANCE_STATUSES)[number];

export type ProductComplianceBlockerType =
  | "MEDICAL_CLAIM"
  | "ILLEGAL_USE_IMPLICATION"
  | "RESTRICTED_CATEGORY"
  | "RESTRICTED_TEXT"
  | "MISSING_CERTIFICATION"
  | "SHIPPING_RESTRICTION"
  | "REGION_RESTRICTION"
  | "AD_POLICY"
  | "FEED_POLICY"
  | "AGE_GATE_REQUIRED"
  | "MANUAL";

export type ProductComplianceSurface =
  | "STOREFRONT"
  | "SEARCH"
  | "RECOMMENDATIONS"
  | "CUSTOMIZER"
  | "ANALYZER"
  | "SITEMAP"
  | "FEED"
  | "ADS"
  | "LANDING_PAGE";

export type ProductComplianceBlocker = {
  type: ProductComplianceBlockerType;
  field: string;
  reason: string;
  match?: string;
};

export type ProductComplianceCategory = {
  handle?: string | null;
  storefronts?: string[] | null;
  parent?: {
    handle?: string | null;
    storefronts?: string[] | null;
  } | null;
};

export type ProductComplianceInput = {
  title?: string | null;
  handle?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  manufacturer?: string | null;
  storefronts?: string[] | null;
  complianceStatus?: ProductComplianceStatus | null;
  complianceCountryAllowlist?: string[] | null;
  complianceCountryDenylist?: string[] | null;
  complianceAgeGateRequired?: boolean | null;
  complianceFeedEligible?: boolean | null;
  complianceAdsEligible?: boolean | null;
  complianceManualBlockers?: string[] | null;
  merchantCertificationAuthority?: string | null;
  merchantCertificationName?: string | null;
  merchantCertificationCode?: string | null;
  merchantCertificationValue?: string | null;
  mainCategory?: ProductComplianceCategory | null;
  categories?: Array<
    | ProductComplianceCategory
    | {
        category: ProductComplianceCategory;
      }
  > | null;
};

export type ProductComplianceEligibility = {
  allowed: boolean;
  status: ProductComplianceStatus;
  blockers: ProductComplianceBlocker[];
};

const GROW_STOREFRONT = "GROW";
const GROW_RESTRICTED_CATEGORY_HANDLES = new Set([
  "headshop",
  "aschenbecher",
  "aufbewahrung",
  "bongs",
  "feuerzeuge",
  "filter",
  "grinder",
  "kraeuterschale",
  "hash-bowl",
  "papers",
  "pipes",
  "rolling-tray",
  "tubes",
  "vaporizer",
  "waagen",
  "seeds",
]);

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";
const normalizeCountry = (value?: string | null) => value?.trim().toUpperCase() ?? "";
const includesGrowStorefront = (storefronts?: string[] | null) =>
  Array.isArray(storefronts) && storefronts.includes(GROW_STOREFRONT);
const isRestrictedCategoryHandle = (handle?: string | null) =>
  GROW_RESTRICTED_CATEGORY_HANDLES.has(normalize(handle));

const unwrapCategory = (
  entry:
    | ProductComplianceCategory
    | { category: ProductComplianceCategory },
) => ("category" in entry ? entry.category : entry);

const collectCategories = (product: ProductComplianceInput) => {
  const categories: ProductComplianceCategory[] = [];
  if (product.mainCategory) categories.push(product.mainCategory);
  for (const entry of product.categories ?? []) {
    categories.push(unwrapCategory(entry));
  }
  return categories;
};

const hasCertification = (product: ProductComplianceInput) =>
  Boolean(
    product.merchantCertificationAuthority?.trim() ||
      product.merchantCertificationName?.trim() ||
      product.merchantCertificationCode?.trim() ||
      product.merchantCertificationValue?.trim(),
  );

export function normalizeProductComplianceStatus(
  value?: string | null,
): ProductComplianceStatus {
  return PRODUCT_COMPLIANCE_STATUSES.includes(value as ProductComplianceStatus)
    ? (value as ProductComplianceStatus)
    : "DRAFT_REVIEW";
}

export function collectProductComplianceBlockers(
  product: ProductComplianceInput,
): ProductComplianceBlocker[] {
  const blockers: ProductComplianceBlocker[] = [];
  const textViolations = collectMerchantPolicyViolations({
    title: product.title,
    handle: product.handle,
    description: product.description,
    shortDescription: product.shortDescription,
    manufacturer: product.manufacturer,
  });

  for (const violation of textViolations) {
    blockers.push({
      type:
        violation.reason === "medical_claim"
          ? "MEDICAL_CLAIM"
          : "ILLEGAL_USE_IMPLICATION",
      field: violation.field,
      reason: violation.reason,
      match: violation.match,
    });
  }

  if (includesGrowStorefront(product.storefronts)) {
    for (const category of collectCategories(product)) {
      if (
        isRestrictedCategoryHandle(category.handle) ||
        isRestrictedCategoryHandle(category.parent?.handle)
      ) {
        blockers.push({
          type: "RESTRICTED_CATEGORY",
          field: "categories",
          reason: "Restricted category is not allowed on GrowVault.",
          match: category.handle ?? category.parent?.handle ?? undefined,
        });
      }
    }
  }

  for (const manualBlocker of product.complianceManualBlockers ?? []) {
    const reason = manualBlocker.trim();
    if (!reason) continue;
    blockers.push({
      type: "MANUAL",
      field: "complianceManualBlockers",
      reason,
    });
  }

  if (
    (product.complianceFeedEligible || product.complianceAdsEligible) &&
    includesGrowStorefront(product.storefronts) &&
    !hasCertification(product)
  ) {
    blockers.push({
      type: "MISSING_CERTIFICATION",
      field: "merchantCertification",
      reason: "Feed or ads eligibility needs certification metadata for review.",
    });
  }

  return blockers;
}

export function getProductComplianceEligibility(
  product: ProductComplianceInput,
  options: {
    storefront: "MAIN" | "GROW";
    surface: ProductComplianceSurface;
    country?: string | null;
  },
): ProductComplianceEligibility {
  const status = normalizeProductComplianceStatus(product.complianceStatus);
  const blockers = [...collectProductComplianceBlockers(product)];
  const country = normalizeCountry(options.country);
  const allowlist = (product.complianceCountryAllowlist ?? []).map(normalizeCountry).filter(Boolean);
  const denylist = (product.complianceCountryDenylist ?? []).map(normalizeCountry).filter(Boolean);

  if (status === "BLOCKED") {
    blockers.push({
      type: "MANUAL",
      field: "complianceStatus",
      reason: "Product is blocked.",
    });
  }

  if (status === "NEEDS_CHANGES") {
    blockers.push({
      type: "MANUAL",
      field: "complianceStatus",
      reason: "Product needs compliance changes before public exposure.",
    });
  }

  if (status !== "APPROVED") {
    blockers.push({
      type: "MANUAL",
      field: "complianceStatus",
      reason: "Product is not compliance-approved.",
    });
  }

  if (options.surface === "FEED" && !product.complianceFeedEligible) {
    blockers.push({
      type: "FEED_POLICY",
      field: "complianceFeedEligible",
      reason: "Product is not eligible for feed output.",
    });
  }

  if (options.surface === "ADS" && !product.complianceAdsEligible) {
    blockers.push({
      type: "AD_POLICY",
      field: "complianceAdsEligible",
      reason: "Product is not eligible for ads.",
    });
  }

  if (country && denylist.includes(country)) {
    blockers.push({
      type: "REGION_RESTRICTION",
      field: "complianceCountryDenylist",
      reason: `Product is blocked in ${country}.`,
      match: country,
    });
  }

  if (allowlist.length > 0 && (!country || !allowlist.includes(country))) {
    blockers.push({
      type: "REGION_RESTRICTION",
      field: "complianceCountryAllowlist",
      reason: country
        ? `Product is not allowlisted for ${country}.`
        : "Product requires a known allowed country.",
      match: country || undefined,
    });
  }

  return {
    allowed: blockers.length === 0,
    status,
    blockers,
  };
}

export function canExposeProductOnSurface(
  product: ProductComplianceInput,
  options: {
    storefront: "MAIN" | "GROW";
    surface: ProductComplianceSurface;
    country?: string | null;
  },
) {
  return getProductComplianceEligibility(product, options).allowed;
}

export function approvalRequiresOverride(product: ProductComplianceInput) {
  return collectProductComplianceBlockers(product).length > 0;
}

