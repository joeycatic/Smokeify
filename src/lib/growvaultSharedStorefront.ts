import "server-only";

import { AdminAlertStatus } from "@prisma/client";
import type { DerivedAdminAlert } from "@/lib/adminAlerts";
import { prisma } from "@/lib/prisma";
import { resolveLandingPageProductSections } from "@/lib/landingPageConfig";

export const SHARED_STOREFRONT_CONTRACT_VERSION = "2026-04-21";

export type SharedDiagnosticsStatusEntry = {
  key: string;
  status: "ok" | "warn" | "fail" | "unknown";
  summary: string;
  updatedAt: string;
  source: string;
  actionUrl?: string;
};

export type SharedMerchandisingSlot = {
  id: string;
  updatedAt: string;
  source: string;
  schemaVersion: string;
  slotKey: string;
  status: "live" | "draft" | "scheduled" | "fallback";
  audience: string[];
  copy: {
    eyebrow: string | null;
    title: string | null;
    description: string | null;
  } | null;
  cta: {
    label: string | null;
    href: string | null;
  } | null;
  media: {
    imageUrl: string | null;
    imageAlt: string | null;
  } | null;
  productHandles: string[];
  collectionHandles: string[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

const GROW_STOREFRONT = "GROW" as const;
const CATALOG_STALE_HOURS = 72;

function buildAdminUrl(pathname: string) {
  return new URL(pathname, "https://www.smokeify.de").toString();
}

function toStatusEntry(
  key: string,
  status: SharedDiagnosticsStatusEntry["status"],
  summary: string,
  updatedAt: Date,
  actionUrl?: string,
): SharedDiagnosticsStatusEntry {
  return {
    key,
    status,
    summary,
    updatedAt: updatedAt.toISOString(),
    source: "smokeify",
    actionUrl,
  };
}

function getAnalyzerQueueStatus(reviewStatus: string) {
  if (reviewStatus === "REVIEWED_OK") return "resolved" as const;
  if (reviewStatus === "REVIEWED_UNSAFE" || reviewStatus === "REVIEWED_INCORRECT") {
    return "in_review" as const;
  }
  if (
    reviewStatus === "NEEDS_PROMPT_FIX" ||
    reviewStatus === "NEEDS_RECOMMENDATION_FIX"
  ) {
    return "rerun_requested" as const;
  }
  if (reviewStatus === "PRIVACY_REVIEW") return "in_review" as const;
  return "new" as const;
}

export async function getGrowvaultSharedDiagnosticsFeed() {
  const now = new Date();
  const [
    growProducts,
    growProductsWithCollections,
    latestGrowProduct,
    analyzerBacklog,
    reviewedAnalyzerCases,
    activeAlertCount,
  ] = await Promise.all([
    prisma.product.count({ where: { storefronts: { has: GROW_STOREFRONT } } }),
    prisma.product.count({
      where: {
        storefronts: { has: GROW_STOREFRONT },
        collections: { some: {} },
      },
    }),
    prisma.product.findFirst({
      where: { storefronts: { has: GROW_STOREFRONT } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.plantAnalysisRun.count({
      where: {
        reviewStatus: {
          in: [
            "UNREVIEWED",
            "REVIEWED_INCORRECT",
            "REVIEWED_UNSAFE",
            "NEEDS_PROMPT_FIX",
            "NEEDS_RECOMMENDATION_FIX",
            "PRIVACY_REVIEW",
          ],
        },
      },
    }),
    prisma.plantAnalysisRun.count({
      where: {
        reviewedAt: { not: null },
      },
    }),
    prisma.adminAlert.count({
      where: {
        signalActive: true,
        status: { not: AdminAlertStatus.RESOLVED },
      },
    }),
  ]);

  const latestAgeHours = latestGrowProduct?.updatedAt
    ? (Date.now() - latestGrowProduct.updatedAt.getTime()) / (60 * 60 * 1000)
    : Number.POSITIVE_INFINITY;
  const collectionCoverage = growProducts > 0 ? growProductsWithCollections / growProducts : 0;

  const statuses: SharedDiagnosticsStatusEntry[] = [
    toStatusEntry(
      "smokeify.growvault.catalog.freshness",
      latestGrowProduct
        ? latestAgeHours <= CATALOG_STALE_HOURS
          ? "ok"
          : "warn"
        : "unknown",
      latestGrowProduct
        ? `Latest GROW catalog update is ${Math.round(latestAgeHours)} hours old.`
        : "No GROW storefront products are currently assigned.",
      now,
      buildAdminUrl("/admin/catalog?storefront=GROW"),
    ),
    toStatusEntry(
      "smokeify.growvault.collection.completeness",
      collectionCoverage >= 0.9 ? "ok" : collectionCoverage >= 0.7 ? "warn" : "fail",
      growProducts === 0
        ? "No GROW storefront products are currently assigned."
        : `${growProductsWithCollections}/${growProducts} GROW products have at least one collection assignment.`,
      now,
      buildAdminUrl("/admin/catalog?storefront=GROW"),
    ),
    toStatusEntry(
      "smokeify.growvault.discount.integrity",
      process.env.STRIPE_SECRET_KEY ? "ok" : "unknown",
      process.env.STRIPE_SECRET_KEY
        ? "Stripe-backed discount management is configured."
        : "Stripe-backed discount validation is unavailable until STRIPE_SECRET_KEY is configured.",
      now,
      buildAdminUrl("/admin/discounts"),
    ),
    toStatusEntry(
      "smokeify.growvault.analyzer.handoff",
      analyzerBacklog === 0 ? "ok" : analyzerBacklog <= 10 ? "warn" : "fail",
      analyzerBacklog === 0
        ? `Analyzer queue is clear. ${reviewedAnalyzerCases} cases have review history.`
        : `${analyzerBacklog} analyzer cases still need review or rerun handling.`,
      now,
      buildAdminUrl("/admin/analyzer"),
    ),
    toStatusEntry(
      "smokeify.growvault.alerts.active",
      activeAlertCount === 0 ? "ok" : activeAlertCount <= 10 ? "warn" : "fail",
      activeAlertCount === 0
        ? "No active operational alerts are open."
        : `${activeAlertCount} operational alerts are currently active.`,
      now,
      buildAdminUrl("/admin/alerts"),
    ),
  ];

  return {
    schemaVersion: SHARED_STOREFRONT_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    source: "smokeify",
    statuses,
  };
}

export async function getGrowvaultSharedMerchandisingFeed() {
  const sections = await resolveLandingPageProductSections(GROW_STOREFRONT);
  const now = new Date();

  const slots: SharedMerchandisingSlot[] = [
    {
      id: "growvault-home-hero",
      updatedAt: now.toISOString(),
      source: "smokeify",
      schemaVersion: SHARED_STOREFRONT_CONTRACT_VERSION,
      slotKey: "hero",
      status: "live",
      audience: ["grow", "homepage"],
      copy: {
        eyebrow: "Shared hero",
        title: "Homepage hero products",
        description: "Products rendered in the Growvault homepage hero.",
      },
      cta: {
        label: "Open landing page",
        href: buildAdminUrl("/admin/landing-page?storefront=GROW"),
      },
      media: null,
      productHandles: sections.heroProducts.map((product) => product.handle),
      collectionHandles: [],
      effectiveFrom: null,
      effectiveTo: null,
    },
    {
      id: "growvault-home-tent-deals",
      updatedAt: now.toISOString(),
      source: "smokeify",
      schemaVersion: SHARED_STOREFRONT_CONTRACT_VERSION,
      slotKey: "tent-deals",
      status: "live",
      audience: ["grow", "homepage"],
      copy: {
        eyebrow: "Shared deals",
        title: "Tent deal products",
        description: "Products rendered in the Growvault tent deals block.",
      },
      cta: {
        label: "Open landing page",
        href: buildAdminUrl("/admin/landing-page?storefront=GROW"),
      },
      media: null,
      productHandles: sections.tentProducts.map((product) => product.handle),
      collectionHandles: [],
      effectiveFrom: null,
      effectiveTo: null,
    },
    {
      id: "growvault-home-bestsellers",
      updatedAt: now.toISOString(),
      source: "smokeify",
      schemaVersion: SHARED_STOREFRONT_CONTRACT_VERSION,
      slotKey: "bestsellers",
      status: "live",
      audience: ["grow", "homepage"],
      copy: {
        eyebrow: "Shared bestsellers",
        title: "Homepage bestseller products",
        description: "Products rendered in the Growvault bestseller grid.",
      },
      cta: {
        label: "Open landing page",
        href: buildAdminUrl("/admin/landing-page?storefront=GROW"),
      },
      media: null,
      productHandles: sections.bestSellerProducts.map((product) => product.handle),
      collectionHandles: [],
      effectiveFrom: null,
      effectiveTo: null,
    },
  ];

  return {
    schemaVersion: SHARED_STOREFRONT_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    source: "smokeify",
    slots,
  };
}

export async function buildGrowvaultAnalyzerCaseContract(runId: string) {
  const run = await prisma.plantAnalysisRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      createdAt: true,
      confidence: true,
      healthStatus: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewNotes: true,
      safetyFlags: true,
      outputJson: true,
    },
  });

  if (!run) return null;

  const output = (run.outputJson ?? {}) as Record<string, unknown>;
  const reviewedCase = (output.reviewedCase ?? null) as
    | Record<string, unknown>
    | null;

  return {
    id: run.id,
    updatedAt: (run.reviewedAt ?? run.createdAt).toISOString(),
    source: "smokeify",
    schemaVersion: SHARED_STOREFRONT_CONTRACT_VERSION,
    runId: run.id,
    reviewStatus: run.reviewStatus,
    queueStatus: getAnalyzerQueueStatus(run.reviewStatus),
    confidence: run.confidence,
    healthStatus: run.healthStatus,
    qualityLabels: run.safetyFlags,
    reviewedAt: run.reviewedAt?.toISOString() ?? null,
    reviewNotes: run.reviewNotes ?? null,
    override:
      reviewedCase && typeof reviewedCase === "object" && "override" in reviewedCase
        ? (reviewedCase.override as Record<string, unknown> | null)
        : null,
  };
}

export function buildGrowvaultDiagnosticAlerts(
  statuses: SharedDiagnosticsStatusEntry[],
): DerivedAdminAlert[] {
  return statuses
    .filter((status) => status.status === "warn" || status.status === "fail")
    .map((status) => ({
      type: `growvault_${status.key.replaceAll(".", "_")}`,
      title: `Growvault: ${status.key}`,
      detail: status.summary,
      priority: status.status === "fail" ? "high" : "medium",
      actionLabel: "Open Growvault diagnostics",
      href: "/admin/growvault",
      category: "Growvault",
      dedupeKey: `growvault::${status.key}`,
    }));
}
