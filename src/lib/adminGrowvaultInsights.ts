import "server-only";

import { ACTIVE_ANALYTICS_WINDOW_MINUTES } from "@/lib/analyticsShared";
import { buildAdminTimeBuckets, getAdminTimeWindowStart, type AdminTimeRangeDays } from "@/lib/adminTimeRange";
import { PAID_ORDER_STATUSES } from "@/lib/adminInsights";
import { prisma } from "@/lib/prisma";

const GROW_STOREFRONT = "GROW" as const;
const DEFAULT_LOCALE = "de-DE";

const GROWVAULT_FUNNEL_EVENTS = {
  addToCart: "add_to_cart",
  beginCheckout: "begin_checkout",
  shippingSubmitted: "add_shipping_info",
  paymentStarted: "add_payment_info",
  purchase: "purchase",
} as const;

type FunnelCountsInput = {
  addToCart: number;
  beginCheckout: number;
  shippingSubmitted: number;
  paymentStarted: number;
  purchaseSessions: number;
  paidOrders: number;
};

export type GrowvaultLiveSnapshot = {
  activeVisitorCount: number;
  topPages: Array<{
    path: string;
    pageType: string;
    count: number;
  }>;
  trafficSources: Array<{
    label: string;
    count: number;
  }>;
};

export type GrowvaultFunnelSnapshot = FunnelCountsInput & {
  sessionToPaidRate: number;
  cartToCheckoutRate: number;
  checkoutToShippingRate: number;
  shippingToPaymentRate: number;
  paymentToPaidRate: number;
  cartDropoffRate: number;
  checkoutDropoffRate: number;
  shippingDropoffRate: number;
  paymentDropoffRate: number;
};

export type GrowvaultFunnelTrendPoint = {
  label: string;
  addToCart: number;
  beginCheckout: number;
  shippingSubmitted: number;
  paymentStarted: number;
  purchases: number;
  paidOrders: number;
};

export type GrowvaultProductPerformanceRow = {
  productId: string;
  productTitle: string;
  variantIds: string[];
  addToCart: number;
  beginCheckout: number;
  paymentStarted: number;
  purchases: number;
  revenueCents: number;
  cartToPurchaseRate: number;
  checkoutToPurchaseRate: number;
};

export type GrowvaultInsights = {
  activeWindowMinutes: number;
  firstTaggedEventAt: string | null;
  funnel: GrowvaultFunnelSnapshot;
  live: GrowvaultLiveSnapshot;
  rangeStart: string;
  topProducts: GrowvaultProductPerformanceRow[];
  trend: GrowvaultFunnelTrendPoint[];
  underperformingProducts: GrowvaultProductPerformanceRow[];
  warningStartsAt: string | null;
};

const buildStageRate = (current: number, previous: number) =>
  previous > 0 ? current / previous : 0;

const buildStageDropoff = (current: number, previous: number) =>
  previous > 0 ? Math.max(previous - current, 0) / previous : 0;

const formatTrafficSourceLabel = (
  utmSource?: string | null,
  utmMedium?: string | null,
) => {
  if (utmSource && utmMedium) return `${utmSource} / ${utmMedium}`;
  if (utmSource) return utmSource;
  return "Direkt / Unbekannt";
};

const getActiveWindowStart = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - ACTIVE_ANALYTICS_WINDOW_MINUTES);
  return date;
};

export function buildGrowvaultFunnelSnapshot(
  input: FunnelCountsInput,
): GrowvaultFunnelSnapshot {
  const effectiveCompletedCount =
    input.purchaseSessions > 0 ? input.purchaseSessions : input.paidOrders;

  return {
    ...input,
    sessionToPaidRate: buildStageRate(effectiveCompletedCount, input.addToCart),
    cartToCheckoutRate: buildStageRate(input.beginCheckout, input.addToCart),
    checkoutToShippingRate: buildStageRate(
      input.shippingSubmitted,
      input.beginCheckout,
    ),
    shippingToPaymentRate: buildStageRate(
      input.paymentStarted,
      input.shippingSubmitted,
    ),
    paymentToPaidRate: buildStageRate(
      effectiveCompletedCount,
      input.paymentStarted,
    ),
    cartDropoffRate: buildStageDropoff(input.beginCheckout, input.addToCart),
    checkoutDropoffRate: buildStageDropoff(
      input.shippingSubmitted,
      input.beginCheckout,
    ),
    shippingDropoffRate: buildStageDropoff(
      input.paymentStarted,
      input.shippingSubmitted,
    ),
    paymentDropoffRate: buildStageDropoff(
      effectiveCompletedCount,
      input.paymentStarted,
    ),
  };
}

