import "server-only";

import { prisma } from "@/lib/prisma";
import { ACTIVE_ANALYTICS_WINDOW_MINUTES } from "@/lib/analyticsShared";

export const PAID_ORDER_STATUSES = ["paid", "succeeded", "refunded", "partially_refunded"];

export type ComparisonMetric = {
  current: number;
  previous: number;
  deltaRatio: number | null;
};

export type ProductPerformanceRow = {
  productId: string;
  productTitle: string;
  variantIds: string[];
  views: number;
  addToCart: number;
  beginCheckout: number;
  purchases: number;
  revenueCents: number;
  marginCents: number;
  conversionRate: number;
  addToCartRate: number;
};

export type FunnelSnapshot = {
  sessions: number;
  productViews: number;
  addToCart: number;
  beginCheckout: number;
  purchaseSessions: number;
  paidOrders: number;
  sessionToOrderRate: number;
  viewToCartRate: number;
  cartToCheckoutRate: number;
  checkoutToPaidRate: number;
  cartAbandonmentRate: number;
  checkoutAbandonmentRate: number;
};

export type FunnelTrendPoint = {
  label: string;
  sessions: number;
  productViews: number;
  addToCart: number;
  beginCheckout: number;
  purchases: number;
  paidOrders: number;
  revenueCents: number;
  sessionConversionRate: number;
  checkoutRate: number;
};

const buildComparisonMetric = (current: number, previous: number): ComparisonMetric => ({
  current,
  previous,
  deltaRatio: previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0,
});

export const getDateDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getActiveWindowStart = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - ACTIVE_ANALYTICS_WINDOW_MINUTES);
  return date;
};

const formatTrafficSourceLabel = (
  utmSource?: string | null,
  utmMedium?: string | null,
) => {
  if (utmSource && utmMedium) return `${utmSource} / ${utmMedium}`;
  if (utmSource) return utmSource;
  return "Direct / unknown";
};

const getDateKey = (value: Date) => value.toISOString().slice(0, 10);

export async function getActiveSessionSnapshot() {
  const activeSessions = await prisma.analyticsSession.findMany({
    where: {
      lastSeenAt: {
        gte: getActiveWindowStart(),
      },
    },
    select: {
      id: true,
      lastPath: true,
      lastPageType: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      lastSeenAt: true,
    },
  });

  const topPages = new Map<
    string,
    { path: string; pageType: string; count: number; lastSeenAt: Date }
  >();
  const trafficSources = new Map<string, { label: string; count: number }>();

  for (const session of activeSessions) {
    const path = session.lastPath ?? "/";
    const pageType = session.lastPageType ?? "other";
    const pageKey = `${pageType}:${path}`;
    const pageEntry = topPages.get(pageKey) ?? {
      path,
      pageType,
      count: 0,
      lastSeenAt: session.lastSeenAt,
    };
    pageEntry.count += 1;
    if (session.lastSeenAt > pageEntry.lastSeenAt) {
      pageEntry.lastSeenAt = session.lastSeenAt;
    }
    topPages.set(pageKey, pageEntry);

    const label = formatTrafficSourceLabel(session.utmSource, session.utmMedium);
    const sourceEntry = trafficSources.get(label) ?? { label, count: 0 };
    sourceEntry.count += 1;
    trafficSources.set(label, sourceEntry);
  }

  return {
    activeVisitorCount: activeSessions.length,
    topPages: Array.from(topPages.values())
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return right.lastSeenAt.getTime() - left.lastSeenAt.getTime();
      })
      .slice(0, 6),
    trafficSources: Array.from(trafficSources.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 6),
  };
}

