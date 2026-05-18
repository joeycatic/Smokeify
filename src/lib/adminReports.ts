import "server-only";

import { type AdminReportDeliveryFrequency, type Storefront } from "@prisma/client";
import { PAID_ORDER_STATUSES, getDateDaysAgo } from "@/lib/adminInsights";
import { getFinancePageData } from "@/lib/adminAddonData";
import {
  DEFAULT_ADMIN_TIME_RANGE_DAYS,
  parseAdminTimeRangeDays,
  type AdminTimeRangeDays,
} from "@/lib/adminTimeRange";
import { formatOrderSourceLabel } from "@/lib/orderSource";
import { prisma } from "@/lib/prisma";

export const ADMIN_REPORT_TYPES = ["overview", "orders", "products", "customers"] as const;
export type AdminReportType = (typeof ADMIN_REPORT_TYPES)[number];

export const ADMIN_REPORT_PAYMENT_STATES = ["all", "paid", "pending", "refunded"] as const;
export type AdminReportPaymentState = (typeof ADMIN_REPORT_PAYMENT_STATES)[number];

export type AdminReportFilters = {
  reportType: AdminReportType;
  days: AdminTimeRangeDays;
  sourceStorefront: Storefront | "ALL";
  paymentState: AdminReportPaymentState;
};

export type AdminSavedReportSnapshot = {
  id: string;
  name: string;
  reportType: string;
  days: number;
  sourceStorefront: Storefront | "ALL";
  paymentState: string;
  createdByEmail: string | null;
  deliveryEnabled: boolean;
  deliveryEmail: string | null;
  deliveryFrequency: AdminReportDeliveryFrequency | null;
  deliveryWeekday: number | null;
  deliveryHour: number | null;
  lastDeliveredAt: string | null;
  nextDeliveryAt: string | null;
  updatedAt: string;
};

const PAID_STATUS_SET = new Set(PAID_ORDER_STATUSES);
const REFUNDED_STATUSES = new Set(["refunded", "partially_refunded"]);

export function parseAdminReportType(value: string | string[] | undefined): AdminReportType {
  const normalized = Array.isArray(value) ? value[0] : value;
  return ADMIN_REPORT_TYPES.includes(normalized as AdminReportType)
    ? (normalized as AdminReportType)
    : "overview";
}

export function parseAdminReportPaymentState(
  value: string | string[] | undefined,
): AdminReportPaymentState {
  const normalized = Array.isArray(value) ? value[0] : value;
  return ADMIN_REPORT_PAYMENT_STATES.includes(normalized as AdminReportPaymentState)
    ? (normalized as AdminReportPaymentState)
    : "all";
}

export function parseAdminReportStorefront(
  value: string | string[] | undefined,
): Storefront | "ALL" {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "MAIN" || normalized === "GROW" ? normalized : "ALL";
}

export function parseAdminReportFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): AdminReportFilters {
  return {
    reportType: parseAdminReportType(searchParams?.reportType),
    days: parseAdminTimeRangeDays(searchParams?.days),
    sourceStorefront: parseAdminReportStorefront(searchParams?.sourceStorefront),
    paymentState: parseAdminReportPaymentState(searchParams?.paymentState),
  };
}

export function serializeAdminReportFilters(filters: AdminReportFilters) {
  return {
    reportType: filters.reportType,
    days: String(filters.days),
    sourceStorefront: filters.sourceStorefront,
    paymentState: filters.paymentState,
  };
}

function buildOrderWhere(
  start: Date,
  endExclusive: Date | undefined,
  filters: Pick<AdminReportFilters, "sourceStorefront" | "paymentState">,
) {
  const paymentWhere =
    filters.paymentState === "paid"
      ? { paymentStatus: { in: [...PAID_ORDER_STATUSES] } }
      : filters.paymentState === "pending"
        ? { paymentStatus: { notIn: [...PAID_ORDER_STATUSES] } }
        : filters.paymentState === "refunded"
          ? {
              OR: [
                { amountRefunded: { gt: 0 } },
                { paymentStatus: { in: [...REFUNDED_STATUSES] } },
              ],
            }
          : {};

  return {
    createdAt: endExclusive ? { gte: start, lt: endExclusive } : { gte: start },
    ...(filters.sourceStorefront === "ALL"
      ? {}
      : { sourceStorefront: filters.sourceStorefront }),
    ...paymentWhere,
  };
}

