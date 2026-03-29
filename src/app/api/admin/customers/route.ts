import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { PAID_ORDER_STATUSES } from "@/lib/adminInsights";
import {
  type Customer,
  type CustomerCohort,
  type CustomerSegment,
  type CustomerSummary,
  type CustomerTab,
  CUSTOMER_SEGMENTS,
  buildCustomerSegments,
  getCustomerSegmentScore,
  isClosedOrderStatus,
  isOpenReturnStatus,
  sortCustomers,
} from "@/lib/adminCustomers";
import { adminJson } from "@/lib/adminApi";
import { parseAdminStorefrontScope, storefrontScopeToStorefront } from "@/lib/storefronts";

const PAGE_SIZE = 40;

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q")?.trim() ?? "";
  const tabParam = searchParams.get("tab");
  const segmentParam = searchParams.get("segment");
  const pageParam = Number(searchParams.get("page") ?? "1");
  const tab: CustomerTab =
    tabParam === "registered" || tabParam === "guest" ? tabParam : "all";
  const segmentFilter: CustomerSegment | "all" = CUSTOMER_SEGMENTS.includes(
    segmentParam as CustomerSegment,
  )
    ? (segmentParam as CustomerSegment)
    : "all";
  const storefrontScope = parseAdminStorefrontScope(searchParams.get("storefront"));
  const storefront = storefrontScopeToStorefront(storefrontScope);
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const normalizedQuery = rawQuery.toLowerCase();

  const [users, guestOrders, cohorts] = await Promise.all([
    prisma.user.findMany({
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
        crmFlags: true,
        orders: {
          where: {
            paymentStatus: { in: PAID_ORDER_STATUSES },
            ...(storefront ? { sourceStorefront: storefront } : {}),
          },
          select: {
            amountTotal: true,
            amountRefunded: true,
            discountCode: true,
            createdAt: true,
            status: true,
          },
        },
        returnRequests: {
          where: storefront ? { order: { sourceStorefront: storefront } } : undefined,
          select: { id: true, createdAt: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        userId: null,
        customerEmail: { not: null },
        paymentStatus: { in: PAID_ORDER_STATUSES },
        ...(storefront ? { sourceStorefront: storefront } : {}),
      },
      select: {
        customerEmail: true,
        shippingName: true,
        amountTotal: true,
        amountRefunded: true,
        discountCode: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.adminCustomerCohort.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

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
        status: string;
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
      status: order.status,
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
    if (storefront && orderCount === 0) return [];

    return [
      {
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
        openOrderCount: sortedOrders.filter((order) => !isClosedOrderStatus(order.status)).length,
        openReturnCount: user.returnRequests.filter((request) => isOpenReturnStatus(request.status))
          .length,
        newsletterOptIn: user.newsletterOptIn,
        loyaltyPointsBalance: user.loyaltyPointsBalance,
        storeCreditBalance: user.storeCreditBalance,
        customerGroup: user.customerGroup,
        notes: user.notes,
        crmFlags: user.crmFlags,
        segments: buildCustomerSegments({
          firstOrderAt,
          lastOrderAt,
          orderCount,
          totalSpentCents,
          discountOrderCount,
          returnCount,
          customerGroup: user.customerGroup,
        }),
      },
    ];
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
      openOrderCount: sortedOrders.filter((order) => !isClosedOrderStatus(order.status)).length,
      openReturnCount: 0,
      segments: buildCustomerSegments({
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
        customer.type === "registered" ? customer.crmFlags.join(" ") : "",
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

  const summary: CustomerSummary = {
    totalCustomers: totalCount,
    totalNetRevenueCents,
    vipCustomers,
    churnRiskCustomers,
    discountDrivenCustomers,
    averageClvCents,
    segmentBars: [
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
    ].filter((entry) => entry.value > 0),
    topCustomers: [...sortedFilteredCustomers]
      .sort((left, right) => right.netRevenueCents - left.netRevenueCents)
      .slice(0, 6),
    atRiskCustomers: [...sortedFilteredCustomers]
      .filter(
        (customer) =>
          customer.segments.includes("churn_risk") ||
          customer.segments.includes("return_risk"),
      )
      .sort((left, right) => {
        const riskDiff = getCustomerSegmentScore(right) - getCustomerSegmentScore(left);
        if (riskDiff !== 0) return riskDiff;
        return right.netRevenueCents - left.netRevenueCents;
      })
      .slice(0, 6),
  };

  const serializedCohorts: CustomerCohort[] = cohorts.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    description: cohort.description,
    customerCount: cohort.customerCount,
    filters: (cohort.filters as CustomerCohort["filters"]) ?? {},
    createdByEmail: cohort.createdByEmail,
    createdAt: cohort.createdAt.toISOString(),
    updatedAt: cohort.updatedAt.toISOString(),
  }));

  return adminJson({
    customers,
    currentPage,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages,
    summary,
    cohorts: serializedCohorts,
  });
}