async function getFunnelSnapshotForRange(start: Date, end?: Date): Promise<FunnelSnapshot> {
  const createdAtFilter = end ? { gte: start, lt: end } : { gte: start };
  const [
    sessionStarts,
    productViews,
    addToCart,
    beginCheckout,
    purchaseSessions,
    paidOrders,
  ] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: { createdAt: createdAtFilter, eventName: "page_view" },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: { createdAt: createdAtFilter, eventName: "view_item" },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: { createdAt: createdAtFilter, eventName: "add_to_cart" },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: { createdAt: createdAtFilter, eventName: "begin_checkout" },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: { createdAt: createdAtFilter, eventName: "purchase" },
    }),
    prisma.order.count({
      where: {
        createdAt: createdAtFilter,
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
    }),
  ]);

  const sessionCount = sessionStarts.length;
  const productViewCount = productViews.length;
  const addToCartCount = addToCart.length;
  const beginCheckoutCount = beginCheckout.length;
  const purchaseSessionCount = purchaseSessions.length;
  const effectiveCompletedCount = purchaseSessionCount > 0 ? purchaseSessionCount : paidOrders;

  return {
    sessions: sessionCount,
    productViews: productViewCount,
    addToCart: addToCartCount,
    beginCheckout: beginCheckoutCount,
    purchaseSessions: purchaseSessionCount,
    paidOrders,
    sessionToOrderRate: sessionCount > 0 ? effectiveCompletedCount / sessionCount : 0,
    viewToCartRate: productViewCount > 0 ? addToCartCount / productViewCount : 0,
    cartToCheckoutRate: addToCartCount > 0 ? beginCheckoutCount / addToCartCount : 0,
    checkoutToPaidRate:
      beginCheckoutCount > 0 ? effectiveCompletedCount / beginCheckoutCount : 0,
    cartAbandonmentRate: addToCartCount > 0 ? 1 - beginCheckoutCount / addToCartCount : 0,
    checkoutAbandonmentRate:
      beginCheckoutCount > 0
        ? Math.max(beginCheckoutCount - effectiveCompletedCount, 0) / beginCheckoutCount
        : 0,
  };
}

export async function getFunnelSnapshot(days = 30) {
  return getFunnelSnapshotForRange(getDateDaysAgo(days - 1));
}

export async function getFunnelComparison(days = 30) {
  const currentStart = getDateDaysAgo(days - 1);
  const previousStart = getDateDaysAgo(days * 2 - 1);
  const [current, previous] = await Promise.all([
    getFunnelSnapshotForRange(currentStart),
    getFunnelSnapshotForRange(previousStart, currentStart),
  ]);

  return {
    sessions: buildComparisonMetric(current.sessions, previous.sessions),
    beginCheckout: buildComparisonMetric(current.beginCheckout, previous.beginCheckout),
    paidOrders: buildComparisonMetric(current.paidOrders, previous.paidOrders),
    purchaseSessions: buildComparisonMetric(
      current.purchaseSessions > 0 ? current.purchaseSessions : current.paidOrders,
      previous.purchaseSessions > 0 ? previous.purchaseSessions : previous.paidOrders,
    ),
    sessionToOrderRate: buildComparisonMetric(
      current.sessionToOrderRate,
      previous.sessionToOrderRate,
    ),
    checkoutAbandonmentRate: buildComparisonMetric(
      current.checkoutAbandonmentRate,
      previous.checkoutAbandonmentRate,
    ),
    cartAbandonmentRate: buildComparisonMetric(
      current.cartAbandonmentRate,
      previous.cartAbandonmentRate,
    ),
  };
}

