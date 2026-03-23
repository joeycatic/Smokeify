import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { PAID_ORDER_STATUSES } from "@/lib/adminInsights";

type Segment = "new" | "repeat" | "high_value" | "churn_risk" | "discount_driven" | "return_risk" | "vip";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const buildSegments = ({
  firstOrderAt,
  lastOrderAt,
  orderCount,
  totalSpentCents,
  discountOrderCount,
  returnCount,
  customerGroup,
}: {
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  orderCount: number;
  totalSpentCents: number;
  discountOrderCount: number;
  returnCount: number;
  customerGroup?: string | null;
}) => {
  const now = Date.now();
  const segments = new Set<Segment>();
  if (orderCount >= 2) segments.add("repeat");
  if (totalSpentCents >= 50_000) segments.add("high_value");
  if (customerGroup === "VIP" || totalSpentCents >= 100_000) segments.add("vip");
  if (firstOrderAt && now - firstOrderAt.getTime() <= THIRTY_DAYS_MS) segments.add("new");
  if (lastOrderAt && orderCount >= 2 && now - lastOrderAt.getTime() >= NINETY_DAYS_MS) {
    segments.add("churn_risk");
  }
  if (orderCount > 0 && discountOrderCount / orderCount >= 0.5) segments.add("discount_driven");
  if (orderCount > 0 && returnCount / orderCount >= 0.25) segments.add("return_risk");
  return Array.from(segments);
};

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      customerGroup: true,
      newsletterOptIn: true,
      loyaltyPointsBalance: true,
      storeCreditBalance: true,
      notes: true,
      orders: {
        where: { paymentStatus: { in: PAID_ORDER_STATUSES } },
        select: {
          amountTotal: true,
          amountRefunded: true,
          discountCode: true,
          createdAt: true,
        },
      },
      returnRequests: {
        select: { id: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const guestOrders = await prisma.order.findMany({
    where: {
      userId: null,
      customerEmail: { not: null },
      paymentStatus: { in: PAID_ORDER_STATUSES },
    },
    select: {
      customerEmail: true,
      shippingName: true,
      amountTotal: true,
      amountRefunded: true,
      discountCode: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const guestMap = new Map<
    string,
    {
      email: string;
      name: string | null;
      orders: Array<{
        amountTotal: number;
        amountRefunded: number;
        discountCode: string | null;
        createdAt: Date;
      }>;
    }
  >();

  for (const order of guestOrders) {
    const email = order.customerEmail;
    if (!email) continue;
    const key = email.toLowerCase();
    const entry = guestMap.get(key) ?? {
      email,
      name: order.shippingName ?? null,
      orders: [],
    };
    entry.orders.push({
      amountTotal: order.amountTotal,
      amountRefunded: order.amountRefunded,
      discountCode: order.discountCode,
      createdAt: order.createdAt,
    });
    if (!entry.name && order.shippingName) {
      entry.name = order.shippingName;
    }
    guestMap.set(key, entry);
  }

  const registeredCustomers = users.map((user) => {
    const sortedOrders = [...user.orders].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    const totalSpentCents = sortedOrders.reduce((sum, order) => sum + order.amountTotal, 0);
    const refundedCents = sortedOrders.reduce((sum, order) => sum + order.amountRefunded, 0);
    const netRevenueCents = totalSpentCents - refundedCents;
    const orderCount = sortedOrders.length;
    const firstOrderAt = sortedOrders[0]?.createdAt ?? null;
    const lastOrderAt = sortedOrders.at(-1)?.createdAt ?? null;
    const discountOrderCount = sortedOrders.filter((order) => Boolean(order.discountCode)).length;
    const returnCount = user.returnRequests.length;

    return {
      type: "registered" as const,
      id: user.id,
      email: user.email,
      name: user.name,
      joinedAt: user.createdAt.toISOString(),
      orderCount,
      totalSpentCents,
      refundedCents,
      netRevenueCents,
      aovCents: orderCount > 0 ? Math.round(totalSpentCents / orderCount) : 0,
      firstOrderAt: firstOrderAt?.toISOString() ?? null,
      lastOrderAt: lastOrderAt?.toISOString() ?? null,
      discountOrderCount,
      returnCount,
      newsletterOptIn: user.newsletterOptIn,
      loyaltyPointsBalance: user.loyaltyPointsBalance,
      storeCreditBalance: user.storeCreditBalance,
      customerGroup: user.customerGroup,
      notes: user.notes,
      segments: buildSegments({
        firstOrderAt,
        lastOrderAt,
        orderCount,
        totalSpentCents,
        discountOrderCount,
        returnCount,
        customerGroup: user.customerGroup,
      }),
    };
  });

  const guestCustomers = Array.from(guestMap.values()).map((guest) => {
    const sortedOrders = [...guest.orders].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    const totalSpentCents = sortedOrders.reduce((sum, order) => sum + order.amountTotal, 0);
    const refundedCents = sortedOrders.reduce((sum, order) => sum + order.amountRefunded, 0);
    const netRevenueCents = totalSpentCents - refundedCents;
    const orderCount = sortedOrders.length;
    const firstOrderAt = sortedOrders[0]?.createdAt ?? null;
    const lastOrderAt = sortedOrders.at(-1)?.createdAt ?? null;
    const discountOrderCount = sortedOrders.filter((order) => Boolean(order.discountCode)).length;

    return {
      type: "guest" as const,
      email: guest.email,
      name: guest.name,
      orderCount,
      totalSpentCents,
      refundedCents,
      netRevenueCents,
      aovCents: orderCount > 0 ? Math.round(totalSpentCents / orderCount) : 0,
      firstOrderAt: firstOrderAt?.toISOString() ?? null,
      lastOrderAt: lastOrderAt?.toISOString() ?? null,
      discountOrderCount,
      returnCount: 0,
      segments: buildSegments({
        firstOrderAt,
        lastOrderAt,
        orderCount,
        totalSpentCents,
        discountOrderCount,
        returnCount: 0,
      }),
    };
  });

  return NextResponse.json({ registeredCustomers, guestCustomers });
}
