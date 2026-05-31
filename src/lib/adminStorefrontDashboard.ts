import "server-only";

import { getFinancePageData } from "@/lib/adminAddonData";
import { getAdminStorefrontInsights, type AdminStorefrontInsights } from "@/lib/adminGrowvaultInsights";
import { PAID_ORDER_STATUSES } from "@/lib/adminInsights";
import { getAdminTimeWindowStart, type AdminTimeRangeDays } from "@/lib/adminTimeRange";
import { prisma } from "@/lib/prisma";
import { STOREFRONT_LABELS, type StorefrontCode } from "@/lib/storefronts";

export type AdminStorefrontDashboardInput = {
  storefront: StorefrontCode;
  days: AdminTimeRangeDays;
};

export type AdminStorefrontDashboardData = {
  storefront: StorefrontCode;
  storefrontLabel: string;
  days: AdminTimeRangeDays;
  insights: AdminStorefrontInsights;
  finance: Awaited<ReturnType<typeof getFinancePageData>>;
  catalog: {
    totalProductCount: number;
    activeProductCount: number;
    draftProductCount: number;
    exclusiveProductCount: number;
    categoryCount: number;
  };
  landingPage: {
    sectionCount: number;
    manualSectionCount: number;
    draftManualSectionCount: number;
    scheduledSectionCount: number;
    lastPublishedAt: string | null;
  };
  orders: {
    totalOrderCount: number;
    paidOrderCount: number;
  };
  links: {
    analytics: string;
    catalog: string;
    catalogHygiene: string;
    finance: string;
    landingPage: string;
    orders: string;
    reports: string;
    reviews: string;
  };
};

const buildScopedAdminHref = (pathname: string, storefront: StorefrontCode) =>
  `${pathname}?storefront=${storefront}`;

export async function getAdminStorefrontDashboardData({
  storefront,
  days,
}: AdminStorefrontDashboardInput): Promise<AdminStorefrontDashboardData> {
  const rangeStart = getAdminTimeWindowStart(days);
  const otherStorefront: StorefrontCode = storefront === "MAIN" ? "GROW" : "MAIN";

  const [
    insights,
    finance,
    totalProductCount,
    activeProductCount,
    draftProductCount,
    exclusiveProductCount,
    categoryCount,
    landingSections,
    totalOrderCount,
    paidOrderCount,
  ] = await Promise.all([
    getAdminStorefrontInsights(days, storefront),
    getFinancePageData(days, storefront),
    prisma.product.count({ where: { storefronts: { has: storefront } } }),
    prisma.product.count({
      where: { storefronts: { has: storefront }, status: "ACTIVE" },
    }),
    prisma.product.count({
      where: { storefronts: { has: storefront }, status: "DRAFT" },
    }),
    prisma.product.count({
      where: {
        storefronts: { has: storefront },
        NOT: { storefronts: { has: otherStorefront } },
      },
    }),
    prisma.category.count({ where: { storefronts: { has: storefront } } }),
    prisma.landingPageSection.findMany({
      where: { storefront },
      select: {
        draftIsManual: true,
        isManual: true,
        lastPublishedAt: true,
        scheduledPublishAt: true,
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: rangeStart },
        sourceStorefront: storefront,
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: rangeStart },
        sourceStorefront: storefront,
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
    }),
  ]);

  const lastPublishedAt =
    landingSections
      .map((section) => section.lastPublishedAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0]
      ?.toISOString() ?? null;

  return {
    storefront,
    storefrontLabel: STOREFRONT_LABELS[storefront],
    days,
    insights,
    finance,
    catalog: {
      activeProductCount,
      categoryCount,
      draftProductCount,
      exclusiveProductCount,
      totalProductCount,
    },
    landingPage: {
      draftManualSectionCount: landingSections.filter((section) => section.draftIsManual)
        .length,
      lastPublishedAt,
      manualSectionCount: landingSections.filter((section) => section.isManual).length,
      scheduledSectionCount: landingSections.filter((section) => section.scheduledPublishAt)
        .length,
      sectionCount: landingSections.length,
    },
    orders: {
      paidOrderCount,
      totalOrderCount,
    },
    links: {
      analytics: buildScopedAdminHref("/admin/analytics", storefront),
      catalog: buildScopedAdminHref("/admin/catalog", storefront),
      catalogHygiene: buildScopedAdminHref("/admin/catalog/hygiene", storefront),
      finance: buildScopedAdminHref("/admin/finance", storefront),
      landingPage: buildScopedAdminHref("/admin/landing-page", storefront),
      orders: buildScopedAdminHref("/admin/orders", storefront),
      reports: buildScopedAdminHref("/admin/reports", storefront),
      reviews: buildScopedAdminHref("/admin/reviews", storefront),
    },
  };
}
