import "server-only";

import type { ProductComplianceStatus, ProductStatus, Storefront } from "@prisma/client";
import type { DerivedAdminAlert } from "@/lib/adminAlerts";
import { collectProductComplianceBlockers } from "@/lib/productCompliance";
import { prisma } from "@/lib/prisma";

export const CATALOG_HYGIENE_PAGE_SIZE = 50;

export const CATALOG_HYGIENE_ISSUE_TYPES = [
  "missing_image",
  "missing_technical_details",
  "missing_seller_url",
  "missing_variant_cost",
  "compliance_blocked",
] as const;

export type CatalogHygieneIssueType = (typeof CATALOG_HYGIENE_ISSUE_TYPES)[number];

export type CatalogHygieneFilters = {
  q: string;
  issueType: "" | CatalogHygieneIssueType;
  storefront: "" | Storefront;
  status: "" | ProductStatus;
  supplierPresence: "" | "WITH_SUPPLIER" | "WITHOUT_SUPPLIER";
  page: number;
};

export type CatalogHygieneIssue = {
  productId: string;
  title: string;
  handle: string;
  status: ProductStatus;
  storefronts: Storefront[];
  supplier: string | null;
  sellerUrl: string | null;
  imageUrl: string | null;
  technicalDetails: string | null;
  complianceStatus: ProductComplianceStatus;
  issues: Array<{
    type: CatalogHygieneIssueType;
    label: string;
    detail: string;
  }>;
};

const ISSUE_METADATA: Record<
  CatalogHygieneIssueType,
  { label: string; detail: string; href: string; category: string }
> = {
  missing_image: {
    label: "Missing image",
    detail: "No primary product image is available.",
    href: "/admin/catalog",
    category: "catalog_hygiene",
  },
  missing_technical_details: {
    label: "Missing technical details",
    detail: "Technical details are empty.",
    href: "/admin/catalog",
    category: "catalog_hygiene",
  },
  missing_seller_url: {
    label: "Missing seller URL",
    detail: "Supplier-linked product is missing its seller URL.",
    href: "/admin/catalog",
    category: "catalog_hygiene",
  },
  missing_variant_cost: {
    label: "Missing variant cost",
    detail: "One or more variants have zero or missing cost.",
    href: "/admin/catalog",
    category: "catalog_hygiene",
  },
  compliance_blocked: {
    label: "Compliance blocked",
    detail: "Compliance review is incomplete or blockers are still present.",
    href: "/admin/compliance",
    category: "catalog_hygiene",
  },
};

const readParam = (
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) => {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return typeof value === "string" ? value.trim() : "";
};

