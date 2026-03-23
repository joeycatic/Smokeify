import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { PAID_ORDER_STATUSES } from "@/lib/adminInsights";

type Segment = "new" | "repeat" | "high_value" | "churn_risk" | "discount_driven" | "return_risk" | "vip";
type CustomerTab = "all" | "registered" | "guest";
type BaseCustomer = {
  email: string;
  name: string | null;
  orderCount: number;
  totalSpentCents: number;
  refundedCents: number;
  netRevenueCents: number;
  aovCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  discountOrderCount: number;
  returnCount: number;
  segments: Segment[];
};
type RegisteredCustomer = BaseCustomer & {
  type: "registered";
  id: string;
  joinedAt: string;
  newsletterOptIn: boolean;
  loyaltyPointsBalance: number;
  storeCreditBalance: number;
  customerGroup: string | null;
  notes: string | null;
};
type GuestCustomer = BaseCustomer & {
  type: "guest";
};
type Customer = RegisteredCustomer | GuestCustomer;

const PAGE_SIZE = 40;

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

const getSegmentScore = (customer: Customer) => {
  let score = 0;
  if (customer.segments.includes("vip")) score += 4;
  if (customer.segments.includes("high_value")) score += 3;
  if (customer.segments.includes("churn_risk")) score += 2;
  if (customer.segments.includes("return_risk")) score += 2;
  if (customer.segments.includes("discount_driven")) score += 1;
  return score;
};

const sortCustomers = (customers: Customer[]) =>
  [...customers].sort((left, right) => {
    const dateDiff =
      new Date(right.lastOrderAt ?? 0).getTime() -
      new Date(left.lastOrderAt ?? 0).getTime();
    if (dateDiff !== 0) return dateDiff;
    if (right.netRevenueCents !== left.netRevenueCents) {
      return right.netRevenueCents - left.netRevenueCents;
    }
    return getSegmentScore(right) - getSegmentScore(left);
  });

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q")?.trim() ?? "";
  const tabParam = searchParams.get("tab");
  const segmentParam = searchParams.get("segment");
  const pageParam = Number(searchParams.get("page") ?? "1");
  const tab: CustomerTab =
    tabParam === "registered" || tabParam === "guest" ? tabParam : "all";
  const segmentFilter: Segment | "all" =
    segmentParam === "new" ||
    segmentParam === "repeat" ||
    segmentParam === "high_value" ||
    segmentParam === "churn_risk" ||
    segmentParam === "discount_driven" ||
    segmentParam === "return_risk" ||
    segmentParam === "vip"
      ? segmentParam
      : "all";
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const normalizedQuery = rawQuery.toLowerCase();

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

  const registeredCustomers = users.flatMap((user) => {
    if (!user.email) return [];
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

    return [{
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
    }];
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

  const allCustomers = sortCustomers([...registeredCustomers, ...guestCustomers]);
  let filteredCustomers: Customer[] =
    tab === "registered"
      ? registeredCustomers
      : tab === "guest"
        ? guestCustomers
        : allCustomers;

  if (segmentFilter !== "all") {
    filteredCustomers = filteredCustomers.filter((customer) =>
      customer.segments.includes(segmentFilter),
    );
  }

  if (normalizedQuery) {
    filteredCustomers = filteredCustomers.filter((customer) => {
      const haystack = [
        customer.email,
        customer.name ?? "",
        customer.type === "registered" ? customer.customerGroup ?? "" : "",
        ...customer.segments,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }

  const sortedFilteredCustomers = sortCustomers(filteredCustomers);
  const totalCount = sortedFilteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const customers = sortedFilteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const totalNetRevenueCents = sortedFilteredCustomers.reduce(
    (sum, customer) => sum + customer.netRevenueCents,
    0,
  );
  const vipCustomers = sortedFilteredCustomers.filter((customer) =>
    customer.segments.includes("vip"),
  ).length;
  const churnRiskCustomers = sortedFilteredCustomers.filter((customer) =>
    customer.segments.includes("churn_risk"),
  ).length;
  const discountDrivenCustomers = sortedFilteredCustomers.filter((customer) =>
    customer.segments.includes("discount_driven"),
  ).length;
  const averageClvCents =
    totalCount > 0 ? Math.round(totalNetRevenueCents / totalCount) : 0;

  const segmentBars = [
    { label: "VIP", value: vipCustomers },
    { label: "Churn risk", value: churnRiskCustomers },
    { label: "Discount driven", value: discountDrivenCustomers },
    {
      label: "Return risk",
      value: sortedFilteredCustomers.filter((customer) =>
        customer.segments.includes("return_risk"),
      ).length,
    },
    {
      label: "New",
      value: sortedFilteredCustomers.filter((customer) => customer.segments.includes("new"))
        .length,
    },
  ].filter((entry) => entry.value > 0);

  const topCustomers = [...sortedFilteredCustomers]
    .sort((left, right) => right.netRevenueCents - left.netRevenueCents)
    .slice(0, 6);
  const atRiskCustomers = [...sortedFilteredCustomers]
    .filter(
      (customer) =>
        customer.segments.includes("churn_risk") ||
        customer.segments.includes("return_risk"),
    )
    .sort((left, right) => {
      const riskDiff = getSegmentScore(right) - getSegmentScore(left);
      if (riskDiff !== 0) return riskDiff;
      return right.netRevenueCents - left.netRevenueCents;
    })
    .slice(0, 6);

  return NextResponse.json({
    customers,
    currentPage,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages,
    summary: {
      totalCustomers: totalCount,
      totalNetRevenueCents,
      vipCustomers,
      churnRiskCustomers,
      discountDrivenCustomers,
      averageClvCents,
      segmentBars,
      topCustomers,
      atRiskCustomers,
    },
  });
}