export function isGrowvaultRangePartiallyTracked(
  rangeStart: Date,
  firstTaggedEventAt: Date | null,
) {
  return Boolean(firstTaggedEventAt && rangeStart < firstTaggedEventAt);
}

function resolveTrendBucketKey(
  value: Date,
  buckets: Array<{ key: string; start: Date; endExclusive: Date }>,
) {
  const matched = buckets.find(
    (bucket) => value >= bucket.start && value < bucket.endExclusive,
  );
  return matched?.key ?? null;
}

async function countDistinctSessionsForEvent(
  eventName: string,
  rangeStart: Date,
) {
  const rows = await prisma.analyticsEvent.groupBy({
    by: ["sessionId"],
    where: {
      storefront: GROW_STOREFRONT,
      createdAt: { gte: rangeStart },
      eventName,
    },
  });

  return rows.length;
}

async function getGrowvaultLiveSnapshot(): Promise<GrowvaultLiveSnapshot> {
  const activeSessions = await prisma.analyticsSession.findMany({
    where: {
      storefront: GROW_STOREFRONT,
      lastSeenAt: { gte: getActiveWindowStart() },
    },
    select: {
      lastPath: true,
      lastPageType: true,
      lastSeenAt: true,
      utmSource: true,
      utmMedium: true,
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
      .slice(0, 6)
      .map(({ count, pageType, path }) => ({ count, pageType, path })),
    trafficSources: Array.from(trafficSources.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 6),
  };
}

async function getGrowvaultTrend(
  days: AdminTimeRangeDays,
): Promise<GrowvaultFunnelTrendPoint[]> {
  const rangeStart = getAdminTimeWindowStart(days);
  const buckets = buildAdminTimeBuckets(days, DEFAULT_LOCALE).map((bucket) => ({
    ...bucket,
    addToCart: new Set<string>(),
    beginCheckout: new Set<string>(),
    shippingSubmitted: new Set<string>(),
    paymentStarted: new Set<string>(),
    purchases: new Set<string>(),
    paidOrders: 0,
  }));
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  const [events, paidOrders] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: {
        storefront: GROW_STOREFRONT,
        createdAt: { gte: rangeStart },
        eventName: {
          in: [
            GROWVAULT_FUNNEL_EVENTS.addToCart,
            GROWVAULT_FUNNEL_EVENTS.beginCheckout,
            GROWVAULT_FUNNEL_EVENTS.shippingSubmitted,
            GROWVAULT_FUNNEL_EVENTS.paymentStarted,
            GROWVAULT_FUNNEL_EVENTS.purchase,
          ],
        },
      },
      select: {
        createdAt: true,
        eventName: true,
        sessionId: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: rangeStart },
        sourceStorefront: GROW_STOREFRONT,
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  for (const event of events) {
    const bucketKey = resolveTrendBucketKey(event.createdAt, buckets);
    if (!bucketKey) continue;
    const bucket = bucketMap.get(bucketKey);
    if (!bucket) continue;

    if (event.eventName === GROWVAULT_FUNNEL_EVENTS.addToCart) {
      bucket.addToCart.add(event.sessionId);
    }
    if (event.eventName === GROWVAULT_FUNNEL_EVENTS.beginCheckout) {
      bucket.beginCheckout.add(event.sessionId);
    }
    if (event.eventName === GROWVAULT_FUNNEL_EVENTS.shippingSubmitted) {
      bucket.shippingSubmitted.add(event.sessionId);
    }
    if (event.eventName === GROWVAULT_FUNNEL_EVENTS.paymentStarted) {
      bucket.paymentStarted.add(event.sessionId);
    }
    if (event.eventName === GROWVAULT_FUNNEL_EVENTS.purchase) {
      bucket.purchases.add(event.sessionId);
    }
  }

  for (const order of paidOrders) {
    const bucketKey = resolveTrendBucketKey(order.createdAt, buckets);
    if (!bucketKey) continue;
    const bucket = bucketMap.get(bucketKey);
    if (!bucket) continue;
    bucket.paidOrders += 1;
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    addToCart: bucket.addToCart.size,
    beginCheckout: bucket.beginCheckout.size,
    shippingSubmitted: bucket.shippingSubmitted.size,
    paymentStarted: bucket.paymentStarted.size,
    purchases:
      bucket.purchases.size > 0 ? bucket.purchases.size : bucket.paidOrders,
    paidOrders: bucket.paidOrders,
  }));
}