export async function getFunnelTrend(days = 14): Promise<FunnelTrendPoint[]> {
  const since = getDateDaysAgo(days - 1);
  const [events, paidOrders] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: since },
        eventName: { in: ["page_view", "view_item", "add_to_cart", "begin_checkout", "purchase"] },
      },
      select: {
        createdAt: true,
        eventName: true,
        sessionId: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
      select: {
        createdAt: true,
        amountTotal: true,
      },
    }),
  ]);

  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(since);
    date.setDate(since.getDate() + index);
    const label = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    return {
      label,
      key: getDateKey(date),
      sessions: new Set<string>(),
      productViews: new Set<string>(),
      addToCart: new Set<string>(),
      beginCheckout: new Set<string>(),
      purchases: new Set<string>(),
      paidOrders: 0,
      revenueCents: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const event of events) {
    const bucket = bucketMap.get(getDateKey(event.createdAt));
    if (!bucket) continue;
    if (event.eventName === "page_view") bucket.sessions.add(event.sessionId);
    if (event.eventName === "view_item") bucket.productViews.add(event.sessionId);
    if (event.eventName === "add_to_cart") bucket.addToCart.add(event.sessionId);
    if (event.eventName === "begin_checkout") bucket.beginCheckout.add(event.sessionId);
    if (event.eventName === "purchase") bucket.purchases.add(event.sessionId);
  }

  for (const order of paidOrders) {
    const bucket = bucketMap.get(getDateKey(order.createdAt));
    if (!bucket) continue;
    bucket.paidOrders += 1;
    bucket.revenueCents += order.amountTotal;
  }

  return buckets.map((bucket) => {
    const purchases = bucket.purchases.size > 0 ? bucket.purchases.size : bucket.paidOrders;
    const sessions = bucket.sessions.size;
    return {
      label: bucket.label,
      sessions,
      productViews: bucket.productViews.size,
      addToCart: bucket.addToCart.size,
      beginCheckout: bucket.beginCheckout.size,
      purchases,
      paidOrders: bucket.paidOrders,
      revenueCents: bucket.revenueCents,
      sessionConversionRate: sessions > 0 ? purchases / sessions : 0,
      checkoutRate: sessions > 0 ? bucket.beginCheckout.size / sessions : 0,
    };
  });
}

export async function getOrderComparisons(days = 30) {
  const currentStart = getDateDaysAgo(days - 1);
  const previousStart = getDateDaysAgo(days * 2 - 1);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: previousStart } },
    select: {
      createdAt: true,
      amountTotal: true,
      amountRefunded: true,
      paymentStatus: true,
      currency: true,
    },
  });

  let currentRevenue = 0;
  let previousRevenue = 0;
  let currentPaidOrders = 0;
  let previousPaidOrders = 0;
  let currentRefundedOrders = 0;
  let previousRefundedOrders = 0;

  for (const order of orders) {
    const paymentStatus = order.paymentStatus.trim().toLowerCase();
    const isCurrent = order.createdAt >= currentStart;
    const isPaid = PAID_ORDER_STATUSES.includes(paymentStatus);
    const isRefunded = order.amountRefunded > 0 || paymentStatus === "refunded";
    if (!isPaid && !isRefunded) continue;

    if (isCurrent) {
      if (isPaid) {
        currentRevenue += order.amountTotal;
        currentPaidOrders += 1;
      }
      if (isRefunded) currentRefundedOrders += 1;
      continue;
    }

    if (isPaid) {
      previousRevenue += order.amountTotal;
      previousPaidOrders += 1;
    }
    if (isRefunded) previousRefundedOrders += 1;
  }

  return {
    currency: orders.find((order) => PAID_ORDER_STATUSES.includes(order.paymentStatus.trim().toLowerCase()))?.currency ?? "EUR",
    revenue: buildComparisonMetric(currentRevenue, previousRevenue),
    paidOrders: buildComparisonMetric(currentPaidOrders, previousPaidOrders),
    aov: buildComparisonMetric(
      currentPaidOrders > 0 ? Math.round(currentRevenue / currentPaidOrders) : 0,
      previousPaidOrders > 0 ? Math.round(previousRevenue / previousPaidOrders) : 0
    ),
    refundRate: buildComparisonMetric(
      currentPaidOrders > 0 ? currentRefundedOrders / currentPaidOrders : 0,
      previousPaidOrders > 0 ? previousRefundedOrders / previousPaidOrders : 0
    ),
  };
}

