import type { Storefront } from "@prisma/client";
import type { AdminTimeRangeDays } from "@/lib/adminTimeRange";
import {
  PAID_ORDER_STATUSES,
  getActiveSessionSnapshot,
  getCustomerRevenueMix,
  getDateDaysAgo,
  getFunnelComparison,
  getFunnelSnapshot,
  getFunnelTrend,
  getOrderComparisons,
  getProductPerformance,
} from "@/lib/adminInsights";
import { getFinancePageData } from "@/lib/adminAddonData";
import { prisma } from "@/lib/prisma";

const buildScopedOrderFilter = (storefront: Storefront | null) =>
  storefront ? { sourceStorefront: storefront } : {};

const buildScopedEventFilter = (storefront: Storefront | null) =>
  storefront ? { storefront } : {};

export async function loadAdminAnalyticsOverview(
  days: AdminTimeRangeDays = 30,
  storefront: Storefront | null = null,
) {
  const now = new Date();
  const currentWindowStart = getDateDaysAgo(days - 1);
  const totalVelocityWindowStart = getDateDaysAgo(29);

  const [
    activeSnapshot,
    funnelSnapshot,
    funnelComparison,
    funnelTrend,
    orderComparisons,
    customerRevenueMix,
    financePageData,
    totalOrders,
    fulfilledOrders,
    refundedOrders,
    canceledOrders,
    totalRevenue,
    recentOrders,
  ] = await Promise.all([
    getActiveSessionSnapshot(storefront),
    getFunnelSnapshot(days, storefront),
    getFunnelComparison(days, storefront),
    getFunnelTrend(days, storefront),
    getOrderComparisons(days, storefront),
    getCustomerRevenueMix(days, storefront),
    getFinancePageData(days, storefront),
    prisma.order.count({ where: buildScopedOrderFilter(storefront) }),
    prisma.order.count({ where: { status: "fulfilled", ...buildScopedOrderFilter(storefront) } }),
    prisma.order.count({
      where: { paymentStatus: "refunded", ...buildScopedOrderFilter(storefront) },
    }),
    prisma.order.count({ where: { status: "canceled", ...buildScopedOrderFilter(storefront) } }),
    prisma.order.aggregate({
      where: {
        paymentStatus: { in: PAID_ORDER_STATUSES },
        ...buildScopedOrderFilter(storefront),
      },
      _sum: { amountTotal: true },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: totalVelocityWindowStart },
        ...buildScopedOrderFilter(storefront),
      },
      select: {
        createdAt: true,
        amountTotal: true,
        paymentStatus: true,
        paymentMethod: true,
        userId: true,
        amountDiscount: true,
        discountCode: true,
        amountRefunded: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const orderVelocity = {
    today: 0,
    last7Days: 0,
    last30Days: 0,
  };

  const paidRevenueCurrentWindow = recentOrders.reduce((sum, order) => {
    const paymentStatus = order.paymentStatus.trim().toLowerCase();
    const isPaid = PAID_ORDER_STATUSES.includes(paymentStatus);

    const diffDays = Math.floor(
      (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 0) orderVelocity.today += 1;
    if (diffDays < 7) orderVelocity.last7Days += 1;
    if (diffDays < 30) orderVelocity.last30Days += 1;

    if (order.createdAt < currentWindowStart) return sum;
    if (!isPaid) return sum;
    return sum + order.amountTotal;
  }, 0);

  return {
    scope: {
      days,
      storefront,
      currentStart: financePageData.currentStart,
      currentEnd: financePageData.currentEnd,
    },
    live: activeSnapshot,
    funnel: {
      ...funnelSnapshot,
      totalOrders,
      fulfilledOrders,
      refundedOrders,
      canceledOrders,
    },
    funnelComparison,
    funnelTrend,
    periodComparison: {
      currency: orderComparisons.currency,
      revenue: orderComparisons.revenue,
      paidOrders: orderComparisons.paidOrders,
      aov: orderComparisons.aov,
      refundRate: orderComparisons.refundRate,
    },
    revenue: {
      totalCents: totalRevenue._sum.amountTotal ?? 0,
      last30DaysCents: paidRevenueCurrentWindow,
      newRevenueCents: customerRevenueMix.newRevenueCents,
      returningRevenueCents: customerRevenueMix.returningRevenueCents,
    },
    finance: financePageData.currentFinance,
    previousFinance: financePageData.previousFinance,
    vat: financePageData.vatSummary,
    expenseMigrationRequired: financePageData.expenseMigrationRequired,
    trends: {
      daily: funnelTrend.map((entry) => ({
        label: entry.label,
        revenueCents: entry.revenueCents,
        orders: entry.paidOrders,
      })),
      orderVelocity,
    },
  };
}

export async function loadAdminAnalyticsSecondary(
  days: AdminTimeRangeDays = 30,
  storefront: Storefront | null = null,
) {
  const rangeStart = getDateDaysAgo(days - 1);

  const [
    customerRevenueMix,
    productPerformance,
    variants,
    totalAnalyses,
    fallbackAnalyses,
    feedbackTotal,
    feedbackCorrect,
    lowConfidenceAnalyses,
    topIssueLabels,
    registeredCustomers,
    guestPaidCustomers,
    sourceSessions,
    sourceCheckouts,
    discountGroups,
    paymentGroups,
  ] = await Promise.all([
    getCustomerRevenueMix(days, storefront),
    getProductPerformance(days, storefront),
    prisma.variant.findMany({
      where: storefront
        ? {
            product: {
              storefronts: { has: storefront },
            },
          }
        : undefined,
      include: {
        product: { select: { id: true, title: true } },
        inventory: true,
      },
    }),
    prisma.plantAnalysisRun.count(),
    prisma.plantAnalysisRun.count({
      where: {
        model: {
          in: ["gpt-4o", process.env.AI_MODEL_STRONG ?? "gpt-4o"],
        },
      },
    }),
    prisma.plantAnalysisFeedback.count(),
    prisma.plantAnalysisFeedback.count({ where: { isCorrect: true } }),
    prisma.plantAnalysisRun.count({ where: { confidence: { lt: 0.65 } } }),
    prisma.plantAnalysisIssue.groupBy({
      by: ["label"],
      _count: { _all: true },
      orderBy: { _count: { label: "desc" } },
      take: 8,
    }),
    prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        orders: {
          where: {
            paymentStatus: { in: PAID_ORDER_STATUSES },
            ...buildScopedOrderFilter(storefront),
          },
          select: { amountTotal: true },
        },
      },
    }),
    prisma.order.groupBy({
      by: ["customerEmail"],
      where: {
        userId: null,
        paymentStatus: { in: PAID_ORDER_STATUSES },
        customerEmail: { not: null },
        ...buildScopedOrderFilter(storefront),
      },
      _sum: { amountTotal: true },
      _count: { id: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["utmSource", "utmMedium"],
      where: {
        createdAt: { gte: rangeStart },
        eventName: "page_view",
        ...buildScopedEventFilter(storefront),
      },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["utmSource", "utmMedium"],
      where: {
        createdAt: { gte: rangeStart },
        eventName: "begin_checkout",
        ...buildScopedEventFilter(storefront),
      },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["discountCode"],
      where: {
        createdAt: { gte: rangeStart },
        paymentStatus: { in: PAID_ORDER_STATUSES },
        discountCode: { not: null },
        ...buildScopedOrderFilter(storefront),
      },
      _count: { id: true },
      _sum: { amountTotal: true, amountDiscount: true },
      orderBy: { _sum: { amountTotal: "desc" } },
      take: 8,
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: {
        createdAt: { gte: rangeStart },
        paymentStatus: { in: PAID_ORDER_STATUSES },
        ...buildScopedOrderFilter(storefront),
      },
      _count: { id: true },
      _sum: { amountTotal: true, amountRefunded: true },
    }),
  ]);

  const stockouts = variants
    .map((variant) => {
      const onHand = variant.inventory?.quantityOnHand ?? 0;
      const reserved = variant.inventory?.reserved ?? 0;
      const available = Math.max(0, onHand - reserved);
      return {
        variantId: variant.id,
        sku: variant.sku ?? null,
        productId: variant.product?.id ?? null,
        productTitle: variant.product?.title ?? "Unknown product",
        variantTitle: variant.title,
        quantityOnHand: onHand,
        reserved,
        available,
      };
    })
    .filter((variant) => variant.available <= 0)
    .slice(0, 20);

  const lowStockCount = variants.reduce((count, variant) => {
    const onHand = variant.inventory?.quantityOnHand ?? 0;
    const reserved = variant.inventory?.reserved ?? 0;
    const available = Math.max(0, onHand - reserved);
    return available <= variant.lowStockThreshold ? count + 1 : count;
  }, 0);

  const repeatRegisteredCustomers = registeredCustomers.filter(
    (customer) => customer.orders.length >= 2,
  ).length;
  const highValueRegisteredCustomers = registeredCustomers.filter((customer) =>
    customer.orders.reduce((sum, order) => sum + order.amountTotal, 0) >= 25_000,
  ).length;
  const guestCustomerCount = guestPaidCustomers.length;
  const repeatGuestCustomers = guestPaidCustomers.filter(
    (customer) => customer._count.id >= 2,
  ).length;

  const topProducts = [...productPerformance]
    .sort((left, right) => right.revenueCents - left.revenueCents)
    .slice(0, 8);

  const underperformingProducts = [...productPerformance]
    .filter((item) => item.views >= 5)
    .sort((left, right) => {
      if (right.views !== left.views) return right.views - left.views;
      return left.conversionRate - right.conversionRate;
    })
    .slice(0, 8);

  const trafficSourceMap = new Map<
    string,
    { label: string; sessions: number; beginCheckout: number }
  >();
  for (const group of sourceSessions) {
    const label =
      group.utmSource && group.utmMedium
        ? `${group.utmSource} / ${group.utmMedium}`
        : group.utmSource
          ? group.utmSource
          : "Direct / unknown";
    const entry = trafficSourceMap.get(label) ?? {
      label,
      sessions: 0,
      beginCheckout: 0,
    };
    entry.sessions += group._count._all;
    trafficSourceMap.set(label, entry);
  }
  for (const group of sourceCheckouts) {
    const label =
      group.utmSource && group.utmMedium
        ? `${group.utmSource} / ${group.utmMedium}`
        : group.utmSource
          ? group.utmSource
          : "Direct / unknown";
    const entry = trafficSourceMap.get(label) ?? {
      label,
      sessions: 0,
      beginCheckout: 0,
    };
    entry.beginCheckout += group._count._all;
    trafficSourceMap.set(label, entry);
  }
  const trafficSources = Array.from(trafficSourceMap.values())
    .sort((left, right) => right.sessions - left.sessions)
    .slice(0, 8);

  const paymentAnalysis = paymentGroups
    .map((group) => ({
      method: group.paymentMethod ?? "unknown",
      orders: group._count.id,
      revenueCents: group._sum.amountTotal ?? 0,
      refundedCents: group._sum.amountRefunded ?? 0,
    }))
    .sort((left, right) => right.revenueCents - left.revenueCents);

  const discountAnalysis = discountGroups
    .filter((group): group is typeof group & { discountCode: string } => Boolean(group.discountCode))
    .map((group) => ({
      code: group.discountCode,
      orders: group._count.id,
      revenueCents: group._sum.amountTotal ?? 0,
      discountCents: group._sum.amountDiscount ?? 0,
    }));

  const totalCustomerCount = registeredCustomers.length + guestCustomerCount;
  const totalRepeatCustomers = repeatRegisteredCustomers + repeatGuestCustomers;

  return {
    scope: {
      days,
      storefront,
    },
    topProducts,
    underperformingProducts,
    stockouts,
    inventory: {
      stockoutCount: stockouts.length,
      lowStockCount,
      trackedVariants: variants.length,
    },
    customers: {
      registeredCount: registeredCustomers.length,
      guestCount: guestCustomerCount,
      repeatRegisteredCount: repeatRegisteredCustomers,
      repeatGuestCount: repeatGuestCustomers,
      highValueRegisteredCount: highValueRegisteredCustomers,
      newCustomerCount: customerRevenueMix.newCustomerCount,
      returningCustomerCount: customerRevenueMix.returningCustomerCount,
      repeatRate: totalCustomerCount > 0 ? totalRepeatCustomers / totalCustomerCount : 0,
    },
    trafficSources,
    discountAnalysis,
    paymentAnalysis,
    retention: {
      repeatCustomerRate:
        totalCustomerCount > 0 ? totalRepeatCustomers / totalCustomerCount : 0,
      newRevenueCents: customerRevenueMix.newRevenueCents,
      returningRevenueCents: customerRevenueMix.returningRevenueCents,
    },
    aiQuality: {
      totalAnalyses,
      fallbackRate: totalAnalyses > 0 ? fallbackAnalyses / totalAnalyses : 0,
      lowConfidenceRate: totalAnalyses > 0 ? lowConfidenceAnalyses / totalAnalyses : 0,
      feedbackTotal,
      feedbackCorrectRate: feedbackTotal > 0 ? feedbackCorrect / feedbackTotal : 0,
      topIssueLabels: topIssueLabels.map((row) => ({
        label: row.label,
        count: row._count._all,
      })),
    },
  };
}

export type AdminAnalyticsOverviewPayload = Awaited<
  ReturnType<typeof loadAdminAnalyticsOverview>
>;

export type AdminAnalyticsSecondaryPayload = Awaited<
  ReturnType<typeof loadAdminAnalyticsSecondary>
>;