async function getGrowvaultProductPerformance(
  days: AdminTimeRangeDays,
): Promise<GrowvaultProductPerformanceRow[]> {
  const rangeStart = getAdminTimeWindowStart(days);
  const [eventGroups, salesGroups] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["variantId", "eventName"],
      where: {
        storefront: GROW_STOREFRONT,
        createdAt: { gte: rangeStart },
        variantId: { not: null },
        eventName: {
          in: [
            GROWVAULT_FUNNEL_EVENTS.addToCart,
            GROWVAULT_FUNNEL_EVENTS.beginCheckout,
            GROWVAULT_FUNNEL_EVENTS.paymentStarted,
          ],
        },
      },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["variantId", "productId", "name"],
      where: {
        variantId: { not: null },
        order: {
          createdAt: { gte: rangeStart },
          sourceStorefront: GROW_STOREFRONT,
          paymentStatus: { in: PAID_ORDER_STATUSES },
        },
      },
      _sum: {
        quantity: true,
        totalAmount: true,
      },
    }),
  ]);

  const variantMetrics = new Map<
    string,
    {
      productId?: string | null;
      productTitle?: string;
      addToCart: number;
      beginCheckout: number;
      paymentStarted: number;
      purchases: number;
      revenueCents: number;
    }
  >();

  for (const group of eventGroups) {
    const variantId = group.variantId;
    if (!variantId) continue;
    const entry = variantMetrics.get(variantId) ?? {
      addToCart: 0,
      beginCheckout: 0,
      paymentStarted: 0,
      purchases: 0,
      revenueCents: 0,
    };
    if (group.eventName === GROWVAULT_FUNNEL_EVENTS.addToCart) {
      entry.addToCart += group._count._all;
    }
    if (group.eventName === GROWVAULT_FUNNEL_EVENTS.beginCheckout) {
      entry.beginCheckout += group._count._all;
    }
    if (group.eventName === GROWVAULT_FUNNEL_EVENTS.paymentStarted) {
      entry.paymentStarted += group._count._all;
    }
    variantMetrics.set(variantId, entry);
  }

  for (const group of salesGroups) {
    const variantId = group.variantId;
    if (!variantId) continue;
    const entry = variantMetrics.get(variantId) ?? {
      addToCart: 0,
      beginCheckout: 0,
      paymentStarted: 0,
      purchases: 0,
      revenueCents: 0,
    };
    entry.productId = group.productId;
    entry.productTitle = group.name;
    entry.purchases += group._sum.quantity ?? 0;
    entry.revenueCents += group._sum.totalAmount ?? 0;
    variantMetrics.set(variantId, entry);
  }

  const variantIds = Array.from(variantMetrics.keys());
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          productId: true,
          product: { select: { title: true } },
        },
      })
    : [];
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const productMetrics = new Map<string, GrowvaultProductPerformanceRow>();
  for (const [variantId, metric] of variantMetrics.entries()) {
    const variant = variantMap.get(variantId);
    const productId = metric.productId ?? variant?.productId;
    if (!productId) continue;

    const productTitle =
      variant?.product.title ?? metric.productTitle ?? `Produkt ${productId.slice(0, 8)}`;
    const current = productMetrics.get(productId) ?? {
      productId,
      productTitle,
      variantIds: [],
      addToCart: 0,
      beginCheckout: 0,
      paymentStarted: 0,
      purchases: 0,
      revenueCents: 0,
      cartToPurchaseRate: 0,
      checkoutToPurchaseRate: 0,
    };

    current.variantIds.push(variantId);
    current.addToCart += metric.addToCart;
    current.beginCheckout += metric.beginCheckout;
    current.paymentStarted += metric.paymentStarted;
    current.purchases += metric.purchases;
    current.revenueCents += metric.revenueCents;
    productMetrics.set(productId, current);
  }

  return Array.from(productMetrics.values())
    .map((entry) => ({
      ...entry,
      cartToPurchaseRate: buildStageRate(entry.purchases, entry.addToCart),
      checkoutToPurchaseRate: buildStageRate(entry.purchases, entry.beginCheckout),
    }))
    .sort((left, right) => {
      if (right.purchases !== left.purchases) return right.purchases - left.purchases;
      if (right.revenueCents !== left.revenueCents) {
        return right.revenueCents - left.revenueCents;
      }
      return right.addToCart - left.addToCart;
    });
}

