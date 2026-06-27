import type { Storefront } from "@prisma/client";
import type { AdminTimeRangeDays } from "@/lib/adminTimeRange";
import {
  resolveAdminAnalyticsRange,
  type AdminAnalyticsRange,
} from "@/lib/adminAnalyticsRange";
import { isMissingAnalyticsStorageError } from "@/lib/adminStorageGuards";
import {
  PAID_ORDER_STATUSES,
  getActiveSessionSnapshot,
  getCustomerRevenueMix,
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

const buildScopedCheckoutRecoveryFilter = (storefront: Storefront | null) =>
  storefront ? { sourceStorefront: storefront } : {};

const buildScopedCheckoutRecoveryAttemptFilter = (storefront: Storefront | null) =>
  storefront ? { session: { sourceStorefront: storefront } } : {};

const toComparisonDelta = (current: number, previous: number) =>
  previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0;

type AdminAnalyticsIssueType =
  | "revenue"
  | "conversion"
  | "inventory"
  | "tax"
  | "returns"
  | "recovery"
  | "products"
  | "discounts"
  | "acquisition";

type AdminAnalyticsActionSeverity = "critical" | "warning" | "info" | "success";

type AdminAnalyticsActionItem = {
  id: string;
  type: AdminAnalyticsIssueType;
  severity: AdminAnalyticsActionSeverity;
  priority: number;
  title: string;
  summary: string;
  primaryMetricLabel: string;
  primaryMetricValue: number;
  primaryMetricKind: "currency" | "percent" | "count";
  secondaryMetricLabel?: string;
  secondaryMetricValue?: number;
  secondaryMetricKind?: "currency" | "percent" | "count";
  detailMetrics: Array<{
    label: string;
    value: number | string;
    kind: "currency" | "percent" | "count" | "text";
  }>;
  links: Array<{ label: string; href: string; tone?: "default" | "accent" }>;
};

const buildActionItem = (item: AdminAnalyticsActionItem): AdminAnalyticsActionItem => item;

const sortActionItems = (items: AdminAnalyticsActionItem[]) =>
  [...items].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.title.localeCompare(right.title);
  });

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

async function getTrafficSourceGroups(
  rangeStart: Date,
  rangeEnd: Date,
  storefront: Storefront | null,
) {
  try {
    const [sourceSessions, sourceCheckouts] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["utmSource", "utmMedium", "utmCampaign"],
        where: {
          createdAt: { gte: rangeStart, lt: rangeEnd },
          eventName: "page_view",
          ...buildScopedEventFilter(storefront),
        },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["utmSource", "utmMedium", "utmCampaign"],
        where: {
          createdAt: { gte: rangeStart, lt: rangeEnd },
          eventName: "begin_checkout",
          ...buildScopedEventFilter(storefront),
        },
        _count: { _all: true },
      }),
    ]);

    return {
      eventStorageAvailable: true,
      sourceSessions,
      sourceCheckouts,
    };
  } catch (error) {
    if (!isMissingAnalyticsStorageError(error)) {
      throw error;
    }

    return {
      eventStorageAvailable: false,
      sourceSessions: [],
      sourceCheckouts: [],
    };
  }
}

