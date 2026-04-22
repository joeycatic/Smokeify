import "server-only";

import { type Storefront } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildExpenseSummary,
  buildRecurringExpenseSummary,
  getVatDeadlineInfo,
} from "@/lib/adminExpenses";
import {
  buildFinanceRollup,
  buildVatSummary,
  RECOGNIZED_PAYMENT_STATUSES,
} from "@/lib/adminFinance";
import { buildUstvaPreparation } from "@/lib/adminUstva";
import {
  buildAlertDedupeKey,
  getAdminAlertsQueueData,
  syncAdminAlerts,
} from "@/lib/adminAlerts";
import {
  buildGrowvaultDiagnosticAlerts,
  getGrowvaultSharedDiagnosticsFeed,
} from "@/lib/growvaultSharedStorefront";
import { isMissingExpenseTableError } from "@/lib/expenseTableGuard";
import {
  getFunnelSnapshot,
  getOrderComparisons,
  getProductPerformance,
  getStockCoverageMap,
} from "@/lib/adminInsights";
import {
  buildAdminTimeBuckets,
  getAdminTimeWindowStart,
  type AdminTimeRangeDays,
} from "@/lib/adminTimeRange";
import { STOREFRONT_LABELS } from "@/lib/storefronts";

const getDateDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getMonthStartMonthsAgo = (monthsAgo: number) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - monthsAgo, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildVatOptionsFromExpenses = (
  summary: ReturnType<typeof buildExpenseSummary>,
) => ({
  inputVatCents: summary.deductibleInputVatCents,
  expenseCount: summary.expenseCount,
  missingExpenseVatCount: summary.missingVatCount,
  missingExpenseDocumentCount: summary.missingDocumentCount,
  missingExpenseSupplierCount: summary.missingSupplierCount,
});

export async function getFinanceOrdersSince(since: Date) {
  return prisma.order.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      currency: true,
      shippingCountry: true,
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
  });
}

export async function getFinanceOrdersSinceForStorefront(
  since: Date,
  storefront: Storefront | null = null,
) {
  return prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      ...(storefront ? { sourceStorefront: storefront } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      currency: true,
      shippingCountry: true,
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
  });
}

