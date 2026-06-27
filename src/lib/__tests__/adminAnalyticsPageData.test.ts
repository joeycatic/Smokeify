import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockGetActiveSessionSnapshot,
  mockGetCustomerRevenueMix,
  mockGetDateDaysAgo,
  mockGetFunnelComparison,
  mockGetFunnelSnapshot,
  mockGetFunnelTrend,
  mockGetOrderComparisons,
  mockGetProductPerformance,
  mockGetFinancePageData,
  orderCount,
  orderAggregate,
  orderFindMany,
  orderGroupBy,
  orderItemGroupBy,
  variantFindMany,
  analyticsEventGroupBy,
  plantAnalysisRunCount,
  plantAnalysisFeedbackCount,
  plantAnalysisIssueGroupBy,
  userFindMany,
  checkoutRecoverySessionCount,
  checkoutRecoveryAttemptCount,
  returnRequestCount,
} = vi.hoisted(() => ({
  mockGetActiveSessionSnapshot: vi.fn(),
  mockGetCustomerRevenueMix: vi.fn(),
  mockGetDateDaysAgo: vi.fn(),
  mockGetFunnelComparison: vi.fn(),
  mockGetFunnelSnapshot: vi.fn(),
  mockGetFunnelTrend: vi.fn(),
  mockGetOrderComparisons: vi.fn(),
  mockGetProductPerformance: vi.fn(),
  mockGetFinancePageData: vi.fn(),
  orderCount: vi.fn(),
  orderAggregate: vi.fn(),
  orderFindMany: vi.fn(),
  orderGroupBy: vi.fn(),
  orderItemGroupBy: vi.fn(),
  variantFindMany: vi.fn(),
  analyticsEventGroupBy: vi.fn(),
  plantAnalysisRunCount: vi.fn(),
  plantAnalysisFeedbackCount: vi.fn(),
  plantAnalysisIssueGroupBy: vi.fn(),
  userFindMany: vi.fn(),
  checkoutRecoverySessionCount: vi.fn(),
  checkoutRecoveryAttemptCount: vi.fn(),
  returnRequestCount: vi.fn(),
}));

vi.mock("@/lib/adminInsights", () => ({
  PAID_ORDER_STATUSES: ["paid", "succeeded", "refunded", "partially_refunded"],
  getActiveSessionSnapshot: mockGetActiveSessionSnapshot,
  getCustomerRevenueMix: mockGetCustomerRevenueMix,
  getDateDaysAgo: mockGetDateDaysAgo,
  getFunnelComparison: mockGetFunnelComparison,
  getFunnelSnapshot: mockGetFunnelSnapshot,
  getFunnelTrend: mockGetFunnelTrend,
  getOrderComparisons: mockGetOrderComparisons,
  getProductPerformance: mockGetProductPerformance,
}));

vi.mock("@/lib/adminAddonData", () => ({
  getFinancePageData: mockGetFinancePageData,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      count: orderCount,
      aggregate: orderAggregate,
      findMany: orderFindMany,
      groupBy: orderGroupBy,
    },
    orderItem: {
      groupBy: orderItemGroupBy,
    },
    variant: {
      findMany: variantFindMany,
    },
    analyticsEvent: {
      groupBy: analyticsEventGroupBy,
    },
    plantAnalysisRun: {
      count: plantAnalysisRunCount,
    },
    plantAnalysisFeedback: {
      count: plantAnalysisFeedbackCount,
    },
    plantAnalysisIssue: {
      groupBy: plantAnalysisIssueGroupBy,
    },
    user: {
      findMany: userFindMany,
    },
    checkoutRecoverySession: {
      count: checkoutRecoverySessionCount,
    },
    checkoutRecoveryAttempt: {
      count: checkoutRecoveryAttemptCount,
    },
    returnRequest: {
      count: returnRequestCount,
    },
  },
}));

import {
  loadAdminAnalyticsLive,
  loadAdminAnalyticsOverview,
  loadAdminAnalyticsSecondary,
} from "@/lib/adminAnalyticsPageData";

