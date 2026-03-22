import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

const PAID_STATUSES = ["paid", "refunded", "partially_refunded"];

const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const last14DaysStart = new Date(now);
  last14DaysStart.setDate(now.getDate() - 13);
  last14DaysStart.setHours(0, 0, 0, 0);

  const last30DaysStart = new Date(now);
  last30DaysStart.setDate(now.getDate() - 29);
  last30DaysStart.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    paidOrders,
    fulfilledOrders,
    refundedOrders,
    canceledOrders,
    totalRevenue,
    topItems,
    variants,
    totalAnalyses,
    fallbackAnalyses,
    feedbackTotal,
    feedbackCorrect,
    lowConfidenceAnalyses,
    topIssueLabels,
    recentOrders,
    registeredCustomers,
    guestPaidCustomers,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { paymentStatus: { in: PAID_STATUSES } } }),
    prisma.order.count({ where: { status: "fulfilled" } }),
    prisma.order.count({ where: { paymentStatus: "refunded" } }),
    prisma.order.count({ where: { status: "canceled" } }),
    prisma.order.aggregate({
      where: { paymentStatus: { in: PAID_STATUSES } },
      _sum: { amountTotal: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "name"],
      _sum: { quantity: true, totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
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
        userId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        orders: {
          where: { paymentStatus: { in: PAID_STATUSES } },
          select: { amountTotal: true },
        },
      },
    }),
    prisma.order.groupBy({
      by: ["customerEmail"],
      where: {
        userId: null,
        paymentStatus: { in: PAID_STATUSES },
        customerEmail: { not: null },
      },
      _sum: { amountTotal: true },
      _count: { id: true },
    }),
  ]);

  const productIds = Array.from(
    new Set(topItems.map((item) => item.productId).filter(Boolean) as string[])
  );
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true },
      })
    : [];
  const productMap = new Map(products.map((product) => [product.id, product.title]));

  const topProducts = topItems.map((item) => ({
    productId: item.productId,
    productTitle: item.productId ? productMap.get(item.productId) ?? null : null,
    name: item.name,
    units: item._sum.quantity ?? 0,
    revenueCents: item._sum.totalAmount ?? 0,
  }));

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
    const orderKey = order.createdAt.toISOString().slice(0, 10);
    const target = dailyIndex.get(orderKey);
    if (target) {
      target.orders += 1;
      if (PAID_STATUSES.includes(order.paymentStatus)) {
        target.revenueCents += order.amountTotal;
      }
    }

    const diffDays = Math.floor(
      (now.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 0) orderVelocity.today += 1;
    if (diffDays < 7) orderVelocity.last7Days += 1;
    if (diffDays < 30) orderVelocity.last30Days += 1;

    if (!PAID_STATUSES.includes(order.paymentStatus)) return sum;
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

  return NextResponse.json({
    funnel: {
      totalOrders,
      paidOrders,
      fulfilledOrders,
      refundedOrders,
      canceledOrders,
    },
    revenue: {
      totalCents: totalRevenue._sum.amountTotal ?? 0,
      last30DaysCents: paidRevenueLast30Days,
    },
    topProducts,
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
}
