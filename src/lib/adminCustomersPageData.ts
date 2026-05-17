import type { AdminRole } from "@/lib/adminPermissions";
import { canAdminPerformAction } from "@/lib/adminPermissions";
import {
  type Customer,
  type CustomerSummary,
  type CustomerTab,
  type CustomerCohort,
  type CustomerSegment,
  CUSTOMER_SEGMENTS,
  buildCustomerSegments,
  getCustomerSegmentScore,
  isClosedOrderStatus,
  isOpenReturnStatus,
  sortCustomers,
} from "@/lib/adminCustomers";
import { PAID_ORDER_STATUSES } from "@/lib/adminInsights";
import { prisma } from "@/lib/prisma";
import { parseAdminStorefrontScope, storefrontScopeToStorefront } from "@/lib/storefronts";

export const ADMIN_CUSTOMERS_PAGE_SIZE = 40;

const EMPTY_SUMMARY: CustomerSummary = {
  totalCustomers: 0,
  totalNetRevenueCents: 0,
  vipCustomers: 0,
  churnRiskCustomers: 0,
  discountDrivenCustomers: 0,
  averageClvCents: 0,
  segmentBars: [],
  topCustomers: [],
  atRiskCustomers: [],
};

export type AdminCustomersPagePayload = {
  customers: Customer[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  summary: CustomerSummary;
  capabilities: {
    canWriteCrm: boolean;
  };
};

export type AdminCustomersSidebarPayload = {
  cohorts: CustomerCohort[];
  owners: Array<{
    id: string;
    email: string | null;
    name: string | null;
  }>;
};

export async function loadAdminCustomersSidebarData(): Promise<AdminCustomersSidebarPayload> {
  const [cohorts, owners] = await Promise.all([
    prisma.adminCustomerCohort.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, email: true, name: true },
    }),
  ]);

  return {
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      description: cohort.description,
      customerCount: cohort.customerCount,
      filters: (cohort.filters as CustomerCohort["filters"]) ?? {},
      createdByEmail: cohort.createdByEmail,
      assigneeUserId: cohort.assigneeUserId,
      assigneeEmail: cohort.assigneeEmail,
      status: cohort.status,
      createdAt: cohort.createdAt.toISOString(),
      updatedAt: cohort.updatedAt.toISOString(),
    })),
    owners,
  };
}

export async function loadAdminCustomersPageData(input: {
  role: AdminRole;
  query?: string | null;
  tab?: string | null;
  segment?: string | null;
  page?: number | null;
  storefront?: string | null;
}): Promise<AdminCustomersPagePayload> {
  const rawQuery = input.query?.trim() ?? "";
  const tabParam = input.tab ?? "all";
  const segmentParam = input.segment ?? "all";
  const requestedPage =
    typeof input.page === "number" && Number.isFinite(input.page) && input.page > 0
      ? input.page
      : 1;
  const tab: CustomerTab =
    tabParam === "registered" || tabParam === "guest" ? tabParam : "all";
  const segmentFilter: CustomerSegment | "all" = CUSTOMER_SEGMENTS.includes(
    segmentParam as CustomerSegment,
  )
    ? (segmentParam as CustomerSegment)
    : "all";
  const storefrontScope = parseAdminStorefrontScope(input.storefront);
  const storefront = storefrontScopeToStorefront(storefrontScope);
  const normalizedQuery = rawQuery.toLowerCase();

  const [users, guestOrders] = await Promise.all([
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
  const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_CUSTOMERS_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const customers = sortedFilteredCustomers.slice(
    (currentPage - 1) * ADMIN_CUSTOMERS_PAGE_SIZE,
    currentPage * ADMIN_CUSTOMERS_PAGE_SIZE,
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

  const summary: CustomerSummary =
    totalCount === 0
      ? EMPTY_SUMMARY
      : {
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

  return {
    customers,
    currentPage,
    pageSize: ADMIN_CUSTOMERS_PAGE_SIZE,
    totalCount,
    totalPages,
    summary,
    capabilities: {
      canWriteCrm: canAdminPerformAction(input.role, "crm.write"),
    },
  };
}