export async function loadAdminAnalyticsOverview(
  rangeInput: AdminTimeRangeDays | AdminAnalyticsRange = 30,
  storefront: Storefront | null = null,
) {
  const range =
    typeof rangeInput === "number"
      ? resolveAdminAnalyticsRange({ days: String(rangeInput) })
      : rangeInput;
  const days = range.days;
  const now = new Date();
  const currentWindowStart = range.start;

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
    getFunnelSnapshot(range, storefront),
    getFunnelComparison(range, storefront),
    getFunnelTrend(range, storefront),
    getOrderComparisons(range, storefront),
    getCustomerRevenueMix(range, storefront),
    getFinancePageData(range, storefront),
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
        createdAt: { gte: range.start, lt: range.endExclusive },
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

  const revenueTrend = funnelTrend.map((entry, index) => ({
    label: entry.label,
    grossRevenueCents:
      financePageData.trend?.[index]?.grossRevenueCents ?? entry.revenueCents,
    netRevenueCents:
      financePageData.trend?.[index]?.netRevenueCents ?? entry.revenueCents,
    contributionMarginCents:
      financePageData.trend?.[index]?.contributionMarginCents ?? 0,
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

  const previousWindowStart = range.previousStart;
  const actionItems = sortActionItems([
    ...(financePageData.currentFinance.netRevenueCents <
    financePageData.previousFinance.netRevenueCents * 0.9
      ? [
          buildActionItem({
            id: "revenue-drop",
            type: "revenue",
            severity:
              financePageData.currentFinance.netRevenueCents <
              financePageData.previousFinance.netRevenueCents * 0.75
                ? "critical"
                : "warning",
            priority: 94,
            title: "Net revenue is below the previous window",
            summary:
              "Start with paid orders, AOV, and contribution margin before treating this as a traffic issue.",
            primaryMetricLabel: "Net revenue",
            primaryMetricValue: financePageData.currentFinance.netRevenueCents,
            primaryMetricKind: "currency",
            secondaryMetricLabel: "Previous net revenue",
            secondaryMetricValue: financePageData.previousFinance.netRevenueCents,
            secondaryMetricKind: "currency",
            detailMetrics: [
              {
                label: "Revenue delta",
                value: toComparisonDelta(
                  financePageData.currentFinance.netRevenueCents,
                  financePageData.previousFinance.netRevenueCents,
                ),
                kind: "percent",
              },
              { label: "Paid orders", value: orderComparisons.paidOrders.current, kind: "count" },
              { label: "AOV", value: orderComparisons.aov.current, kind: "currency" },
              {
                label: "Contribution",
                value: financePageData.currentFinance.contributionMarginCents,
                kind: "currency",
              },
            ],
            links: [
              { label: "Open finance", href: "/admin/finance", tone: "accent" },
              { label: "Open orders", href: "/admin/orders" },
              { label: "Open reports", href: "/admin/reports" },
            ],
          }),
        ]
      : []),
    ...(funnelSnapshot.checkoutAbandonmentRate >= 0.45 &&
    funnelSnapshot.beginCheckout >= 5
      ? [
          buildActionItem({
            id: "checkout-abandonment",
            type: "conversion",
            severity: funnelSnapshot.checkoutAbandonmentRate >= 0.6 ? "critical" : "warning",
            priority: 88,
            title: "Checkout abandonment needs review",
            summary:
              "Checkout starts are not converting into paid orders at a healthy rate in this window.",
            primaryMetricLabel: "Checkout abandonment",
            primaryMetricValue: funnelSnapshot.checkoutAbandonmentRate,
            primaryMetricKind: "percent",
            secondaryMetricLabel: "Checkout starts",
            secondaryMetricValue: funnelSnapshot.beginCheckout,
            secondaryMetricKind: "count",
            detailMetrics: [
              {
                label: "Checkout to paid",
                value: funnelSnapshot.checkoutToPaidRate,
                kind: "percent",
              },
              { label: "Paid orders", value: funnelSnapshot.paidOrders, kind: "count" },
              {
                label: "Session CVR",
                value: funnelSnapshot.sessionToOrderRate,
                kind: "percent",
              },
              {
                label: "Abandonment delta",
                value: funnelComparison.checkoutAbandonmentRate.deltaRatio ?? 0,
                kind: "percent",
              },
            ],
            links: [
              { label: "Open orders", href: "/admin/orders", tone: "accent" },
              { label: "Open reports", href: "/admin/reports" },
            ],
          }),
        ]
      : []),
    ...(orderComparisons.paidOrders.current >= 5 &&
    (orderComparisons.refundRate.current >= 0.08 ||
      (orderComparisons.refundRate.deltaRatio ?? 0) >= 0.5)
      ? [
          buildActionItem({
            id: "refund-rate-pressure",
            type: "returns",
            severity: orderComparisons.refundRate.current >= 0.15 ? "critical" : "warning",
            priority: 82,
            title: "Refund pressure is elevated",
            summary:
              "Review recent refunded orders before interpreting gross revenue as durable demand.",
            primaryMetricLabel: "Refund rate",
            primaryMetricValue: orderComparisons.refundRate.current,
            primaryMetricKind: "percent",
            secondaryMetricLabel: "Refund delta",
            secondaryMetricValue: orderComparisons.refundRate.deltaRatio ?? 0,
            secondaryMetricKind: "percent",
            detailMetrics: [
              {
                label: "Refunded orders",
                value: financePageData.currentFinance.refundedOrderCount,
                kind: "count",
              },
              {
                label: "Refunded gross",
                value: financePageData.currentFinance.refundedGrossCents,
                kind: "currency",
              },
              {
                label: "Paid orders",
                value: financePageData.currentFinance.paidOrderCount,
                kind: "count",
              },
              {
                label: "Net collected",
                value: financePageData.currentFinance.netCollectedGrossCents,
                kind: "currency",
              },
            ],
            links: [
              { label: "Open orders", href: "/admin/orders", tone: "accent" },
              { label: "Open returns", href: "/admin/returns" },
              { label: "Open finance", href: "/admin/finance" },
            ],
          }),
        ]
      : []),
    ...(financePageData.vatSummary.ordersMissingTaxCount > 0 ||
    financePageData.vatSummary.blockers.length > 0
      ? [
          buildActionItem({
            id: "vat-tax-review",
            type: "tax",
            severity: financePageData.vatSummary.blockers.length > 0 ? "critical" : "warning",
            priority: 90,
            title: "VAT handover has blockers",
            summary:
              "Resolve tax coverage before relying on this window for accounting handover.",
            primaryMetricLabel: "Missing tax orders",
            primaryMetricValue: financePageData.vatSummary.ordersMissingTaxCount,
            primaryMetricKind: "count",
            secondaryMetricLabel: "Tax coverage",
            secondaryMetricValue: financePageData.vatSummary.taxCoverageRate,
            secondaryMetricKind: "percent",
            detailMetrics: [
              { label: "VAT status", value: financePageData.vatSummary.status, kind: "text" },
              {
                label: "Output VAT",
                value: financePageData.vatSummary.outputVatCents,
                kind: "currency",
              },
              {
                label: "Input VAT",
                value: financePageData.vatSummary.inputVatCents,
                kind: "currency",
              },
              {
                label: "Estimated liability",
                value: financePageData.vatSummary.estimatedLiabilityCents,
                kind: "currency",
              },
            ],
            links: [
              { label: "Open VAT", href: "/admin/vat", tone: "accent" },
              { label: "Open finance", href: "/admin/finance" },
              { label: "Open orders", href: "/admin/orders" },
            ],
          }),
        ]
      : []),
  ]);

  return {
    scope: {
      days,
      kind: range.kind,
      label: range.label,
      from: range.from,
      to: range.to,
      bucketKind: range.bucketKind,
      storefront,
      currentStart: financePageData.currentStart,
      currentEnd: financePageData.currentEnd,
      previousStart: previousWindowStart,
      previousEnd: range.previousEndExclusive,
    },
    trust: {
      revenueSource: "orders_and_finance",
      conversionSource: "analytics_events_with_paid_order_fallback",
      moneyAuthority: "server",
      refreshedAt: now.toISOString(),
      currentWindowStart: financePageData.currentStart.toISOString(),
      currentWindowEnd: range.endExclusive.toISOString(),
      previousWindowStart: previousWindowStart.toISOString(),
      previousWindowEnd: range.previousEndExclusive.toISOString(),
    },
    actionCenter: {
      items: actionItems,
      counts: {
        critical: actionItems.filter((item) => item.severity === "critical").length,
        warning: actionItems.filter((item) => item.severity === "warning").length,
        info: actionItems.filter((item) => item.severity === "info").length,
      },
    },
    marginTrend: {
      currency: financePageData.currentFinance.currency,
      currentContributionMarginCents:
        financePageData.currentFinance.contributionMarginCents,
      previousContributionMarginCents:
        financePageData.previousFinance.contributionMarginCents,
      contributionMarginDeltaRatio: toComparisonDelta(
        financePageData.currentFinance.contributionMarginCents,
        financePageData.previousFinance.contributionMarginCents,
      ),
      currentContributionMarginRatio:
        financePageData.currentFinance.contributionMarginRatio,
      previousContributionMarginRatio:
        financePageData.previousFinance.contributionMarginRatio,
      marginRatioDelta:
        financePageData.currentFinance.contributionMarginRatio -
        financePageData.previousFinance.contributionMarginRatio,
      currentVariableCostCents: financePageData.currentFinance.variableCostCents,
      previousVariableCostCents: financePageData.previousFinance.variableCostCents,
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
  rangeInput: AdminTimeRangeDays | AdminAnalyticsRange = 30,
  storefront: Storefront | null = null,
) {
  const range =
    typeof rangeInput === "number"
      ? resolveAdminAnalyticsRange({ days: String(rangeInput) })
      : rangeInput;
  const days = range.days;
  const rangeStart = range.start;
  const rangeEnd = range.endExclusive;

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
    sourceQualityGroups,
    discountGroups,
    paymentGroups,
    salesVelocityGroups,
    checkoutRecoverySessionCount,
    checkoutRecoveryConsentCount,
    checkoutRecoveryCompletedCount,
    checkoutRecoverySuppressedCount,
    checkoutRecoveryRecoveredOrders,
    checkoutRecoveryRecoveredRevenue,
    checkoutRecoveryFailedAttempts,
    checkoutRecoveryDueAttempts,
    returnRequests,
    pendingReturnRequests,
    approvedReturnRequests,
    rejectedReturnRequests,
  ] = await Promise.all([
    getCustomerRevenueMix(range, storefront),
    getProductPerformance(range, storefront),
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
    prisma.plantAnalysisRun.count({
      where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
    }),
    prisma.plantAnalysisRun.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        model: {
          in: ["gpt-4o", process.env.AI_MODEL_STRONG ?? "gpt-4o"],
        },
      },
    }),
    prisma.plantAnalysisFeedback.count({
      where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
    }),
    prisma.plantAnalysisFeedback.count({
      where: {
        isCorrect: true,
        createdAt: { gte: rangeStart, lt: rangeEnd },
      },
    }),
    prisma.plantAnalysisRun.count({
      where: {
        confidence: { lt: 0.65 },
        createdAt: { gte: rangeStart, lt: rangeEnd },
      },
    }),
    prisma.plantAnalysisIssue.groupBy({
      by: ["label"],
      where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
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
            createdAt: { gte: rangeStart, lt: rangeEnd },
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
        createdAt: { gte: rangeStart, lt: rangeEnd },
        userId: null,
        paymentStatus: { in: PAID_ORDER_STATUSES },
        customerEmail: { not: null },
        ...buildScopedOrderFilter(storefront),
      },
      _sum: { amountTotal: true },
      _count: { id: true },
    }),
    getTrafficSourceGroups(rangeStart, rangeEnd, storefront),
    prisma.order.groupBy({
      by: ["discountCode"],
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
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
        createdAt: { gte: rangeStart, lt: rangeEnd },
        paymentStatus: { in: PAID_ORDER_STATUSES },
        ...buildScopedOrderFilter(storefront),
      },
      _count: { id: true },
      _sum: { amountTotal: true, amountRefunded: true },
    }),
    prisma.orderItem.groupBy({
      by: ["variantId"] as const,
      where: {
        variantId: { not: null },
        order: {
          createdAt: { gte: rangeStart, lt: rangeEnd },
          paymentStatus: { in: PAID_ORDER_STATUSES },
          ...buildScopedOrderFilter(storefront),
        },
      },
      _sum: { quantity: true, totalAmount: true },
    }),
    prisma.checkoutRecoverySession.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        ...buildScopedCheckoutRecoveryFilter(storefront),
      },
    }),
    prisma.checkoutRecoverySession.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        consentGranted: true,
        ...buildScopedCheckoutRecoveryFilter(storefront),
      },
    }),
    prisma.checkoutRecoverySession.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        completedAt: { not: null },
        ...buildScopedCheckoutRecoveryFilter(storefront),
      },
    }),
    prisma.checkoutRecoverySession.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        suppressedAt: { not: null },
        ...buildScopedCheckoutRecoveryFilter(storefront),
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        recoveredFromCheckoutSessionId: { not: null },
        paymentStatus: { in: PAID_ORDER_STATUSES },
        ...buildScopedOrderFilter(storefront),
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        recoveredFromCheckoutSessionId: { not: null },
        paymentStatus: { in: PAID_ORDER_STATUSES },
        ...buildScopedOrderFilter(storefront),
      },
      _sum: { amountTotal: true },
    }),
    prisma.checkoutRecoveryAttempt.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        status: "FAILED",
        ...buildScopedCheckoutRecoveryAttemptFilter(storefront),
      },
    }),
    prisma.checkoutRecoveryAttempt.count({
      where: {
        scheduledFor: { gte: rangeStart, lt: rangeEnd, lte: new Date() },
        status: "PENDING",
        ...buildScopedCheckoutRecoveryAttemptFilter(storefront),
      },
    }),
    prisma.returnRequest.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        ...(storefront ? { order: { sourceStorefront: storefront } } : {}),
      },
    }),
    prisma.returnRequest.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        status: "PENDING",
        ...(storefront ? { order: { sourceStorefront: storefront } } : {}),
      },
    }),
    prisma.returnRequest.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        status: "APPROVED",
        ...(storefront ? { order: { sourceStorefront: storefront } } : {}),
      },
    }),
    prisma.returnRequest.count({
      where: {
        createdAt: { gte: rangeStart, lt: rangeEnd },
        status: "REJECTED",
        ...(storefront ? { order: { sourceStorefront: storefront } } : {}),
      },
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

  const velocityMap = new Map(
    salesVelocityGroups
      .filter((group): group is typeof group & { variantId: string } => Boolean(group.variantId))
      .map((group) => {
        const unitsSold = group._sum.quantity ?? 0;
        return [
          group.variantId,
          {
            unitsSold,
            revenueCents: group._sum.totalAmount ?? 0,
            dailyVelocity: unitsSold > 0 ? unitsSold / days : 0,
          },
        ];
      }),
  );
  const productPerformanceMap = new Map(
    productPerformance.map((item) => [item.productId, item]),
  );
  const inventoryRiskRows = variants
    .map((variant) => {
      const onHand = variant.inventory?.quantityOnHand ?? 0;
      const reserved = variant.inventory?.reserved ?? 0;
      const available = Math.max(0, onHand - reserved);
      const velocity = velocityMap.get(variant.id) ?? {
        unitsSold: 0,
        revenueCents: 0,
        dailyVelocity: 0,
      };
      const coverDays =
        velocity.dailyVelocity > 0 ? Math.floor(available / velocity.dailyVelocity) : null;
      const productPerformanceRow = productPerformanceMap.get(variant.product?.id ?? "");
      const riskLevel =
        available <= 0
          ? "critical"
          : coverDays !== null && coverDays <= 14
            ? "warning"
            : available <= variant.lowStockThreshold
              ? "warning"
              : "info";

      return {
        variantId: variant.id,
        productId: variant.product?.id ?? null,
        productTitle: variant.product?.title ?? "Unknown product",
        variantTitle: variant.title,
        sku: variant.sku ?? null,
        available,
        quantityOnHand: onHand,
        reserved,
        lowStockThreshold: variant.lowStockThreshold,
        unitsSold: velocity.unitsSold,
        dailyVelocity: velocity.dailyVelocity,
        coverDays,
        revenueAtRiskCents: productPerformanceRow?.revenueCents ?? velocity.revenueCents,
        riskLevel,
      };
    })
    .filter(
      (row) =>
        row.riskLevel === "critical" ||
        row.riskLevel === "warning" ||
        row.revenueAtRiskCents > 0,
    )
    .sort((left, right) => {
      const severityDelta =
        (right.riskLevel === "critical" ? 2 : right.riskLevel === "warning" ? 1 : 0) -
        (left.riskLevel === "critical" ? 2 : left.riskLevel === "warning" ? 1 : 0);
      if (severityDelta !== 0) return severityDelta;
      if (right.revenueAtRiskCents !== left.revenueAtRiskCents) {
        return right.revenueAtRiskCents - left.revenueAtRiskCents;
      }
      return left.available - right.available;
    })
    .slice(0, 12);

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
    {
      label: string;
      source: string | null;
      medium: string | null;
      campaign: string | null;
      sessions: number;
      beginCheckout: number;
    }
  >();
  for (const group of sourceQualityGroups.sourceSessions) {
    const label =
      group.utmSource && group.utmMedium && group.utmCampaign
        ? `${group.utmSource} / ${group.utmMedium} / ${group.utmCampaign}`
        : group.utmSource && group.utmMedium
          ? `${group.utmSource} / ${group.utmMedium}`
        : group.utmSource
          ? group.utmSource
          : "Direct / unknown";
    const entry = trafficSourceMap.get(label) ?? {
      label,
      source: group.utmSource,
      medium: group.utmMedium,
      campaign: group.utmCampaign,
      sessions: 0,
      beginCheckout: 0,
    };
    entry.sessions += group._count._all;
    trafficSourceMap.set(label, entry);
  }
  for (const group of sourceQualityGroups.sourceCheckouts) {
    const label =
      group.utmSource && group.utmMedium && group.utmCampaign
        ? `${group.utmSource} / ${group.utmMedium} / ${group.utmCampaign}`
        : group.utmSource && group.utmMedium
          ? `${group.utmSource} / ${group.utmMedium}`
        : group.utmSource
          ? group.utmSource
          : "Direct / unknown";
    const entry = trafficSourceMap.get(label) ?? {
      label,
      source: group.utmSource,
      medium: group.utmMedium,
      campaign: group.utmCampaign,
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
      quality:
        source.sessions >= 10 && source.beginCheckout === 0
          ? ("no_checkout_signal" as const)
          : source.sessions >= 10 && source.beginCheckout / source.sessions < 0.02
            ? ("weak_checkout_signal" as const)
            : source.beginCheckout > 0
              ? ("checkout_signal" as const)
              : ("low_volume" as const),
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
  const discountEfficiency = discountAnalysis.map((discount) => ({
    ...discount,
    discountRate:
      discount.revenueCents + discount.discountCents > 0
        ? discount.discountCents / (discount.revenueCents + discount.discountCents)
        : 0,
    revenuePerDiscountCent:
      discount.discountCents > 0 ? discount.revenueCents / discount.discountCents : null,
  }));

  const checkoutRecovery = {
    sessions: checkoutRecoverySessionCount,
    consentGrantedSessions: checkoutRecoveryConsentCount,
    completedSessions: checkoutRecoveryCompletedCount,
    suppressedSessions: checkoutRecoverySuppressedCount,
    recoveredOrders: checkoutRecoveryRecoveredOrders,
    recoveredRevenueCents: checkoutRecoveryRecoveredRevenue._sum.amountTotal ?? 0,
    failedAttempts: checkoutRecoveryFailedAttempts,
    dueAttempts: checkoutRecoveryDueAttempts,
    consentRate:
      checkoutRecoverySessionCount > 0
        ? checkoutRecoveryConsentCount / checkoutRecoverySessionCount
        : 0,
    recoveryRate:
      checkoutRecoverySessionCount > 0
        ? checkoutRecoveryRecoveredOrders / checkoutRecoverySessionCount
        : 0,
    suppressionRate:
      checkoutRecoverySessionCount > 0
        ? checkoutRecoverySuppressedCount / checkoutRecoverySessionCount
        : 0,
  };
  const returns = {
    totalRequests: returnRequests,
    pendingRequests: pendingReturnRequests,
    approvedRequests: approvedReturnRequests,
    rejectedRequests: rejectedReturnRequests,
    pendingRate: returnRequests > 0 ? pendingReturnRequests / returnRequests : 0,
  };
  const inventoryRisk = {
    summary: {
      criticalCount: inventoryRiskRows.filter((row) => row.riskLevel === "critical").length,
      warningCount: inventoryRiskRows.filter((row) => row.riskLevel === "warning").length,
      trackedRiskCount: inventoryRiskRows.length,
      revenueAtRiskCents: inventoryRiskRows.reduce(
        (sum, row) => sum + Math.max(row.revenueAtRiskCents, 0),
        0,
      ),
    },
    rows: inventoryRiskRows,
  };
  const sourceQuality = {
    eventStorage: sourceQualityGroups.eventStorageAvailable
      ? ("event_backed" as const)
      : ("orders_only_fallback" as const),
    sources: trafficSources,
    weakSources: trafficSources.filter(
      (source) => source.quality === "no_checkout_signal" || source.quality === "weak_checkout_signal",
    ),
  };

  const secondaryActionItems = sortActionItems([
    ...(inventoryRisk.summary.criticalCount > 0
      ? [
          buildActionItem({
            id: "inventory-stockout-risk",
            type: "inventory",
            severity: "critical",
            priority: 96,
            title: "Revenue-driving inventory is unavailable",
            summary:
              "Resolve stockouts first; these products already have recent sales or visibility.",
            primaryMetricLabel: "Stockouts",
            primaryMetricValue: inventoryRisk.summary.criticalCount,
            primaryMetricKind: "count",
            secondaryMetricLabel: "Revenue at risk",
            secondaryMetricValue: inventoryRisk.summary.revenueAtRiskCents,
            secondaryMetricKind: "currency",
            detailMetrics: [
              {
                label: "Low stock rows",
                value: inventoryRisk.summary.warningCount,
                kind: "count",
              },
              {
                label: "Tracked variants",
                value: variants.length,
                kind: "count",
              },
              {
                label: "Top risk",
                value: inventoryRisk.rows[0]?.productTitle ?? "No product",
                kind: "text",
              },
              {
                label: "Top available",
                value: inventoryRisk.rows[0]?.available ?? 0,
                kind: "count",
              },
            ],
            links: [
              { label: "Open inventory", href: "/admin/inventory-adjustments", tone: "accent" },
              { label: "Open catalog", href: "/admin/catalog" },
              { label: "Open procurement", href: "/admin/procurement" },
            ],
          }),
        ]
      : []),
    ...(checkoutRecovery.failedAttempts > 0 || checkoutRecovery.dueAttempts > 0
      ? [
          buildActionItem({
            id: "checkout-recovery-queue",
            type: "recovery",
            severity: checkoutRecovery.failedAttempts > 0 ? "warning" : "info",
            priority: 78,
            title: "Checkout recovery queue needs attention",
            summary:
              "Failed or due recovery attempts can hide recoverable revenue until the ops queue is cleared.",
            primaryMetricLabel: "Failed attempts",
            primaryMetricValue: checkoutRecovery.failedAttempts,
            primaryMetricKind: "count",
            secondaryMetricLabel: "Due attempts",
            secondaryMetricValue: checkoutRecovery.dueAttempts,
            secondaryMetricKind: "count",
            detailMetrics: [
              {
                label: "Recovered orders",
                value: checkoutRecovery.recoveredOrders,
                kind: "count",
              },
              {
                label: "Recovered revenue",
                value: checkoutRecovery.recoveredRevenueCents,
                kind: "currency",
              },
              {
                label: "Suppression rate",
                value: checkoutRecovery.suppressionRate,
                kind: "percent",
              },
              {
                label: "Consent rate",
                value: checkoutRecovery.consentRate,
                kind: "percent",
              },
            ],
            links: [
              { label: "Open ops", href: "/admin/ops", tone: "accent" },
              { label: "Open orders", href: "/admin/orders" },
            ],
          }),
        ]
      : []),
    ...(returns.pendingRequests > 0
      ? [
          buildActionItem({
            id: "pending-returns",
            type: "returns",
            severity: returns.pendingRequests >= 5 ? "warning" : "info",
            priority: 74,
            title: "Pending returns need handling",
            summary:
              "Pending return requests can become refund pressure, support load, or stock recovery opportunities.",
            primaryMetricLabel: "Pending returns",
            primaryMetricValue: returns.pendingRequests,
            primaryMetricKind: "count",
            secondaryMetricLabel: "Pending rate",
            secondaryMetricValue: returns.pendingRate,
            secondaryMetricKind: "percent",
            detailMetrics: [
              { label: "Total requests", value: returns.totalRequests, kind: "count" },
              { label: "Approved", value: returns.approvedRequests, kind: "count" },
              { label: "Rejected", value: returns.rejectedRequests, kind: "count" },
              { label: "Pending", value: returns.pendingRequests, kind: "count" },
            ],
            links: [
              { label: "Open returns", href: "/admin/returns", tone: "accent" },
              { label: "Open support", href: "/admin/support" },
            ],
          }),
        ]
      : []),
    ...(underperformingProducts[0]
      ? [
          buildActionItem({
            id: "product-conversion-leak",
            type: "products",
            severity: "warning",
            priority: 76,
            title: "A high-traffic product is leaking conversion",
            summary:
              "Use the product board to inspect detail page demand, cart intent, and merchandising fit.",
            primaryMetricLabel: "Views",
            primaryMetricValue: underperformingProducts[0].views,
            primaryMetricKind: "count",
            secondaryMetricLabel: "Conversion",
            secondaryMetricValue: underperformingProducts[0].conversionRate,
            secondaryMetricKind: "percent",
            detailMetrics: [
              {
                label: "Product",
                value: underperformingProducts[0].productTitle,
                kind: "text",
              },
              {
                label: "Add to cart",
                value: underperformingProducts[0].addToCart,
                kind: "count",
              },
              {
                label: "Purchases",
                value: underperformingProducts[0].purchases,
                kind: "count",
              },
              {
                label: "Revenue",
                value: underperformingProducts[0].revenueCents,
                kind: "currency",
              },
            ],
            links: [
              { label: "Open catalog", href: "/admin/catalog", tone: "accent" },
              { label: "Open pricing", href: "/admin/pricing" },
            ],
          }),
        ]
      : []),
    ...(discountEfficiency.some((discount) => discount.discountRate >= 0.2)
      ? [
          buildActionItem({
            id: "discount-efficiency",
            type: "discounts",
            severity: "info",
            priority: 62,
            title: "A discount code is consuming a large share of order value",
            summary:
              "Compare discounted revenue against the discount amount before repeating the offer.",
            primaryMetricLabel: "Highest discount rate",
            primaryMetricValue: Math.max(...discountEfficiency.map((discount) => discount.discountRate)),
            primaryMetricKind: "percent",
            secondaryMetricLabel: "Codes",
            secondaryMetricValue: discountEfficiency.length,
            secondaryMetricKind: "count",
            detailMetrics: [
              {
                label: "Top code",
                value:
                  [...discountEfficiency].sort(
                    (left, right) => right.discountRate - left.discountRate,
                  )[0]?.code ?? "No code",
                kind: "text",
              },
              {
                label: "Orders",
                value:
                  [...discountEfficiency].sort(
                    (left, right) => right.discountRate - left.discountRate,
                  )[0]?.orders ?? 0,
                kind: "count",
              },
              {
                label: "Discount",
                value:
                  [...discountEfficiency].sort(
                    (left, right) => right.discountRate - left.discountRate,
                  )[0]?.discountCents ?? 0,
                kind: "currency",
              },
              {
                label: "Revenue",
                value:
                  [...discountEfficiency].sort(
                    (left, right) => right.discountRate - left.discountRate,
                  )[0]?.revenueCents ?? 0,
                kind: "currency",
              },
            ],
            links: [
              { label: "Open discounts", href: "/admin/discounts", tone: "accent" },
              { label: "Open finance", href: "/admin/finance" },
            ],
          }),
        ]
      : []),
    ...(sourceQuality.weakSources[0]
      ? [
          buildActionItem({
            id: "weak-source-quality",
            type: "acquisition",
            severity: "info",
            priority: 58,
            title: "A traffic source has weak checkout intent",
            summary:
              "Review campaign fit before scaling source volume that is not reaching checkout.",
            primaryMetricLabel: "Sessions",
            primaryMetricValue: sourceQuality.weakSources[0].sessions,
            primaryMetricKind: "count",
            secondaryMetricLabel: "Checkout rate",
            secondaryMetricValue: sourceQuality.weakSources[0].checkoutRate,
            secondaryMetricKind: "percent",
            detailMetrics: [
              {
                label: "Source",
                value: sourceQuality.weakSources[0].label,
                kind: "text",
              },
              {
                label: "Checkout starts",
                value: sourceQuality.weakSources[0].beginCheckout,
                kind: "count",
              },
              {
                label: "Event storage",
                value: sourceQuality.eventStorage,
                kind: "text",
              },
              {
                label: "Quality",
                value: sourceQuality.weakSources[0].quality,
                kind: "text",
              },
            ],
            links: [
              { label: "Open reports", href: "/admin/reports", tone: "accent" },
              { label: "Open attribution", href: "/admin/attribution" },
            ],
          }),
        ]
      : []),
  ]);

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
      kind: range.kind,
      label: range.label,
      from: range.from,
      to: range.to,
      bucketKind: range.bucketKind,
      storefront,
      currentStart: rangeStart,
      currentEnd: new Date(Math.min(Date.now(), rangeEnd.getTime() - 1)),
    },
    trust: {
      eventStorage: sourceQuality.eventStorage,
      sourceQualitySource:
        sourceQuality.eventStorage === "event_backed"
          ? "analytics_events"
          : "analytics_events_unavailable",
      moneyAuthority: "server",
      refreshedAt: new Date().toISOString(),
    },
    actionCenter: {
      items: secondaryActionItems,
      counts: {
        critical: secondaryActionItems.filter((item) => item.severity === "critical").length,
        warning: secondaryActionItems.filter((item) => item.severity === "warning").length,
        info: secondaryActionItems.filter((item) => item.severity === "info").length,
      },
    },
    topProducts,
    underperformingProducts,
    stockouts,
    inventory: {
      stockoutCount: stockouts.length,
      lowStockCount,
      trackedVariants: variants.length,
    },
    inventoryRisk,
    customers: customerSummary,
    trafficSources,
    sourceQuality,
    discountAnalysis,
    discountEfficiency,
    paymentAnalysis,
    checkoutRecovery,
    returns,
    retention: retentionSummary,
    aiQuality: aiQualitySummary,
    acquisition: {
      trafficSources,
      sourceQuality,
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
        risk: inventoryRisk,
      },
      customers: {
        summary: customerSummary,
        retention: retentionSummary,
      },
      commerceMix: {
        payments: paymentAnalysis,
        discounts: discountAnalysis,
        discountEfficiency,
      },
      system: {
        aiQuality: aiQualitySummary,
        checkoutRecovery,
        returns,
      },
    },
  };
}

export async function loadAdminAnalyticsLive(storefront: Storefront | null = null) {
  const snapshot = await getActiveSessionSnapshot(storefront);
  return {
    live: {
      activeVisitorCount: snapshot.activeVisitorCount,
      topPages: snapshot.topPages.map((page) => ({
        ...page,
        shareOfVisitors:
          snapshot.activeVisitorCount > 0
            ? page.count / snapshot.activeVisitorCount
            : 0,
      })),
      trafficSources: snapshot.trafficSources,
    },
    refreshedAt: new Date().toISOString(),
  };
}

export type AdminAnalyticsOverviewPayload = Awaited<
  ReturnType<typeof loadAdminAnalyticsOverview>
>;

export type AdminAnalyticsSecondaryPayload = Awaited<
  ReturnType<typeof loadAdminAnalyticsSecondary>
>;

export type AdminAnalyticsLivePayload = Awaited<
  ReturnType<typeof loadAdminAnalyticsLive>
>;