const currentStart = new Date("2026-05-01T00:00:00.000Z");
const currentEnd = new Date("2026-05-19T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();

  mockGetDateDaysAgo.mockImplementation((daysAgo: number) => {
    const date = new Date("2026-05-19T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() - daysAgo);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  });

  mockGetActiveSessionSnapshot.mockResolvedValue({
    activeVisitorCount: 4,
    topPages: [],
    trafficSources: [],
  });
  mockGetFunnelSnapshot.mockResolvedValue({
    sessions: 10,
    productViews: 8,
    addToCart: 5,
    beginCheckout: 3,
    purchaseSessions: 2,
    paidOrders: 2,
    sessionToOrderRate: 0.2,
    viewToCartRate: 0.625,
    cartToCheckoutRate: 0.6,
    checkoutToPaidRate: 0.66,
    cartAbandonmentRate: 0.4,
    checkoutAbandonmentRate: 0.33,
  });
  mockGetFunnelComparison.mockResolvedValue({
    sessions: { current: 10, previous: 8, deltaRatio: 0.25 },
    beginCheckout: { current: 3, previous: 2, deltaRatio: 0.5 },
    paidOrders: { current: 2, previous: 1, deltaRatio: 1 },
    purchaseSessions: { current: 2, previous: 1, deltaRatio: 1 },
    sessionToOrderRate: { current: 0.2, previous: 0.125, deltaRatio: 0.6 },
    checkoutAbandonmentRate: { current: 0.33, previous: 0.5, deltaRatio: -0.34 },
    cartAbandonmentRate: { current: 0.4, previous: 0.45, deltaRatio: -0.11 },
  });
  mockGetFunnelTrend.mockResolvedValue([
    {
      label: "01 May",
      sessions: 10,
      productViews: 8,
      addToCart: 5,
      beginCheckout: 3,
      purchases: 2,
      paidOrders: 2,
      revenueCents: 12000,
      sessionConversionRate: 0.2,
      checkoutRate: 0.3,
    },
  ]);
  mockGetOrderComparisons.mockResolvedValue({
    currency: "EUR",
    revenue: { current: 12000, previous: 10000, deltaRatio: 0.2 },
    paidOrders: { current: 2, previous: 1, deltaRatio: 1 },
    aov: { current: 6000, previous: 5000, deltaRatio: 0.2 },
    refundRate: { current: 0.1, previous: 0.2, deltaRatio: -0.5 },
  });
  mockGetCustomerRevenueMix.mockResolvedValue({
    newRevenueCents: 6000,
    returningRevenueCents: 6000,
    newCustomerCount: 1,
    returningCustomerCount: 1,
  });
  mockGetProductPerformance.mockResolvedValue([
    {
      productId: "prod_1",
      productTitle: "Control Tent",
      views: 40,
      addToCart: 10,
      beginCheckout: 8,
      purchases: 4,
      revenueCents: 20000,
      marginCents: 8000,
      conversionRate: 0.1,
      addToCartRate: 0.25,
    },
  ]);
  mockGetFinancePageData.mockResolvedValue({
    currentFinance: {
      currency: "EUR",
      paidOrderCount: 2,
      recognizedOrderCount: 2,
      refundedOrderCount: 0,
      grossRevenueCents: 12000,
      refundedGrossCents: 0,
      netCollectedGrossCents: 12000,
      outputVatCents: 1900,
      refundedVatEstimateCents: 0,
      netOutputVatCents: 1900,
      netRevenueCents: 10100,
      shippingCollectedCents: 0,
      cogsCents: 3000,
      paymentFeesCents: 400,
      variableCostCents: 3400,
      contributionMarginCents: 6700,
      contributionMarginRatio: 0.66,
      estimatedProfitCents: 6700,
      ordersMissingTaxCount: 0,
      taxCoverageRate: 1,
    },
    previousFinance: {
      currency: "EUR",
      paidOrderCount: 1,
      recognizedOrderCount: 1,
      refundedOrderCount: 0,
      grossRevenueCents: 10000,
      refundedGrossCents: 0,
      netCollectedGrossCents: 10000,
      outputVatCents: 1600,
      refundedVatEstimateCents: 0,
      netOutputVatCents: 1600,
      netRevenueCents: 8400,
      shippingCollectedCents: 0,
      cogsCents: 2500,
      paymentFeesCents: 300,
      variableCostCents: 2800,
      contributionMarginCents: 5600,
      contributionMarginRatio: 0.66,
      estimatedProfitCents: 5600,
      ordersMissingTaxCount: 0,
      taxCoverageRate: 1,
    },
    vatSummary: {
      monthLabel: "May 2026",
      accountingModeLabel: "Cash-based VAT",
      taxationModeLabel: "Regular VAT",
      outputVatCents: 1900,
      refundedVatEstimateCents: 0,
      inputVatCents: 400,
      estimatedLiabilityCents: 1500,
      taxCoverageRate: 1,
      ordersMissingTaxCount: 0,
      status: "ready_for_handover",
      blockers: [],
      notes: [],
    },
    expenseMigrationRequired: false,
    currentStart,
    currentEnd,
  });

  orderCount.mockResolvedValue(3);
  orderAggregate.mockResolvedValue({ _sum: { amountTotal: 45000 } });
  orderFindMany.mockResolvedValue([
    {
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      amountTotal: 12000,
      paymentStatus: "paid",
      paymentMethod: "card",
      userId: "user_1",
      amountDiscount: 0,
      discountCode: null,
      amountRefunded: 0,
    },
  ]);

  variantFindMany.mockResolvedValue([
    {
      id: "var_1",
      sku: "TENT-1",
      title: "120x120",
      lowStockThreshold: 2,
      product: { id: "prod_1", title: "Control Tent" },
      inventory: { quantityOnHand: 0, reserved: 0 },
    },
  ]);
  userFindMany.mockResolvedValue([
    { id: "user_1", orders: [{ amountTotal: 12000 }, { amountTotal: 8000 }] },
  ]);
  orderGroupBy
    .mockResolvedValueOnce([
      {
        customerEmail: "guest@example.com",
        _sum: { amountTotal: 5000 },
        _count: { id: 1 },
      },
    ])
    .mockResolvedValueOnce([
      {
        discountCode: "SPRING",
        _sum: { amountTotal: 9000, amountDiscount: 1000 },
        _count: { id: 2 },
      },
    ])
    .mockResolvedValueOnce([
      {
        paymentMethod: "card",
        _sum: { amountTotal: 12000, amountRefunded: 0 },
        _count: { id: 2 },
      },
    ]);
  analyticsEventGroupBy
    .mockResolvedValueOnce([
      { utmSource: "google", utmMedium: "cpc", utmCampaign: "spring", _count: { _all: 6 } },
    ])
    .mockResolvedValueOnce([
      { utmSource: "google", utmMedium: "cpc", utmCampaign: "spring", _count: { _all: 2 } },
    ]);
  orderItemGroupBy.mockResolvedValue([
    {
      variantId: "var_1",
      _sum: { quantity: 0, totalAmount: 0 },
    },
  ]);
  checkoutRecoverySessionCount
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(3)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1);
  checkoutRecoveryAttemptCount
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(1);
  returnRequestCount
    .mockResolvedValueOnce(3)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1);
  plantAnalysisRunCount.mockResolvedValue(20);
  plantAnalysisFeedbackCount
    .mockResolvedValueOnce(10)
    .mockResolvedValueOnce(8);
  plantAnalysisIssueGroupBy.mockResolvedValue([
    { label: "low confidence", _count: { _all: 3 } },
  ]);
});

