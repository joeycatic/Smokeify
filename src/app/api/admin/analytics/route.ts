import { prisma } from "@/lib/prisma";
import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { buildExpenseSummary } from "@/lib/adminExpenses";
import { buildFinanceRollup, buildVatSummary } from "@/lib/adminFinance";
import { isMissingExpenseTableError } from "@/lib/expenseTableGuard";
import {
  PAID_ORDER_STATUSES,
  getFunnelComparison,
  getActiveSessionSnapshot,
  getCustomerRevenueMix,
  getFunnelSnapshot,
  getFunnelTrend,
  getOrderComparisons,
  getProductPerformance,
} from "@/lib/adminInsights";

const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

const getDateDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const GET = withAdminRoute(async () => {
  const now = new Date();
  const last14DaysStart = getDateDaysAgo(13);
  const last30DaysStart = getDateDaysAgo(29);
  const last60DaysStart = getDateDaysAgo(59);

  const expensePromise = prisma.expense
    .findMany({
      where: { documentDate: { gte: last60DaysStart } },
      select: {
        supplierId: true,
        title: true,
        category: true,
        notes: true,
        currency: true,
        grossAmount: true,
        netAmount: true,
        vatAmount: true,
        vatRateBasisPoints: true,
        isDeductible: true,
        documentDate: true,
        paidAt: true,
        documentStatus: true,
      },
      orderBy: { documentDate: "asc" },
    })
    .then((records) => ({
      records,
      migrationRequired: false,
    }))
    .catch((error) => {
      if (isMissingExpenseTableError(error)) {
        return {
          records: [],
          migrationRequired: true,
        };
      }
      throw error;
    });

  const [
    activeSnapshot,
    funnelSnapshot,
    funnelComparison,
    funnelTrend,
    orderComparisons,
    customerRevenueMix,
    productPerformance,
    totalOrders,
    fulfilledOrders,
    refundedOrders,
    canceledOrders,
    totalRevenue,
    variants,
    totalAnalyses,
    fallbackAnalyses,
    feedbackTotal,
    feedbackCorrect,
    lowConfidenceAnalyses,
    topIssueLabels,
    recentOrders,
    financeOrders,
    expenseResult,
    registeredCustomers,
    guestPaidCustomers,
    sourceSessions,
    sourceCheckouts,
    discountGroups,
    paymentGroups,
  ] = await Promise.all([
    getActiveSessionSnapshot(),
    getFunnelSnapshot(30),
    getFunnelComparison(30),
    getFunnelTrend(14),
    getOrderComparisons(30),
    getCustomerRevenueMix(30),
    getProductPerformance(30),
    prisma.order.count(),
    prisma.order.count({ where: { status: "fulfilled" } }),
    prisma.order.count({ where: { paymentStatus: "refunded" } }),
    prisma.order.count({ where: { status: "canceled" } }),
    prisma.order.aggregate({
      where: { paymentStatus: { in: PAID_ORDER_STATUSES } },
      _sum: { amountTotal: true },
    }),
    prisma.variant.findMany({
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
    prisma.order.findMany({
      where: { createdAt: { gte: last30DaysStart } },
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
    prisma.order.findMany({
      where: { createdAt: { gte: last60DaysStart } },
      select: {
        createdAt: true,
        currency: true,
        paymentStatus: true,
        status: true,
        amountSubtotal: true,
        amountTax: true,
        amountShipping: true,
        amountDiscount: true,
        amountTotal: true,
        amountRefunded: true,
        items: {
          select: {
            quantity: true,
            totalAmount: true,
            baseCostAmount: true,
            paymentFeeAmount: true,
            adjustedCostAmount: true,
            taxAmount: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    expensePromise,
    prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        orders: {
          where: { paymentStatus: { in: PAID_ORDER_STATUSES } },
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
      },
      _sum: { amountTotal: true },
      _count: { id: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["utmSource", "utmMedium"],
      where: {
        createdAt: { gte: last30DaysStart },
        eventName: "page_view",
      },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["utmSource", "utmMedium"],
      where: {
        createdAt: { gte: last30DaysStart },
        eventName: "begin_checkout",
      },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["discountCode"],
      where: {
        createdAt: { gte: last30DaysStart },
        paymentStatus: { in: PAID_ORDER_STATUSES },
        discountCode: { not: null },
      },
      _count: { id: true },
      _sum: { amountTotal: true, amountDiscount: true },
      orderBy: { _sum: { amountTotal: "desc" } },
      take: 8,
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: {
        createdAt: { gte: last30DaysStart },
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
      _count: { id: true },
      _sum: { amountTotal: true, amountRefunded: true },
    }),
  ]);
  const expenseRecords = expenseResult.records;

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

  const last14Days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(last14DaysStart);
    date.setDate(last14DaysStart.getDate() + index);
    return {
      label: formatDayLabel(date),
      key: date.toISOString().slice(0, 10),
      revenueCents: 0,
      orders: 0,
    };
  });
  const dailyIndex = new Map(last14Days.map((entry) => [entry.key, entry]));

  const orderVelocity = {
    today: 0,
    last7Days: 0,
    last30Days: 0,
  };

  const paidRevenueLast30Days = recentOrders.reduce((sum, order) => {
    const paymentStatus = order.paymentStatus.trim().toLowerCase();
    const isPaid = PAID_ORDER_STATUSES.includes(paymentStatus);
    const orderKey = order.createdAt.toISOString().slice(0, 10);
    const target = dailyIndex.get(orderKey);
    if (target) {
      target.orders += 1;
      if (isPaid) {
        target.revenueCents += order.amountTotal;
      }
    }

    const diffDays = Math.floor(
      (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 0) orderVelocity.today += 1;
    if (diffDays < 7) orderVelocity.last7Days += 1;
    if (diffDays < 30) orderVelocity.last30Days += 1;

    if (!isPaid) return sum;
    return sum + order.amountTotal;
  }, 0);

  const repeatRegisteredCustomers = registeredCustomers.filter(
    (customer) => customer.orders.length >= 2
  ).length;
  const highValueRegisteredCustomers = registeredCustomers.filter((customer) =>
    customer.orders.reduce((sum, order) => sum + order.amountTotal, 0) >= 25_000
  ).length;
  const guestCustomerCount = guestPaidCustomers.length;
  const repeatGuestCustomers = guestPaidCustomers.filter(
    (customer) => customer._count.id >= 2
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
  const currentFinanceOrders = financeOrders.filter(
    (order) => order.createdAt >= last30DaysStart,
  );
  const previousFinanceOrders = financeOrders.filter(
    (order) => order.createdAt < last30DaysStart,
  );
  const currentExpenses = expenseRecords.filter(
    (expense) => expense.documentDate >= last30DaysStart,
  );
  const finance = buildFinanceRollup(
    currentFinanceOrders,
    orderComparisons.currency,
  );
  const previousFinance = buildFinanceRollup(
    previousFinanceOrders,
    orderComparisons.currency,
  );
  const expenseSummary = buildExpenseSummary(currentExpenses, orderComparisons.currency);
  const vat = buildVatSummary(currentFinanceOrders, now, {
    inputVatCents: expenseSummary.deductibleInputVatCents,
    expenseCount: expenseSummary.expenseCount,
    missingExpenseVatCount: expenseSummary.missingVatCount,
    missingExpenseDocumentCount: expenseSummary.missingDocumentCount,
    missingExpenseSupplierCount: expenseSummary.missingSupplierCount,
  });

  return adminJson({
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
      last30DaysCents: paidRevenueLast30Days,
      newRevenueCents: customerRevenueMix.newRevenueCents,
      returningRevenueCents: customerRevenueMix.returningRevenueCents,
    },
    finance,
    previousFinance,
    vat,
    expenseMigrationRequired: expenseResult.migrationRequired,
    topProducts,
    underperformingProducts,
    stockouts,
    inventory: {
      stockoutCount: stockouts.length,
      lowStockCount,
      trackedVariants: variants.length,
    },
    trends: {
      daily: last14Days.map((entry) => ({
        label: entry.label,
        revenueCents: entry.revenueCents,
        orders: entry.orders,
      })),
      orderVelocity,
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
  });
});
