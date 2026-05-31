import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  categoryCount,
  getAdminStorefrontInsights,
  getFinancePageData,
  landingPageSectionFindMany,
  orderCount,
  productCount,
} = vi.hoisted(() => ({
  categoryCount: vi.fn(),
  getAdminStorefrontInsights: vi.fn(),
  getFinancePageData: vi.fn(),
  landingPageSectionFindMany: vi.fn(),
  orderCount: vi.fn(),
  productCount: vi.fn(),
}));

vi.mock("@/lib/adminAddonData", () => ({
  getFinancePageData,
}));

vi.mock("@/lib/adminGrowvaultInsights", () => ({
  getAdminStorefrontInsights,
}));

vi.mock("@/lib/adminInsights", () => ({
  PAID_ORDER_STATUSES: ["paid", "succeeded", "refunded", "partially_refunded"],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      count: categoryCount,
    },
    landingPageSection: {
      findMany: landingPageSectionFindMany,
    },
    order: {
      count: orderCount,
    },
    product: {
      count: productCount,
    },
  },
}));

import { getAdminStorefrontDashboardData } from "@/lib/adminStorefrontDashboard";

const setupMocks = () => {
  getAdminStorefrontInsights.mockResolvedValue({
    activeWindowMinutes: 30,
    firstTaggedEventAt: null,
    funnel: {
      addToCart: 0,
      beginCheckout: 0,
      cartDropoffRate: 0,
      cartToCheckoutRate: 0,
      checkoutDropoffRate: 0,
      checkoutToShippingRate: 0,
      paidOrders: 0,
      paymentDropoffRate: 0,
      paymentStarted: 0,
      paymentToPaidRate: 0,
      purchaseSessions: 0,
      sessionToPaidRate: 0,
      shippingDropoffRate: 0,
      shippingSubmitted: 0,
      shippingToPaymentRate: 0,
    },
    live: { activeVisitorCount: 0, topPages: [], trafficSources: [] },
    rangeStart: "2026-05-01T00:00:00.000Z",
    storefrontAnalyticsAvailable: true,
    topProducts: [],
    trend: [],
    underperformingProducts: [],
    warningStartsAt: null,
  });
  getFinancePageData.mockResolvedValue({
    currentFinance: { currency: "EUR" },
  });
  productCount
    .mockResolvedValueOnce(12)
    .mockResolvedValueOnce(8)
    .mockResolvedValueOnce(3)
    .mockResolvedValueOnce(5);
  categoryCount.mockResolvedValue(4);
  landingPageSectionFindMany.mockResolvedValue([
    {
      draftIsManual: true,
      isManual: false,
      lastPublishedAt: new Date("2026-05-20T10:00:00.000Z"),
      scheduledPublishAt: null,
    },
    {
      draftIsManual: false,
      isManual: true,
      lastPublishedAt: new Date("2026-05-22T10:00:00.000Z"),
      scheduledPublishAt: new Date("2026-06-01T10:00:00.000Z"),
    },
  ]);
  orderCount.mockResolvedValueOnce(9).mockResolvedValueOnce(6);
};

describe("adminStorefrontDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("loads Smokeify dashboard data with explicit MAIN storefront filters", async () => {
    const result = await getAdminStorefrontDashboardData({
      storefront: "MAIN",
      days: 30,
    });

    expect(getAdminStorefrontInsights).toHaveBeenCalledWith(30, "MAIN");
    expect(getFinancePageData).toHaveBeenCalledWith(30, "MAIN");
    expect(productCount).toHaveBeenNthCalledWith(1, {
      where: { storefronts: { has: "MAIN" } },
    });
    expect(productCount).toHaveBeenNthCalledWith(4, {
      where: {
        storefronts: { has: "MAIN" },
        NOT: { storefronts: { has: "GROW" } },
      },
    });
    expect(categoryCount).toHaveBeenCalledWith({
      where: { storefronts: { has: "MAIN" } },
    });
    expect(landingPageSectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storefront: "MAIN" } }),
    );
    expect(orderCount).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ sourceStorefront: "MAIN" }),
      }),
    );
    expect(orderCount).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: {
            in: ["paid", "succeeded", "refunded", "partially_refunded"],
          },
          sourceStorefront: "MAIN",
        }),
      }),
    );
    expect(result.storefrontLabel).toBe("Smokeify");
    expect(result.links.orders).toBe("/admin/orders?storefront=MAIN");
    expect(result.landingPage.lastPublishedAt).toBe("2026-05-22T10:00:00.000Z");
  });

  it("loads GrowVault dashboard data with explicit GROW storefront filters", async () => {
    const result = await getAdminStorefrontDashboardData({
      storefront: "GROW",
      days: 90,
    });

    expect(getAdminStorefrontInsights).toHaveBeenCalledWith(90, "GROW");
    expect(getFinancePageData).toHaveBeenCalledWith(90, "GROW");
    expect(productCount).toHaveBeenNthCalledWith(4, {
      where: {
        storefronts: { has: "GROW" },
        NOT: { storefronts: { has: "MAIN" } },
      },
    });
    expect(orderCount).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ sourceStorefront: "GROW" }),
      }),
    );
    expect(result.storefrontLabel).toBe("GrowVault");
    expect(result.links.catalog).toBe("/admin/catalog?storefront=GROW");
  });
});