async function queryExpensesSince(since: Date) {
  try {
    const expenses = await prisma.expense.findMany({
      where: { documentDate: { gte: since } },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return {
      expenses,
      migrationRequired: false,
    };
  } catch (error) {
    if (isMissingExpenseTableError(error)) {
      return {
        expenses: [],
        migrationRequired: true,
      };
    }
    throw error;
  }
}

async function queryRecurringExpenses() {
  try {
    const recurringExpenses = await prisma.recurringExpense.findMany({
      orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }, { createdAt: "desc" }],
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return {
      recurringExpenses,
      migrationRequired: false,
    };
  } catch (error) {
    if (isMissingExpenseTableError(error)) {
      return {
        recurringExpenses: [],
        migrationRequired: true,
      };
    }
    throw error;
  }
}

export async function getExpensesSince(since: Date) {
  const result = await queryExpensesSince(since);
  return result.expenses;
}

export async function getFinancePageData(
  days: AdminTimeRangeDays = 30,
  storefront: Storefront | null = null,
) {
  const currentStart = getAdminTimeWindowStart(days);
  const previousStart = getDateDaysAgo(days * 2 - 1);
  const [orders, expenseQuery, latestRecognizedOrder] = await Promise.all([
    getFinanceOrdersSinceForStorefront(previousStart, storefront),
    queryExpensesSince(previousStart),
    prisma.order.findFirst({
      where: {
        paymentStatus: { in: [...RECOGNIZED_PAYMENT_STATUSES] },
        ...(storefront ? { sourceStorefront: storefront } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        paymentStatus: true,
        status: true,
        amountTotal: true,
      },
    }),
  ]);
  const expenses = storefront ? [] : expenseQuery.expenses;
  const currency = orders[0]?.currency ?? expenses[0]?.currency ?? "EUR";
  const currentOrders = orders.filter((order) => order.createdAt >= currentStart);
  const previousOrders = orders.filter((order) => order.createdAt < currentStart);
  const currentExpenses = expenses.filter((expense) => expense.documentDate >= currentStart);
  const previousExpenses = expenses.filter((expense) => expense.documentDate < currentStart);
  const currentFinance = buildFinanceRollup(currentOrders, currency);
  const previousFinance = buildFinanceRollup(previousOrders, currency);
  const currentExpenseSummary = buildExpenseSummary(currentExpenses, currency);
  const previousExpenseSummary = buildExpenseSummary(previousExpenses, currency);
  const vatSummary = buildVatSummary(
    currentOrders,
    new Date(),
    buildVatOptionsFromExpenses(currentExpenseSummary),
  );

  const trendBuckets = buildAdminTimeBuckets(days, "de-DE").map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    start: bucket.start,
    endExclusive: bucket.endExclusive,
    grossRevenueCents: 0,
    netRevenueCents: 0,
    contributionMarginCents: 0,
  }));

  for (const order of currentOrders) {
    const bucket = trendBuckets.find(
      (entry) => order.createdAt >= entry.start && order.createdAt < entry.endExclusive,
    );
    if (!bucket) continue;
    const breakdown = buildFinanceRollup([order], currency);
    bucket.grossRevenueCents += breakdown.grossRevenueCents;
    bucket.netRevenueCents += breakdown.netRevenueCents;
    bucket.contributionMarginCents += breakdown.contributionMarginCents;
  }

  const trend = trendBuckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    grossRevenueCents: bucket.grossRevenueCents,
    netRevenueCents: bucket.netRevenueCents,
    contributionMarginCents: bucket.contributionMarginCents,
  }));

  const expenseByCategory = Array.from(
    currentExpenses.reduce(
      (map, expense) => {
        const entry = map.get(expense.category) ?? {
          category: expense.category,
          grossAmount: 0,
          netAmount: 0,
          vatAmount: 0,
          count: 0,
        };
        entry.grossAmount += expense.grossAmount;
        entry.netAmount += expense.netAmount;
        entry.vatAmount += expense.vatAmount;
        entry.count += 1;
        map.set(expense.category, entry);
        return map;
      },
      new Map<
        string,
        {
          category: string;
          grossAmount: number;
          netAmount: number;
          vatAmount: number;
          count: number;
        }
      >(),
    ).values(),
  ).sort((left, right) => right.grossAmount - left.grossAmount);

  return {
    storefront,
    currentFinance,
    previousFinance,
    currentExpenseSummary,
    previousExpenseSummary,
    vatSummary,
    trend,
    expenseByCategory,
    expenseMigrationRequired: expenseQuery.migrationRequired,
    currentStart,
    currentEnd: new Date(),
    latestRecognizedOrderAt: latestRecognizedOrder?.createdAt ?? null,
  };
}

export async function getVatPageData(months = 6) {
  const since = getMonthStartMonthsAgo(months - 1);
  const [orders, expenseQuery] = await Promise.all([
    getFinanceOrdersSince(since),
    queryExpensesSince(since),
  ]);
  const expenses = expenseQuery.expenses;
  const monthBuckets = Array.from({ length: months }, (_, index) => {
    const date = getMonthStartMonthsAgo(months - 1 - index);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      date,
    };
  });

  const monthly = monthBuckets.map((bucket, index) => {
    const nextDate =
      index < monthBuckets.length - 1
        ? monthBuckets[index + 1].date
        : new Date(bucket.date.getFullYear(), bucket.date.getMonth() + 1, 1);
    const monthOrders = orders.filter(
      (order) => order.createdAt >= bucket.date && order.createdAt < nextDate,
    );
    const monthExpenses = expenses.filter(
      (expense) => expense.documentDate >= bucket.date && expense.documentDate < nextDate,
    );
    const finance = buildFinanceRollup(monthOrders);
    const expenseSummary = buildExpenseSummary(monthExpenses);
    const vat = buildVatSummary(
      monthOrders,
      bucket.date,
      buildVatOptionsFromExpenses(expenseSummary),
    );
    return {
      monthKey: bucket.key,
      monthLabel: vat.monthLabel,
      outputVatCents: vat.outputVatCents,
      refundedVatEstimateCents: vat.refundedVatEstimateCents,
      inputVatCents: vat.inputVatCents,
      estimatedLiabilityCents: vat.estimatedLiabilityCents,
      taxCoverageRate: vat.taxCoverageRate,
      ordersMissingTaxCount: vat.ordersMissingTaxCount,
      status: vat.status,
      blockers: vat.blockers,
      notes: vat.notes,
      recognizedOrderCount: finance.recognizedOrderCount,
      grossRevenueCents: finance.grossRevenueCents,
      netRevenueCents: finance.netRevenueCents,
      expenseCount: expenseSummary.expenseCount,
      missingExpenseDocumentCount: expenseSummary.missingDocumentCount,
      missingExpenseVatCount: expenseSummary.missingVatCount,
      missingExpenseSupplierCount: expenseSummary.missingSupplierCount,
      reviewRequiredExpenseCount: expenseSummary.reviewRequiredCount,
      blockedExpenseCount: expenseSummary.blockedCount,
      reverseChargeExpenseCount: monthExpenses.filter(
        (expense) =>
          expense.taxClassification === "REVERSE_CHARGE" ||
          expense.taxClassification === "INTRA_EU_MANUAL" ||
          expense.taxClassification === "EXPORT_MANUAL",
      ).length,
    };
  });

  const current =
    [...monthly]
      .reverse()
      .find((row) => row.recognizedOrderCount > 0 || row.expenseCount > 0) ??
    monthly.at(-1) ??
    null;

  return {
    current,
    monthly,
    ustva: current
      ? buildUstvaPreparation({
          monthKey: current.monthKey,
          monthLabel: current.monthLabel,
          outputVatCents: current.outputVatCents,
          refundedVatEstimateCents: current.refundedVatEstimateCents,
          inputVatCents: current.inputVatCents,
          estimatedLiabilityCents: current.estimatedLiabilityCents,
          ordersMissingTaxCount: current.ordersMissingTaxCount,
          status: current.status,
          blockers: current.blockers,
          notes: current.notes,
          missingExpenseDocumentCount: current.missingExpenseDocumentCount,
          missingExpenseVatCount: current.missingExpenseVatCount,
          missingExpenseSupplierCount: current.missingExpenseSupplierCount,
          reviewRequiredExpenseCount: current.reviewRequiredExpenseCount,
          blockedExpenseCount: current.blockedExpenseCount,
          reverseChargeExpenseCount: current.reverseChargeExpenseCount,
        })
      : null,
    deadline: getVatDeadlineInfo(),
    expenseMigrationRequired: expenseQuery.migrationRequired,
  };
}