export async function getCustomerRevenueMix(days = 30) {
  const since = getDateDaysAgo(days - 1);
  const [recentOrders, registeredFirstOrders, guestFirstOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
      select: {
        amountTotal: true,
        userId: true,
        customerEmail: true,
      },
    }),
    prisma.order.groupBy({
      by: ["userId"],
      where: {
        userId: { not: null },
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
      _min: { createdAt: true },
    }),
    prisma.order.groupBy({
      by: ["customerEmail"],
      where: {
        userId: null,
        customerEmail: { not: null },
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
      _min: { createdAt: true },
    }),
  ]);

  const registeredFirstMap = new Map(
    registeredFirstOrders
      .filter((entry): entry is typeof entry & { userId: string } => Boolean(entry.userId))
      .map((entry) => [entry.userId, entry._min.createdAt ?? since])
  );
  const guestFirstMap = new Map(
    guestFirstOrders
      .filter(
        (entry): entry is typeof entry & { customerEmail: string } => Boolean(entry.customerEmail)
      )
      .map((entry) => [entry.customerEmail.toLowerCase(), entry._min.createdAt ?? since])
  );

  let newRevenueCents = 0;
  let returningRevenueCents = 0;
  let newCustomerCount = 0;
  let returningCustomerCount = 0;
  const seenCustomerKeys = new Set<string>();

  for (const order of recentOrders) {
    const registeredKey = order.userId ? `user:${order.userId}` : null;
    const guestKey = !order.userId && order.customerEmail ? `guest:${order.customerEmail.toLowerCase()}` : null;
    const key = registeredKey ?? guestKey;
    if (!key) continue;

    const firstOrderAt = order.userId
      ? registeredFirstMap.get(order.userId)
      : guestFirstMap.get(order.customerEmail?.toLowerCase() ?? "");
    const isNewCustomer = firstOrderAt ? firstOrderAt >= since : false;

    if (isNewCustomer) {
      newRevenueCents += order.amountTotal;
      if (!seenCustomerKeys.has(key)) newCustomerCount += 1;
    } else {
      returningRevenueCents += order.amountTotal;
      if (!seenCustomerKeys.has(key)) returningCustomerCount += 1;
    }

    seenCustomerKeys.add(key);
  }

  return {
    newRevenueCents,
    returningRevenueCents,
    newCustomerCount,
    returningCustomerCount,
  };
}

export async function getProductPerformance(days = 30) {
  const since = getDateDaysAgo(days - 1);
  const [eventGroups, salesGroups] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["variantId", "eventName"],
      where: {
        createdAt: { gte: since },
        variantId: { not: null },
        eventName: { in: ["view_item", "add_to_cart", "begin_checkout"] },
      },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["variantId", "productId", "name"],
      where: {
        variantId: { not: null },
        order: {
          createdAt: { gte: since },
          paymentStatus: { in: PAID_ORDER_STATUSES },
        },
      },
      _sum: {
        quantity: true,
        totalAmount: true,
        adjustedCostAmount: true,
        baseCostAmount: true,
      },
    }),
  ]);

  const variantMetrics = new Map<
    string,
    {
      productId?: string | null;
      productTitle?: string;
      views: number;
      addToCart: number;
      beginCheckout: number;
      purchases: number;
      revenueCents: number;
      costCents: number;
    }
  >();

  for (const group of eventGroups) {
    const variantId = group.variantId;
    if (!variantId) continue;
    const entry = variantMetrics.get(variantId) ?? {
      views: 0,
      addToCart: 0,
      beginCheckout: 0,
      purchases: 0,
      revenueCents: 0,
      costCents: 0,
    };
    if (group.eventName === "view_item") entry.views += group._count._all;
    if (group.eventName === "add_to_cart") entry.addToCart += group._count._all;
    if (group.eventName === "begin_checkout") entry.beginCheckout += group._count._all;
    variantMetrics.set(variantId, entry);
  }

  for (const group of salesGroups) {
    const variantId = group.variantId;
    if (!variantId) continue;
    const entry = variantMetrics.get(variantId) ?? {
      views: 0,
      addToCart: 0,
      beginCheckout: 0,
      purchases: 0,
      revenueCents: 0,
      costCents: 0,
    };
    entry.productId = group.productId;
    entry.productTitle = group.name;
    entry.purchases += group._sum.quantity ?? 0;
    entry.revenueCents += group._sum.totalAmount ?? 0;
    entry.costCents +=
      (group._sum.adjustedCostAmount ?? 0) > 0
        ? group._sum.adjustedCostAmount ?? 0
        : group._sum.baseCostAmount ?? 0;
    variantMetrics.set(variantId, entry);
  }

  const variantIds = Array.from(variantMetrics.keys());
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          productId: true,
          title: true,
          product: { select: { title: true } },
        },
      })
    : [];
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const productMetrics = new Map<string, ProductPerformanceRow>();
  for (const [variantId, metric] of variantMetrics.entries()) {
    const variant = variantMap.get(variantId);
    const productId = metric.productId ?? variant?.productId;
    if (!productId) continue;

    const productTitle =
      variant?.product.title ?? metric.productTitle ?? `Product ${productId.slice(0, 8)}`;
    const current = productMetrics.get(productId) ?? {
      productId,
      productTitle,
      variantIds: [],
      views: 0,
      addToCart: 0,
      beginCheckout: 0,
      purchases: 0,
      revenueCents: 0,
      marginCents: 0,
      conversionRate: 0,
      addToCartRate: 0,
    };
    current.variantIds.push(variantId);
    current.views += metric.views;
    current.addToCart += metric.addToCart;
    current.beginCheckout += metric.beginCheckout;
    current.purchases += metric.purchases;
    current.revenueCents += metric.revenueCents;
    current.marginCents += metric.revenueCents - metric.costCents;
    productMetrics.set(productId, current);
  }

  const rows = Array.from(productMetrics.values()).map((entry) => ({
    ...entry,
    conversionRate: entry.views > 0 ? entry.purchases / entry.views : 0,
    addToCartRate: entry.views > 0 ? entry.addToCart / entry.views : 0,
  }));

  return rows;
}