export async function getGrowvaultInsights(
  days: AdminTimeRangeDays,
): Promise<GrowvaultInsights> {
  const rangeStart = getAdminTimeWindowStart(days);

  const [
    firstTaggedEvent,
    live,
    addToCart,
    beginCheckout,
    shippingSubmitted,
    paymentStarted,
    purchaseSessions,
    paidOrders,
    trend,
    productRows,
  ] = await Promise.all([
    prisma.analyticsEvent.findFirst({
      where: { storefront: GROW_STOREFRONT },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    getGrowvaultLiveSnapshot(),
    countDistinctSessionsForEvent(GROWVAULT_FUNNEL_EVENTS.addToCart, rangeStart),
    countDistinctSessionsForEvent(
      GROWVAULT_FUNNEL_EVENTS.beginCheckout,
      rangeStart,
    ),
    countDistinctSessionsForEvent(
      GROWVAULT_FUNNEL_EVENTS.shippingSubmitted,
      rangeStart,
    ),
    countDistinctSessionsForEvent(
      GROWVAULT_FUNNEL_EVENTS.paymentStarted,
      rangeStart,
    ),
    countDistinctSessionsForEvent(GROWVAULT_FUNNEL_EVENTS.purchase, rangeStart),
    prisma.order.count({
      where: {
        createdAt: { gte: rangeStart },
        sourceStorefront: GROW_STOREFRONT,
        paymentStatus: { in: PAID_ORDER_STATUSES },
      },
    }),
    getGrowvaultTrend(days),
    getGrowvaultProductPerformance(days),
  ]);

  const topProducts = productRows.slice(0, 6);
  const underperformingProducts = [...productRows]
    .filter((row) => row.addToCart > 0 && row.purchases < row.addToCart)
    .sort((left, right) => {
      if (right.addToCart !== left.addToCart) return right.addToCart - left.addToCart;
      if (left.cartToPurchaseRate !== right.cartToPurchaseRate) {
        return left.cartToPurchaseRate - right.cartToPurchaseRate;
      }
      return right.beginCheckout - left.beginCheckout;
    })
    .slice(0, 6);

  const firstTaggedEventAt = firstTaggedEvent?.createdAt ?? null;
  const warningStartsAt = isGrowvaultRangePartiallyTracked(
    rangeStart,
    firstTaggedEventAt,
  )
    ? firstTaggedEventAt?.toISOString() ?? null
    : null;

  return {
    activeWindowMinutes: ACTIVE_ANALYTICS_WINDOW_MINUTES,
    firstTaggedEventAt: firstTaggedEventAt?.toISOString() ?? null,
    funnel: buildGrowvaultFunnelSnapshot({
      addToCart,
      beginCheckout,
      shippingSubmitted,
      paymentStarted,
      purchaseSessions,
      paidOrders,
    }),
    live,
    rangeStart: rangeStart.toISOString(),
    topProducts,
    trend,
    underperformingProducts,
    warningStartsAt,
  };
}
