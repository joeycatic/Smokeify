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

const toComparisonDelta = (current: number, previous: number) =>
  previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0;

const getExecutiveMetrics = ({
  finance,
  previousFinance,
  periodComparison,
  funnel,
  funnelComparison,
  vat,
  liveVisitors,
}: {
  finance: Awaited<ReturnType<typeof getFinancePageData>>["currentFinance"];
  previousFinance: Awaited<ReturnType<typeof getFinancePageData>>["previousFinance"];
  periodComparison: Awaited<ReturnType<typeof getOrderComparisons>>;
  funnel: Awaited<ReturnType<typeof getFunnelSnapshot>>;
  funnelComparison: Awaited<ReturnType<typeof getFunnelComparison>>;
  vat: Awaited<ReturnType<typeof getFinancePageData>>["vatSummary"];
  liveVisitors: number;
}) => [
  {
    id: "netRevenue",
    label: "Net revenue",
    kind: "currency" as const,
    value: finance.netRevenueCents,
    deltaRatio: toComparisonDelta(finance.netRevenueCents, previousFinance.netRevenueCents),
    footnote: "after VAT and refunds",
    tone: "emerald" as const,
  },
  {
    id: "paidOrders",
    label: "Paid orders",
    kind: "count" as const,
    value: periodComparison.paidOrders.current,
    deltaRatio: periodComparison.paidOrders.deltaRatio,
    footnote: "recognized paid volume",
    tone: "slate" as const,
  },
  {
    id: "sessionCvr",
    label: "Session CVR",
    kind: "percent" as const,
    value: funnel.sessionToOrderRate,
    deltaRatio: funnelComparison.sessionToOrderRate.deltaRatio,
    footnote: "session to paid purchase",
    tone: "violet" as const,
  },
  {
    id: "checkoutAbandonment",
    label: "Checkout abandonment",
    kind: "percent" as const,
    value: funnel.checkoutAbandonmentRate,
    deltaRatio: funnelComparison.checkoutAbandonmentRate.deltaRatio,
    footnote: "drop-off after checkout start",
    tone: "amber" as const,
  },
  {
    id: "aov",
    label: "AOV",
    kind: "currency" as const,
    value: periodComparison.aov.current,
    deltaRatio: periodComparison.aov.deltaRatio,
    footnote: "recognized paid-order average",
    tone: "slate" as const,
  },
  {
    id: "contributionMargin",
    label: "Contribution margin",
    kind: "currency" as const,
    value: finance.contributionMarginCents,
    deltaRatio: toComparisonDelta(
      finance.contributionMarginCents,
      previousFinance.contributionMarginCents,
    ),
    footnote: "after COGS and fees",
    tone: "emerald" as const,
  },
  {
    id: "liveVisitors",
    label: "Live visitors",
    kind: "count" as const,
    value: liveVisitors,
    deltaRatio: null,
    footnote: "rolling active session snapshot",
    tone: "violet" as const,
  },
  {
    id: "vatState",
    label: "VAT state",
    kind: "status" as const,
    value: vat.status,
    deltaRatio: null,
    footnote:
      vat.ordersMissingTaxCount > 0
        ? `${vat.ordersMissingTaxCount} orders need tax review`
        : "tax coverage looks complete",
    tone: "amber" as const,
    contextValue: vat.estimatedLiabilityCents,
  },
];

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

  const revenueTrend = funnelTrend.map((entry) => ({
    label: entry.label,
    revenueCents: entry.revenueCents,
    paidOrders: entry.paidOrders,
    sessions: entry.sessions,
    sessionConversionRate: entry.sessionConversionRate,
    checkoutRate: entry.checkoutRate,
  }));

  const executiveMetrics = getExecutiveMetrics({
    finance: financePageData.currentFinance,
    previousFinance: financePageData.previousFinance,
    periodComparison: orderComparisons,
    funnel: funnelSnapshot,
    funnelComparison,
    vat: financePageData.vatSummary,
    liveVisitors: activeSnapshot.activeVisitorCount,
  });

  const livePages = activeSnapshot.topPages.map((page) => ({
    ...page,
    shareOfVisitors:
      activeSnapshot.activeVisitorCount > 0
        ? page.count / activeSnapshot.activeVisitorCount
        : 0,
  }));

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
    executive: {
      updatedAt: now.toISOString(),
      metrics: executiveMetrics,
    },
    revenueConversion: {
      revenue: {
        totalCents: totalRevenue._sum.amountTotal ?? 0,
        last30DaysCents: paidRevenueCurrentWindow,
        newRevenueCents: customerRevenueMix.newRevenueCents,
        returningRevenueCents: customerRevenueMix.returningRevenueCents,
      },
      funnel: {
        ...funnelSnapshot,
        totalOrders,
        fulfilledOrders,
        refundedOrders,
        canceledOrders,
      },
      funnelComparison,
      trend: revenueTrend,
      periodComparison: {
        currency: orderComparisons.currency,
        revenue: orderComparisons.revenue,
        paidOrders: orderComparisons.paidOrders,
        aov: orderComparisons.aov,
        refundRate: orderComparisons.refundRate,
      },
      finance: financePageData.currentFinance,
      previousFinance: financePageData.previousFinance,
      vat: financePageData.vatSummary,
      expenseMigrationRequired: financePageData.expenseMigrationRequired,
      orderVelocity,
    },
    acquisition: {
      live: {
        activeVisitorCount: activeSnapshot.activeVisitorCount,
        topPages: livePages,
        trafficSources: activeSnapshot.trafficSources,
      },
    },
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
    .map((item) => ({
      ...item,
      priorityReason: item.purchases > 0 ? "Top revenue driver" : "High traffic with weak payout",
    }))
    .slice(0, 8);

  const underperformingProducts = [...productPerformance]
    .filter((item) => item.views >= 5)
    .sort((left, right) => {
      if (right.views !== left.views) return right.views - left.views;
      return left.conversionRate - right.conversionRate;
    })
    .map((item) => ({
      ...item,
      priorityReason: "High visibility with weak conversion",
    }))
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
    .map((source) => ({
      ...source,
      checkoutRate: source.sessions > 0 ? source.beginCheckout / source.sessions : 0,
    }))
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
  const customerSummary = {
    registeredCount: registeredCustomers.length,
    guestCount: guestCustomerCount,
    repeatRegisteredCount: repeatRegisteredCustomers,
    repeatGuestCount: repeatGuestCustomers,
    highValueRegisteredCount: highValueRegisteredCustomers,
    newCustomerCount: customerRevenueMix.newCustomerCount,
    returningCustomerCount: customerRevenueMix.returningCustomerCount,
    repeatRate: totalCustomerCount > 0 ? totalRepeatCustomers / totalCustomerCount : 0,
  };
  const retentionSummary = {
    repeatCustomerRate: totalCustomerCount > 0 ? totalRepeatCustomers / totalCustomerCount : 0,
    newRevenueCents: customerRevenueMix.newRevenueCents,
    returningRevenueCents: customerRevenueMix.returningRevenueCents,
  };
  const aiQualitySummary = {
    totalAnalyses,
    fallbackRate: totalAnalyses > 0 ? fallbackAnalyses / totalAnalyses : 0,
    lowConfidenceRate: totalAnalyses > 0 ? lowConfidenceAnalyses / totalAnalyses : 0,
    feedbackTotal,
    feedbackCorrectRate: feedbackTotal > 0 ? feedbackCorrect / feedbackTotal : 0,
    topIssueLabels: topIssueLabels.map((row) => ({
      label: row.label,
      count: row._count._all,
    })),
  };

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
    customers: customerSummary,
    trafficSources,
    discountAnalysis,
    paymentAnalysis,
    retention: retentionSummary,
    aiQuality: aiQualitySummary,
    acquisition: {
      trafficSources,
    },
    operations: {
      merchandising: {
        leaders: topProducts,
        leaks: underperformingProducts,
      },
      inventory: {
        summary: {
          stockoutCount: stockouts.length,
          lowStockCount,
          trackedVariants: variants.length,
        },
        stockouts,
      },
      customers: {
        summary: customerSummary,
        retention: retentionSummary,
      },
      commerceMix: {
        payments: paymentAnalysis,
        discounts: discountAnalysis,
      },
      system: {
        aiQuality: aiQualitySummary,
      },
    },
  };
}

export type AdminAnalyticsOverviewPayload = Awaited<
  ReturnType<typeof loadAdminAnalyticsOverview>
>;

export type AdminAnalyticsSecondaryPayload = Awaited<
  ReturnType<typeof loadAdminAnalyticsSecondary>
>;
