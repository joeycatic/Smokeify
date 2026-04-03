import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { getGrowvaultProductVariantPricingSafe } from "@/lib/adminPricingIntegration";
import { getStockCoverageMap, PAID_ORDER_STATUSES } from "@/lib/adminInsights";
import { prisma } from "@/lib/prisma";
import AdminProductClient from "./AdminProductClient";

export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await requireAdmin())) notFound();
  const requestHeaders = await headers();

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { options: true, inventory: true },
      },
      categories: {
        orderBy: { position: "asc" },
        include: { category: true },
      },
      collections: {
        orderBy: { position: "asc" },
        include: { collection: true },
      },
    },
  });

  if (!product) notFound();

  const variantIds = product.variants.map((variant) => variant.id);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    categories,
    collections,
    suppliers,
    crossSells,
    stockCoverageMap,
    analytics30d,
    analytics7d,
    sales30d,
    sales7d,
    trafficSources,
    returnItems,
    pricingProfilesResult,
  ] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.collection.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, leadTimeDays: true },
    }),
    prisma.productCrossSell
      ? prisma.productCrossSell.findMany({
          where: { productId: id },
          orderBy: { sortOrder: "asc" },
          include: {
            crossSell: {
              select: {
                id: true,
                title: true,
                handle: true,
                images: { take: 1, orderBy: { position: "asc" } },
              },
            },
          },
        })
      : Promise.resolve([]),
    getStockCoverageMap(30),
    prisma.analyticsEvent.groupBy({
      by: ["eventName"],
      where: {
        productId: id,
        createdAt: { gte: thirtyDaysAgo },
        eventName: { in: ["view_item", "add_to_cart", "begin_checkout"] },
      },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["eventName"],
      where: {
        productId: id,
        createdAt: { gte: sevenDaysAgo },
        eventName: { in: ["view_item", "add_to_cart", "begin_checkout"] },
      },
      _count: { _all: true },
    }),
    prisma.orderItem.aggregate({
      where: {
        productId: id,
        order: {
          createdAt: { gte: thirtyDaysAgo },
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
    prisma.orderItem.aggregate({
      where: {
        productId: id,
        order: {
          createdAt: { gte: sevenDaysAgo },
          paymentStatus: { in: PAID_ORDER_STATUSES },
        },
      },
      _sum: {
        quantity: true,
        totalAmount: true,
      },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["utmSource"],
      where: {
        productId: id,
        createdAt: { gte: thirtyDaysAgo },
        eventName: "view_item",
      },
      _count: { _all: true },
    }),
    prisma.returnItem.findMany({
      where: {
        orderItem: { productId: id },
        request: { createdAt: { gte: thirtyDaysAgo } },
      },
      select: {
        quantity: true,
        request: { select: { reason: true } },
      },
    }),
    getGrowvaultProductVariantPricingSafe(id, {
      forwardedCookieHeader: requestHeaders.get("cookie"),
    }),
  ]);

  const analytics30dMap = new Map(analytics30d.map((row) => [row.eventName, row._count._all]));
  const analytics7dMap = new Map(analytics7d.map((row) => [row.eventName, row._count._all]));
  const totalAvailableInventory = product.variants.reduce((sum, variant) => {
    const onHand = variant.inventory?.quantityOnHand ?? 0;
    const reserved = variant.inventory?.reserved ?? 0;
    return sum + Math.max(onHand - reserved, 0);
  }, 0);
  const aggregateDailyVelocity = variantIds.reduce(
    (sum, variantId) => sum + (stockCoverageMap.get(variantId)?.dailyVelocity ?? 0),
    0,
  );
  const views30d = analytics30dMap.get("view_item") ?? 0;
  const addToCart30d = analytics30dMap.get("add_to_cart") ?? 0;
  const beginCheckout30d = analytics30dMap.get("begin_checkout") ?? 0;
  const purchases30d = sales30d._sum.quantity ?? 0;
  const revenue30dCents = sales30d._sum.totalAmount ?? 0;
  const baseCost30dCents =
    (sales30d._sum.adjustedCostAmount ?? 0) > 0
      ? sales30d._sum.adjustedCostAmount ?? 0
      : sales30d._sum.baseCostAmount ?? 0;
  const margin30dCents = revenue30dCents - baseCost30dCents;
  const recentTrendBase =
    (analytics7dMap.get("view_item") ?? 0) +
    (sales7d._sum.quantity ?? 0) * 5 +
    (sales7d._sum.totalAmount ?? 0) / 5_000;
  const baselineTrendBase = views30d + purchases30d * 5 + revenue30dCents / 5_000;
  const trendDeltaRatio =
    baselineTrendBase > 0
      ? recentTrendBase / Math.max((baselineTrendBase / 30) * 7, 1) - 1
      : recentTrendBase > 0
        ? 1
        : 0;
  const returnedUnits30d = returnItems.reduce((sum, item) => sum + item.quantity, 0);
  const returnReasonsMap = new Map<string, number>();
  for (const item of returnItems) {
    const key = item.request.reason.trim() || "Unknown";
    returnReasonsMap.set(key, (returnReasonsMap.get(key) ?? 0) + item.quantity);
  }

  const trendDirection: "trending" | "steady" | "cooling" =
    trendDeltaRatio >= 0.35 ? "trending" : trendDeltaRatio <= -0.25 ? "cooling" : "steady";

  const productInsights = {
    views30d,
    addToCart30d,
    beginCheckout30d,
    purchases30d,
    revenue30dCents,
    margin30dCents,
    marginRate30d: revenue30dCents > 0 ? margin30dCents / revenue30dCents : 0,
    conversionRate30d: views30d > 0 ? purchases30d / views30d : 0,
    addToCartRate30d: views30d > 0 ? addToCart30d / views30d : 0,
    checkoutToPaidRate30d: beginCheckout30d > 0 ? purchases30d / beginCheckout30d : 0,
    returnedUnits30d,
    returnRate30d: purchases30d > 0 ? returnedUnits30d / purchases30d : 0,
    stockCoverDays: aggregateDailyVelocity > 0 ? totalAvailableInventory / aggregateDailyVelocity : null,
    trendDirection,
    trendDeltaRatio,
    topTrafficSources: trafficSources
      .map((entry) => ({
        label: entry.utmSource ?? "Direct / unknown",
        count: entry._count._all,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    topReturnReasons: Array.from(returnReasonsMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
  };

  return (
    <div className="mx-auto max-w-[1440px] px-0 py-2 text-slate-100">
      <AdminProductClient
        product={{
          ...product,
          storefronts:
            (product as { storefronts?: ("MAIN" | "GROW")[] }).storefronts ?? ["MAIN"],
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
          variants: product.variants.map((variant) => ({
            ...variant,
            updatedAt: variant.updatedAt.toISOString(),
          })),
        }}
        categories={categories}
        collections={collections}
        suppliers={suppliers}
        crossSells={crossSells.map((row) => ({
          crossSell: {
            id: row.crossSell.id,
            title: row.crossSell.title,
            handle: row.crossSell.handle,
            imageUrl: row.crossSell.images[0]?.url ?? null,
          },
        }))}
        insights={productInsights}
        pricingProfilesByVariantId={pricingProfilesResult.data ?? {}}
        pricingIntegrationError={pricingProfilesResult.error}
      />
    </div>
  );
}