export async function getStockCoverageMap(days = 30) {
  const since = getDateDaysAgo(days - 1);
  const salesGroups = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: {
      variantId: { not: null },
      order: {
        createdAt: { gte: since },
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
    },
    _sum: { quantity: true },
  });

  const map = new Map<string, { unitsSold: number; dailyVelocity: number; coverDays: number | null }>();
  for (const group of salesGroups) {
    const variantId = group.variantId;
    if (!variantId) continue;
    const unitsSold = group._sum.quantity ?? 0;
    const dailyVelocity = unitsSold > 0 ? unitsSold / days : 0;
    map.set(variantId, {
      unitsSold,
      dailyVelocity,
      coverDays: dailyVelocity > 0 ? 0 : null,
    });
  }

  return map;
}

export async function getActivityFeed(limit = 12) {
  const [auditLogs, recentOrders, recentReturns, webhookFailures] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        summary: true,
        actorEmail: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { paymentStatus: { in: PAID_ORDER_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        amountTotal: true,
        currency: true,
        customerEmail: true,
        createdAt: true,
      },
    }),
    prisma.returnRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        reason: true,
        createdAt: true,
        user: { select: { email: true } },
        order: { select: { orderNumber: true } },
      },
    }),
    prisma.processedWebhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        eventId: true,
        type: true,
        createdAt: true,
      },
    }),
  ]);

  return [
    ...auditLogs.map((entry) => ({
      id: `audit-${entry.id}`,
      title: entry.summary ?? entry.action,
      subtitle: entry.actorEmail ?? "Admin action",
      createdAt: entry.createdAt,
      tone: "neutral" as const,
    })),
    ...recentOrders.map((entry) => ({
      id: `order-${entry.id}`,
      title: `Paid order #${entry.orderNumber}`,
      subtitle: `${entry.customerEmail ?? "Unknown"} · ${entry.amountTotal / 100} ${entry.currency}`,
      createdAt: entry.createdAt,
      tone: "positive" as const,
    })),
    ...recentReturns.map((entry) => ({
      id: `return-${entry.id}`,
      title: `Return ${entry.status.toLowerCase()} for #${entry.order.orderNumber}`,
      subtitle: entry.user.email ?? entry.reason,
      createdAt: entry.createdAt,
      tone: entry.status === "PENDING" ? ("warning" as const) : ("neutral" as const),
    })),
    ...webhookFailures.map((entry) => ({
      id: `webhook-${entry.id}`,
      title: `Webhook failed: ${entry.type}`,
      subtitle: entry.eventId,
      createdAt: entry.createdAt,
      tone: "critical" as const,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit);
}