describe("adminAnalyticsPageData", () => {
  it("returns a lightweight storefront-scoped live snapshot", async () => {
    mockGetActiveSessionSnapshot.mockResolvedValueOnce({
      activeVisitorCount: 4,
      topPages: [
        {
          path: "/products",
          pageType: "listing",
          count: 3,
          lastSeenAt: new Date("2026-05-19T12:00:00.000Z"),
        },
      ],
      trafficSources: [{ label: "Direct / unknown", count: 4 }],
    });

    const result = await loadAdminAnalyticsLive("MAIN");

    expect(mockGetActiveSessionSnapshot).toHaveBeenCalledWith("MAIN");
    expect(result.live.activeVisitorCount).toBe(4);
    expect(result.live.topPages[0]?.shareOfVisitors).toBe(0.75);
    expect(result.refreshedAt).toEqual(expect.any(String));
  });

  it("threads range and storefront scope through overview helpers and order queries", async () => {
    const result = await loadAdminAnalyticsOverview(90, "GROW");

    expect(mockGetActiveSessionSnapshot).toHaveBeenCalledWith("GROW");
    const expectedRange = expect.objectContaining({
      kind: "preset",
      days: 90,
      bucketKind: "week",
    });
    expect(mockGetFunnelSnapshot).toHaveBeenCalledWith(expectedRange, "GROW");
    expect(mockGetFunnelComparison).toHaveBeenCalledWith(expectedRange, "GROW");
    expect(mockGetFunnelTrend).toHaveBeenCalledWith(expectedRange, "GROW");
    expect(mockGetOrderComparisons).toHaveBeenCalledWith(expectedRange, "GROW");
    expect(mockGetCustomerRevenueMix).toHaveBeenCalledWith(expectedRange, "GROW");
    expect(mockGetFinancePageData).toHaveBeenCalledWith(expectedRange, "GROW");

    expect(orderCount).toHaveBeenCalledWith({ where: { sourceStorefront: "GROW" } });
    expect(orderAggregate).toHaveBeenCalledWith({
      where: {
        paymentStatus: { in: ["paid", "succeeded", "refunded", "partially_refunded"] },
        sourceStorefront: "GROW",
      },
      _sum: { amountTotal: true },
    });
    expect(orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceStorefront: "GROW",
        }),
      }),
    );
    expect(result.executive?.metrics.map((metric) => metric.id)).toEqual([
      "netRevenue",
      "paidOrders",
      "sessionCvr",
      "checkoutAbandonment",
      "aov",
      "contributionMargin",
      "liveVisitors",
      "vatState",
    ]);
    expect(result.revenueConversion?.trend).toEqual([
      expect.objectContaining({
        label: "01 May",
        revenueCents: 12000,
        paidOrders: 2,
        sessions: 10,
      }),
    ]);
    expect(result.acquisition?.live?.topPages).toEqual([]);
  });

  it("applies storefront scope to secondary analytics queries and inventory rows", async () => {
    const result = await loadAdminAnalyticsSecondary(365, "MAIN");

    expect(mockGetCustomerRevenueMix).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "preset", days: 365, bucketKind: "month" }),
      "MAIN",
    );
    expect(mockGetProductPerformance).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "preset", days: 365, bucketKind: "month" }),
      "MAIN",
    );
    expect(variantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          product: {
            storefronts: { has: "MAIN" },
          },
        },
      }),
    );
    expect(analyticsEventGroupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          storefront: "MAIN",
        }),
      }),
    );
    expect(orderGroupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          sourceStorefront: "MAIN",
        }),
      }),
    );
    expect(orderItemGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: expect.objectContaining({
            sourceStorefront: "MAIN",
          }),
        }),
      }),
    );
    expect(checkoutRecoverySessionCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceStorefront: "MAIN",
        }),
      }),
    );
    expect(checkoutRecoveryAttemptCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: {
            sourceStorefront: "MAIN",
          },
        }),
      }),
    );
    expect(returnRequestCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: {
            sourceStorefront: "MAIN",
          },
        }),
      }),
    );
    expect(result.inventory).toEqual({
      stockoutCount: 1,
      lowStockCount: 1,
      trackedVariants: 1,
    });
    expect(result.acquisition?.trafficSources).toEqual([
      expect.objectContaining({
        label: "google / cpc / spring",
        sessions: 6,
        beginCheckout: 2,
        checkoutRate: 2 / 6,
      }),
    ]);
    expect(result.inventoryRisk.rows[0]).toEqual(
      expect.objectContaining({
        variantId: "var_1",
        available: 0,
        coverDays: null,
        riskLevel: "critical",
      }),
    );
    expect(result.checkoutRecovery).toEqual(
      expect.objectContaining({
        sessions: 4,
        consentGrantedSessions: 3,
        completedSessions: 1,
        suppressedSessions: 1,
        recoveredOrders: 3,
        failedAttempts: 2,
        dueAttempts: 1,
      }),
    );
    expect(result.returns).toEqual({
      totalRequests: 3,
      pendingRequests: 1,
      approvedRequests: 1,
      rejectedRequests: 1,
      pendingRate: 1 / 3,
    });
    expect(result.actionCenter.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "inventory-stockout-risk",
        "checkout-recovery-queue",
        "pending-returns",
      ]),
    );
    expect(result.operations?.merchandising.leaders[0]).toEqual(
      expect.objectContaining({
        productTitle: "Control Tent",
        priorityReason: "Top revenue driver",
      }),
    );
    expect(result.operations?.inventory.summary).toEqual({
      stockoutCount: 1,
      lowStockCount: 1,
      trackedVariants: 1,
    });
    expect(result.operations?.customers.summary.repeatRate).toBeGreaterThan(0);
  });
});