export function parseCatalogHygieneFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): CatalogHygieneFilters {
  const issueType = readParam(searchParams, "issueType");
  const storefront = readParam(searchParams, "storefront").toUpperCase();
  const status = readParam(searchParams, "status").toUpperCase();
  const supplierPresence = readParam(searchParams, "supplierPresence").toUpperCase();
  const page = Number.parseInt(readParam(searchParams, "page"), 10);

  return {
    q: readParam(searchParams, "q"),
    issueType: CATALOG_HYGIENE_ISSUE_TYPES.includes(issueType as CatalogHygieneIssueType)
      ? (issueType as CatalogHygieneIssueType)
      : "",
    storefront: storefront === "MAIN" || storefront === "GROW" ? (storefront as Storefront) : "",
    status:
      status === "DRAFT" || status === "ACTIVE" || status === "ARCHIVED"
        ? (status as ProductStatus)
        : "",
    supplierPresence:
      supplierPresence === "WITH_SUPPLIER" || supplierPresence === "WITHOUT_SUPPLIER"
        ? (supplierPresence as CatalogHygieneFilters["supplierPresence"])
        : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function buildWhere(filters: CatalogHygieneFilters) {
  const and: Array<Record<string, unknown>> = [];

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { handle: { contains: filters.q, mode: "insensitive" } },
        { manufacturer: { contains: filters.q, mode: "insensitive" } },
        { supplier: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  if (filters.storefront) {
    and.push({ storefronts: { has: filters.storefront } });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.supplierPresence === "WITH_SUPPLIER") {
    and.push({
      OR: [{ supplier: { not: null } }, { supplierId: { not: null } }],
    });
  }

  if (filters.supplierPresence === "WITHOUT_SUPPLIER") {
    and.push({
      supplier: null,
      supplierId: null,
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

function deriveIssues(product: {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  shortDescription: string | null;
  manufacturer: string | null;
  status: ProductStatus;
  storefronts: Storefront[];
  supplier: string | null;
  supplierId: string | null;
  sellerUrl: string | null;
  technicalDetails: string | null;
  complianceStatus: ProductComplianceStatus;
  complianceCountryAllowlist: string[];
  complianceCountryDenylist: string[];
  complianceAgeGateRequired: boolean;
  complianceFeedEligible: boolean;
  complianceAdsEligible: boolean;
  complianceManualBlockers: string[];
  merchantCertificationAuthority: string | null;
  merchantCertificationName: string | null;
  merchantCertificationCode: string | null;
  merchantCertificationValue: string | null;
  mainCategory: {
    handle: string;
    storefronts: Storefront[];
    parent: {
      handle: string;
      storefronts: Storefront[];
    } | null;
  } | null;
  categories: Array<{
    category: {
      handle: string;
      storefronts: Storefront[];
      parent: {
        handle: string;
        storefronts: Storefront[];
      } | null;
    };
  }>;
  images: Array<{ url: string }>;
  variants: Array<{ id: string; costCents: number }>;
}) {
  const issues: CatalogHygieneIssue["issues"] = [];

  if (product.images.length === 0) {
    issues.push({
      type: "missing_image",
      label: ISSUE_METADATA.missing_image.label,
      detail: ISSUE_METADATA.missing_image.detail,
    });
  }

  if (!product.technicalDetails?.trim()) {
    issues.push({
      type: "missing_technical_details",
      label: ISSUE_METADATA.missing_technical_details.label,
      detail: ISSUE_METADATA.missing_technical_details.detail,
    });
  }

  if ((product.supplier?.trim() || product.supplierId) && !product.sellerUrl?.trim()) {
    issues.push({
      type: "missing_seller_url",
      label: ISSUE_METADATA.missing_seller_url.label,
      detail: ISSUE_METADATA.missing_seller_url.detail,
    });
  }

  if (product.variants.some((variant) => variant.costCents <= 0)) {
    issues.push({
      type: "missing_variant_cost",
      label: ISSUE_METADATA.missing_variant_cost.label,
      detail: ISSUE_METADATA.missing_variant_cost.detail,
    });
  }

  const complianceBlockers = collectProductComplianceBlockers({
    title: product.title,
    handle: product.handle,
    description: product.description,
    shortDescription: product.shortDescription,
    manufacturer: product.manufacturer,
    storefronts: product.storefronts,
    complianceStatus: product.complianceStatus,
    complianceCountryAllowlist: product.complianceCountryAllowlist,
    complianceCountryDenylist: product.complianceCountryDenylist,
    complianceAgeGateRequired: product.complianceAgeGateRequired,
    complianceFeedEligible: product.complianceFeedEligible,
    complianceAdsEligible: product.complianceAdsEligible,
    complianceManualBlockers: product.complianceManualBlockers,
    merchantCertificationAuthority: product.merchantCertificationAuthority,
    merchantCertificationName: product.merchantCertificationName,
    merchantCertificationCode: product.merchantCertificationCode,
    merchantCertificationValue: product.merchantCertificationValue,
    mainCategory: product.mainCategory,
    categories: product.categories,
  });
  if (product.complianceStatus !== "APPROVED" || complianceBlockers.length > 0) {
    issues.push({
      type: "compliance_blocked",
      label: ISSUE_METADATA.compliance_blocked.label,
      detail:
        complianceBlockers[0]?.reason ??
        ISSUE_METADATA.compliance_blocked.detail,
    });
  }

  return issues;
}

export async function listCatalogHygieneIssues(filters: CatalogHygieneFilters) {
  const rows = await prisma.product.findMany({
    where: buildWhere(filters),
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      handle: true,
      description: true,
      shortDescription: true,
      manufacturer: true,
      status: true,
      storefronts: true,
      supplier: true,
      supplierId: true,
      sellerUrl: true,
      technicalDetails: true,
      complianceStatus: true,
      complianceCountryAllowlist: true,
      complianceCountryDenylist: true,
      complianceAgeGateRequired: true,
      complianceFeedEligible: true,
      complianceAdsEligible: true,
      complianceManualBlockers: true,
      merchantCertificationAuthority: true,
      merchantCertificationName: true,
      merchantCertificationCode: true,
      merchantCertificationValue: true,
      mainCategory: {
        select: {
          handle: true,
          storefronts: true,
          parent: {
            select: {
              handle: true,
              storefronts: true,
            },
          },
        },
      },
      categories: {
        select: {
          category: {
            select: {
              handle: true,
              storefronts: true,
              parent: {
                select: {
                  handle: true,
                  storefronts: true,
                },
              },
            },
          },
        },
      },
      images: {
        take: 1,
        orderBy: { position: "asc" },
        select: { url: true },
      },
      variants: {
        select: {
          id: true,
          costCents: true,
        },
      },
    },
  });

  const issues = rows
    .map((product) => {
      const productIssues = deriveIssues(product);
      return {
        productId: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        storefronts: product.storefronts,
        supplier: product.supplier,
        sellerUrl: product.sellerUrl,
        imageUrl: product.images[0]?.url ?? null,
        technicalDetails: product.technicalDetails,
        complianceStatus: product.complianceStatus,
        issues: productIssues,
      } satisfies CatalogHygieneIssue;
    })
    .filter((product) => product.issues.length > 0)
    .filter((product) =>
      filters.issueType
        ? product.issues.some((issue) => issue.type === filters.issueType)
        : true,
    );

  const counts = Object.fromEntries(
    CATALOG_HYGIENE_ISSUE_TYPES.map((type) => [type, 0]),
  ) as Record<CatalogHygieneIssueType, number>;
  for (const product of issues) {
    for (const issue of product.issues) {
      counts[issue.type] += 1;
    }
  }

  const start = (filters.page - 1) * CATALOG_HYGIENE_PAGE_SIZE;
  const pageRows = issues.slice(start, start + CATALOG_HYGIENE_PAGE_SIZE);

  return {
    filters,
    counts,
    totalRows: issues.length,
    hasNextPage: start + CATALOG_HYGIENE_PAGE_SIZE < issues.length,
    rows: pageRows,
  };
}

function buildAdminUrl(pathname: string) {
  return new URL(pathname, "https://www.smokeify.de").toString();
}

export async function buildCatalogHygieneAlerts(): Promise<DerivedAdminAlert[]> {
  const result = await listCatalogHygieneIssues(
    parseCatalogHygieneFilters(undefined),
  );

  return CATALOG_HYGIENE_ISSUE_TYPES.flatMap((type) => {
    const count = result.counts[type];
    if (count <= 0) return [];
    const meta = ISSUE_METADATA[type];
    return [
      {
        type: `catalog_hygiene.${type}`,
        category: meta.category,
        priority: type === "compliance_blocked" ? "high" : "medium",
        dedupeKey: `catalog_hygiene::${type}`,
        title: `${count} catalog items need attention`,
        detail: `${count} items are flagged for ${meta.label.toLowerCase()}.`,
        href:
          type === "compliance_blocked"
            ? buildAdminUrl("/admin/compliance")
            : buildAdminUrl(`/admin/catalog/hygiene?issueType=${type}`),
        actionLabel: type === "compliance_blocked" ? "Open compliance" : "Open hygiene queue",
      } satisfies DerivedAdminAlert,
    ];
  });
}