export async function getExpensesPageData(days = 120) {
  const since = getDateDaysAgo(days - 1);
  const [expenseQuery, recurringExpenseQuery, suppliers] = await Promise.all([
    queryExpensesSince(since),
    queryRecurringExpenses(),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const expenses = expenseQuery.expenses;
  const recurringExpenses = recurringExpenseQuery.recurringExpenses;

  const summary = buildExpenseSummary(expenses);
  const recurringSummary = buildRecurringExpenseSummary(recurringExpenses);
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const currentMonthExpenses = expenses.filter(
    (expense) => expense.documentDate >= currentMonthStart,
  );
  const currentMonthSummary = buildExpenseSummary(currentMonthExpenses);
  const expenseByCategory = Array.from(
    currentMonthExpenses.reduce(
      (map, expense) => {
        const entry = map.get(expense.category) ?? {
          category: expense.category,
          grossAmount: 0,
          vatAmount: 0,
          count: 0,
        };
        entry.grossAmount += expense.grossAmount;
        entry.vatAmount += expense.vatAmount;
        entry.count += 1;
        map.set(expense.category, entry);
        return map;
      },
      new Map<
        string,
        { category: string; grossAmount: number; vatAmount: number; count: number }
      >(),
    ).values(),
  ).sort((left, right) => right.grossAmount - left.grossAmount);

  return {
    expenses,
    recurringExpenses,
    suppliers,
    summary,
    recurringSummary,
    currentMonthSummary,
    expenseByCategory,
    deadline: getVatDeadlineInfo(),
    expenseMigrationRequired:
      expenseQuery.migrationRequired || recurringExpenseQuery.migrationRequired,
  };
}

export async function getProfitabilityPageData(days: AdminTimeRangeDays = 30) {
  const [
    productPerformance,
    allFinanceData,
    mainFinanceData,
    growFinanceData,
    mainCatalogCount,
    mainExclusiveCatalogCount,
    growCatalogCount,
    growExclusiveCatalogCount,
  ] = await Promise.all([
    getProductPerformance(days),
    getFinancePageData(days),
    getFinancePageData(days, "MAIN"),
    getFinancePageData(days, "GROW"),
    prisma.product.count({
      where: { status: "ACTIVE", storefronts: { has: "MAIN" } },
    }),
    prisma.product.count({
      where: {
        status: "ACTIVE",
        storefronts: { has: "MAIN" },
        NOT: { storefronts: { has: "GROW" } },
      },
    }),
    prisma.product.count({
      where: { status: "ACTIVE", storefronts: { has: "GROW" } },
    }),
    prisma.product.count({
      where: {
        status: "ACTIVE",
        storefronts: { has: "GROW" },
        NOT: { storefronts: { has: "MAIN" } },
      },
    }),
  ]);
  const productIds = productPerformance.map((item) => item.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          title: true,
          storefronts: true,
          supplierRef: { select: { name: true } },
          mainCategory: { select: { name: true } },
        },
      })
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  const rows = productPerformance
    .map((item) => {
      const product = productMap.get(item.productId);
      return {
        ...item,
        storefronts: product?.storefronts ?? ["MAIN"],
        categoryName: product?.mainCategory?.name ?? "Uncategorized",
        supplierName: product?.supplierRef?.name ?? "Unknown supplier",
        marginRate: item.revenueCents > 0 ? item.marginCents / item.revenueCents : 0,
      };
    })
    .sort((left, right) => right.marginCents - left.marginCents);

  const buildStorefrontSummary = (
    storefront: Storefront,
    financeData: Awaited<ReturnType<typeof getFinancePageData>>,
    activeProductCount: number,
    exclusiveProductCount: number,
  ) => {
    const paidOrderCount = financeData.currentFinance.paidOrderCount;
    return {
      storefront,
      label: STOREFRONT_LABELS[storefront],
      activeProductCount,
      exclusiveProductCount,
      paidOrderCount,
      refundedOrderCount: financeData.currentFinance.refundedOrderCount,
      grossRevenueCents: financeData.currentFinance.grossRevenueCents,
      netRevenueCents: financeData.currentFinance.netRevenueCents,
      contributionMarginCents: financeData.currentFinance.contributionMarginCents,
      contributionMarginRatio: financeData.currentFinance.contributionMarginRatio,
      averageOrderValueCents:
        paidOrderCount > 0
          ? Math.round(financeData.currentFinance.grossRevenueCents / paidOrderCount)
          : 0,
      contributionPerOrderCents:
        paidOrderCount > 0
          ? Math.round(financeData.currentFinance.contributionMarginCents / paidOrderCount)
          : 0,
      refundRate:
        paidOrderCount > 0
          ? financeData.currentFinance.refundedOrderCount / paidOrderCount
          : 0,
    };
  };

  const storefronts = [
    buildStorefrontSummary("MAIN", mainFinanceData, mainCatalogCount, mainExclusiveCatalogCount),
    buildStorefrontSummary("GROW", growFinanceData, growCatalogCount, growExclusiveCatalogCount),
  ].sort((left, right) => right.contributionMarginCents - left.contributionMarginCents);

  const priceLiftCandidates = [...rows]
    .filter(
      (row) =>
        row.purchases >= 2 &&
        row.conversionRate >= 0.03 &&
        row.marginRate > 0 &&
        row.marginRate <= 0.35,
    )
    .sort((left, right) => {
      if (right.purchases !== left.purchases) return right.purchases - left.purchases;
      if (right.conversionRate !== left.conversionRate) {
        return right.conversionRate - left.conversionRate;
      }
      return left.marginRate - right.marginRate;
    })
    .slice(0, 8);

  const marginLeakCandidates = [...rows]
    .filter(
      (row) =>
        row.views >= 20 && (row.marginCents <= 0 || row.marginRate <= 0.18),
    )
    .sort((left, right) => {
      if (right.views !== left.views) return right.views - left.views;
      if (left.marginRate !== right.marginRate) return left.marginRate - right.marginRate;
      return left.marginCents - right.marginCents;
    })
    .slice(0, 8);

  const scaleCandidates = [...rows]
    .filter(
      (row) =>
        row.marginCents > 0 &&
        row.marginRate >= 0.25 &&
        row.conversionRate >= 0.02 &&
        row.views <= 120,
    )
    .sort((left, right) => {
      if (right.marginCents !== left.marginCents) return right.marginCents - left.marginCents;
      if (right.marginRate !== left.marginRate) return right.marginRate - left.marginRate;
      return left.views - right.views;
    })
    .slice(0, 8);

  const growExpansionCandidates = [...rows]
    .filter(
      (row) =>
        row.storefronts.includes("MAIN") &&
        !row.storefronts.includes("GROW") &&
        row.marginCents > 0 &&
        row.purchases >= 2 &&
        row.conversionRate >= 0.02,
    )
    .sort((left, right) => {
      if (right.marginCents !== left.marginCents) return right.marginCents - left.marginCents;
      if (right.purchases !== left.purchases) return right.purchases - left.purchases;
      return right.conversionRate - left.conversionRate;
    })
    .slice(0, 8);

  const unattributedPaidOrders = Math.max(
    allFinanceData.currentFinance.paidOrderCount -
      mainFinanceData.currentFinance.paidOrderCount -
      growFinanceData.currentFinance.paidOrderCount,
    0,
  );
  const unattributedContributionCents = Math.max(
    allFinanceData.currentFinance.contributionMarginCents -
      mainFinanceData.currentFinance.contributionMarginCents -
      growFinanceData.currentFinance.contributionMarginCents,
    0,
  );

  return {
    rows,
    topProfit: rows.slice(0, 10),
    lowestProfit: [...rows].sort((left, right) => left.marginCents - right.marginCents).slice(0, 10),
    strongestMargin: [...rows].sort((left, right) => right.marginRate - left.marginRate).slice(0, 10),
    weakestMargin: [...rows].sort((left, right) => left.marginRate - right.marginRate).slice(0, 10),
    storefronts,
    opportunities: {
      priceLiftCandidates,
      marginLeakCandidates,
      scaleCandidates,
      growExpansionCandidates,
    },
    coverage: {
      currency: allFinanceData.currentFinance.currency,
      unattributedPaidOrders,
      unattributedContributionCents,
    },
  };
}