const calculateOrderMetrics = <
  T extends { amountTotal: number; amountRefunded: number; paymentStatus: string; customerEmail: string | null }
>(
  orders: T[],
) => {
  let grossRevenueCents = 0;
  let refundedCents = 0;
  let orderCount = 0;
  const customerEmails = new Set<string>();

  for (const order of orders) {
    const normalizedStatus = order.paymentStatus.trim().toLowerCase();
    const isPaid = PAID_STATUS_SET.has(normalizedStatus);
    const isRefunded =
      order.amountRefunded > 0 || REFUNDED_STATUSES.has(normalizedStatus);

    if (isPaid) {
      grossRevenueCents += order.amountTotal;
      orderCount += 1;
    }
    if (isRefunded) refundedCents += order.amountRefunded;
    if (order.customerEmail) customerEmails.add(order.customerEmail.toLowerCase());
  }

  return {
    grossRevenueCents,
    refundedCents,
    orderCount,
    averageOrderValueCents: orderCount > 0 ? Math.round(grossRevenueCents / orderCount) : 0,
    customerCount: customerEmails.size,
  };
};

const buildDelta = (current: number, previous: number) => ({
  current,
  previous,
  deltaRatio: previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0,
});

export async function getAdminReportSnapshot(filters: AdminReportFilters) {
  const currentStart = getDateDaysAgo(filters.days - 1);
  const previousStart = getDateDaysAgo(filters.days * 2 - 1);
  const [orders, topProducts, latestOrders, financeData, savedReports] = await Promise.all([
    prisma.order.findMany({
      where: buildOrderWhere(previousStart, undefined, filters),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        currency: true,
        amountTotal: true,
        amountRefunded: true,
        paymentStatus: true,
        status: true,
        customerEmail: true,
        sourceStorefront: true,
        sourceHost: true,
        sourceOrigin: true,
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "name"],
      where: {
        productId: { not: null },
        order: buildOrderWhere(currentStart, undefined, filters),
      },
      _sum: {
        quantity: true,
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          totalAmount: "desc",
        },
      },
      take: 8,
    }),
    prisma.order.findMany({
      where: buildOrderWhere(currentStart, undefined, filters),
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        currency: true,
        amountTotal: true,
        paymentStatus: true,
        customerEmail: true,
        sourceStorefront: true,
        sourceHost: true,
        sourceOrigin: true,
      },
    }),
    getFinancePageData(filters.days),
    prisma.adminSavedReport.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
  ]);

  const currentOrders = orders.filter((order) => order.createdAt >= currentStart);
  const previousOrders = orders.filter((order) => order.createdAt < currentStart);
  const currentMetrics = calculateOrderMetrics(currentOrders);
  const previousMetrics = calculateOrderMetrics(previousOrders);
  const currency =
    currentOrders[0]?.currency ??
    previousOrders[0]?.currency ??
    financeData.currentFinance.currency ??
    "EUR";

  const sourceMap = new Map<
    string,
    { label: string; orders: number; revenueCents: number }
  >();
  for (const order of currentOrders) {
    const label = formatOrderSourceLabel(
      order.sourceStorefront,
      order.sourceHost,
      order.sourceOrigin,
    );
    const current = sourceMap.get(label) ?? { label, orders: 0, revenueCents: 0 };
    current.orders += 1;
    if (PAID_STATUS_SET.has(order.paymentStatus.trim().toLowerCase())) {
      current.revenueCents += order.amountTotal;
    }
    sourceMap.set(label, current);
  }

  const customerMap = new Map<
    string,
    { email: string; orders: number; revenueCents: number; lastOrderAt: Date }
  >();
  for (const order of currentOrders) {
    const email = order.customerEmail?.trim().toLowerCase();
    if (!email || !PAID_STATUS_SET.has(order.paymentStatus.trim().toLowerCase())) continue;
    const current = customerMap.get(email) ?? {
      email,
      orders: 0,
      revenueCents: 0,
      lastOrderAt: order.createdAt,
    };
    current.orders += 1;
    current.revenueCents += order.amountTotal;
    if (order.createdAt > current.lastOrderAt) current.lastOrderAt = order.createdAt;
    customerMap.set(email, current);
  }

  return {
    filters,
    currency,
    savedReports: savedReports.map((report) => ({
      id: report.id,
      name: report.name,
      reportType: report.reportType,
      days: report.days,
      sourceStorefront: report.sourceStorefront ?? "ALL",
      paymentState: report.paymentState,
      createdByEmail: report.createdByEmail,
      deliveryEnabled: report.deliveryEnabled,
      deliveryEmail: report.deliveryEmail,
      deliveryFrequency: report.deliveryFrequency,
      deliveryWeekday: report.deliveryWeekday,
      deliveryHour: report.deliveryHour,
      lastDeliveredAt: report.lastDeliveredAt?.toISOString() ?? null,
      nextDeliveryAt: report.nextDeliveryAt?.toISOString() ?? null,
      updatedAt: report.updatedAt.toISOString(),
    })),
    summary: {
      revenue: buildDelta(currentMetrics.grossRevenueCents, previousMetrics.grossRevenueCents),
      orders: buildDelta(currentMetrics.orderCount, previousMetrics.orderCount),
      averageOrderValue: buildDelta(
        currentMetrics.averageOrderValueCents,
        previousMetrics.averageOrderValueCents,
      ),
      customers: buildDelta(currentMetrics.customerCount, previousMetrics.customerCount),
      refunds: buildDelta(currentMetrics.refundedCents, previousMetrics.refundedCents),
    },
    finance: {
      contributionMarginCents: financeData.currentFinance.contributionMarginCents,
      contributionMarginRatio: financeData.currentFinance.contributionMarginRatio,
      estimatedProfitCents: financeData.currentFinance.estimatedProfitCents,
    },
    topSources: Array.from(sourceMap.values())
      .sort((left, right) => right.revenueCents - left.revenueCents)
      .slice(0, 8),
    topProducts: topProducts.map((row) => ({
      productId: row.productId ?? "",
      title: row.name,
      units: row._sum.quantity ?? 0,
      revenueCents: row._sum.totalAmount ?? 0,
    })),
    topCustomers: Array.from(customerMap.values())
      .sort((left, right) => right.revenueCents - left.revenueCents)
      .slice(0, 8)
      .map((entry) => ({
        ...entry,
        lastOrderAt: entry.lastOrderAt.toISOString(),
      })),
    recentOrders: latestOrders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

export async function exportAdminReportOrdersCsv(filters: AdminReportFilters) {
  const currentStart = getDateDaysAgo(filters.days - 1);
  const orders = await prisma.order.findMany({
    where: buildOrderWhere(currentStart, undefined, filters),
    orderBy: [{ createdAt: "desc" }],
    select: {
      orderNumber: true,
      createdAt: true,
      currency: true,
      amountTotal: true,
      amountRefunded: true,
      paymentStatus: true,
      status: true,
      customerEmail: true,
      sourceStorefront: true,
      sourceHost: true,
      shippingCountry: true,
    },
  });

  return orders;
}

export const ADMIN_REPORT_DEFAULT_FILTERS: AdminReportFilters = {
  reportType: "overview",
  days: DEFAULT_ADMIN_TIME_RANGE_DAYS,
  sourceStorefront: "ALL",
  paymentState: "all",
};
