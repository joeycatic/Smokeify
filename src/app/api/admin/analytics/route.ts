import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

const PAID_STATUSES = ["paid", "refunded", "partially_refunded"];

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    },
    topProducts,
    stockouts,
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