export async function getAlertsPageData() {
  const currentStart = getDateDaysAgo(29);
  const [financeData, vatData, funnelSnapshot, orderComparisons, productPerformance, failedWebhookCount, pendingReturnCount, variants, stockCoverageMap] =
    await Promise.all([
      getFinancePageData(30),
      getVatPageData(4),
      getFunnelSnapshot(30),
      getOrderComparisons(30),
      getProductPerformance(30),
      prisma.processedWebhookEvent.count({ where: { status: "failed" } }),
      prisma.returnRequest.count({ where: { status: "PENDING" } }),
      prisma.variant.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          inventory: true,
          product: { select: { id: true, title: true, status: true } },
        },
        where: { product: { status: "ACTIVE" } },
      }),
      getStockCoverageMap(30),
    ]);

  const weakProducts = [...productPerformance]
    .filter((item) => item.views >= 5)
    .sort((left, right) => {
      if (right.views !== left.views) return right.views - left.views;
      return left.conversionRate - right.conversionRate;
    })
    .slice(0, 3);

  const lowStockVariants = variants
    .map((variant) => {
      const onHand = variant.inventory?.quantityOnHand ?? 0;
      const reserved = variant.inventory?.reserved ?? 0;
      const available = Math.max(onHand - reserved, 0);
      const velocity = stockCoverageMap.get(variant.id);
      const coverDays =
        velocity && velocity.dailyVelocity > 0 ? available / velocity.dailyVelocity : null;
      return {
        productId: variant.product.id,
        productTitle: variant.product.title,
        variantTitle: variant.title,
        available,
        coverDays,
      };
    })
    .filter((variant) => variant.available <= 0 || (variant.coverDays !== null && variant.coverDays < 7))
    .slice(0, 5);

  const alerts = [
    failedWebhookCount > 0
      ? {
          type: "webhook_failures",
          title: "Stripe webhook failures need review",
          detail: `${failedWebhookCount} failed events can block payment and order reconciliation.`,
          priority: "critical",
          actionLabel: "Open orders",
          href: "/admin/orders",
          category: "Payments",
          dedupeKey: buildAlertDedupeKey(["payments", "webhook_failures"]),
        }
      : null,
    vatData.deadline.daysUntilDue <= 7 && financeData.vatSummary.status !== "ready_for_handover"
      ? {
          type: "vat_deadline",
          title: "VAT deadline is approaching",
          detail: `${vatData.deadline.daysUntilDue} day(s) remain until the monthly VAT handover target date.`,
          priority: "high",
          actionLabel: "Open VAT",
          href: "/admin/vat",
          category: "VAT",
          dedupeKey: buildAlertDedupeKey(["vat", "deadline"]),
        }
      : null,
    financeData.currentExpenseSummary.missingDocumentCount > 0 ||
    financeData.currentExpenseSummary.missingVatCount > 0
      ? {
          type: "expense_incomplete",
          title: "Expense data is incomplete for input VAT",
          detail: `${financeData.currentExpenseSummary.missingDocumentCount} missing document record(s) and ${financeData.currentExpenseSummary.missingVatCount} missing VAT amount(s) need review.`,
          priority: "high",
          actionLabel: "Open expenses",
          href: "/admin/expenses",
          category: "Expenses",
          dedupeKey: buildAlertDedupeKey(["expenses", "input_vat_incomplete"]),
        }
      : null,
    financeData.vatSummary.status !== "ready_for_handover"
      ? {
          type: "vat_not_ready",
          title: "VAT monitoring is not handover-ready",
          detail:
            financeData.vatSummary.blockers[0] ??
            "Input VAT and expense completeness still need review.",
          priority: "high",
          actionLabel: "Open VAT",
          href: "/admin/vat",
          category: "VAT",
          dedupeKey: buildAlertDedupeKey(["vat", "handover_not_ready"]),
        }
      : null,
    typeof orderComparisons.revenue.deltaRatio === "number" &&
    orderComparisons.revenue.deltaRatio <= -0.15
      ? {
          type: "revenue_pace_down",
          title: "Revenue pace is below the previous period",
          detail: "30-day gross revenue has dropped materially versus the prior window.",
          priority: "high",
          actionLabel: "Open finance",
          href: "/admin/finance",
          category: "Finance",
          dedupeKey: buildAlertDedupeKey(["finance", "revenue_pace_down"]),
        }
      : null,
    funnelSnapshot.beginCheckout >= 10 && funnelSnapshot.checkoutAbandonmentRate >= 0.6
      ? {
          type: "checkout_abandonment",
          title: "Checkout abandonment is elevated",
          detail: `${Math.round(funnelSnapshot.checkoutAbandonmentRate * 100)}% of started checkouts are not converting.`,
          priority: "high",
          actionLabel: "Open analytics",
          href: "/admin/analytics",
          category: "Conversion",
          dedupeKey: buildAlertDedupeKey(["conversion", "checkout_abandonment"]),
        }
      : null,
    pendingReturnCount > 0
      ? {
          type: "pending_returns",
          title: "Pending return decisions are waiting",
          detail: `${pendingReturnCount} return requests still need routing or resolution.`,
          priority: "medium",
          actionLabel: "Open returns",
          href: "/admin/returns",
          category: "Support",
          dedupeKey: buildAlertDedupeKey(["support", "pending_returns"]),
        }
      : null,
    lowStockVariants[0]
      ? {
          type: "low_stock",
          title: `${lowStockVariants[0].productTitle} needs replenishment`,
          detail:
            lowStockVariants[0].available <= 0
              ? `${lowStockVariants[0].variantTitle} is already out of stock.`
              : `${Math.round(lowStockVariants[0].coverDays ?? 0)} days of stock cover remain on ${lowStockVariants[0].variantTitle}.`,
          priority: "high",
          actionLabel: "Open catalog",
          href: "/admin/catalog",
          category: "Inventory",
          dedupeKey: buildAlertDedupeKey([
            "inventory",
            "low_stock",
            lowStockVariants[0].productId,
            lowStockVariants[0].variantTitle,
          ]),
        }
      : null,
    weakProducts[0]
      ? {
          type: "weak_margin_product",
          title: `${weakProducts[0].productTitle} is high-traffic but weak-margin`,
          detail: `${weakProducts[0].views} views, ${Math.round(
            weakProducts[0].conversionRate * 100,
          )}% CVR and ${Math.round(
            (weakProducts[0].marginCents / Math.max(weakProducts[0].revenueCents, 1)) * 100,
          )}% margin in the last 30 days.`,
          priority: "medium",
          actionLabel: "Open profitability",
          href: "/admin/profitability",
          category: "Merchandising",
          dedupeKey: buildAlertDedupeKey([
            "merchandising",
            "weak_margin",
            weakProducts[0].productId,
          ]),
        }
      : null,
    ...buildGrowvaultDiagnosticAlerts(
      (await getGrowvaultSharedDiagnosticsFeed()).statuses,
    ),
  ].filter(Boolean) as Array<{
    type: string;
    title: string;
    detail: string;
    priority: "critical" | "high" | "medium";
    actionLabel: string;
    href: string;
    category: string;
    dedupeKey: string;
  }>;

  await syncAdminAlerts(alerts);
  const queueData = await getAdminAlertsQueueData();

  return {
    alerts: queueData.alerts,
    assignees: queueData.assignees,
    currentStart,
  };
}
