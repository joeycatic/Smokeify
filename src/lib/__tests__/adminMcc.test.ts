import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  contactMatchesAudienceFilters,
  parseMccAudienceFilters,
  parseMccRange,
  parseMccScope,
  type MccContact,
} from "@/lib/adminMcc";

const baseContact: MccContact = {
  id: "user_1",
  userId: "user_1",
  email: "customer@example.com",
  name: "Customer Example",
  type: "registered",
  storefrontAffinity: "GROW",
  storefronts: ["GROW"],
  lifecycleStage: "REPEAT",
  consentStatus: "OPTED_IN",
  source: "registered",
  signals: ["registered", "subscriber", "back_in_stock"],
  orderCount: 3,
  totalRevenueCents: 125_00,
  refundedCents: 0,
  averageOrderCents: 4_167,
  firstOrderAt: "2026-01-01T00:00:00.000Z",
  lastOrderAt: "2026-06-20T00:00:00.000Z",
  discountOrderCount: 1,
  returnCount: 0,
  openSupportCases: 0,
  backInStockRequests: 1,
  checkoutRecoverySessions: 0,
  analyzerRuns: 2,
  segments: ["repeat"],
  tags: ["vip-lead"],
  lastActivityAt: "2026-06-21T00:00:00.000Z",
};

describe("adminMcc parsing", () => {
  it("normalizes storefront scope and range query params", () => {
    expect(parseMccScope("grow")).toBe("GROW");
    expect(parseMccScope("unexpected")).toBe("ALL");
    expect(parseMccRange("90")).toBe(90);
    expect(parseMccRange("14")).toBe(30);
  });

  it("sanitizes audience filters", () => {
    const filters = parseMccAudienceFilters({
      q: "  repeat buyer  ",
      contactTypes: ["registered", "invalid", "subscriber"],
      newsletterConsent: "opted_in",
      minOrders: "2",
      segments: ["repeat", "unknown"],
      hasBackInStockIntent: true,
    });

    expect(filters).toMatchObject({
      q: "repeat buyer",
      contactTypes: ["registered", "subscriber"],
      newsletterConsent: "opted_in",
      minOrders: 2,
      segments: ["repeat"],
      hasBackInStockIntent: true,
    });
  });
});

describe("contactMatchesAudienceFilters", () => {
  it("matches by consent, order count, segment, intent, and recent order", () => {
    expect(
      contactMatchesAudienceFilters(
        baseContact,
        {
          newsletterConsent: "opted_in",
          minOrders: 2,
          segments: ["repeat"],
          hasBackInStockIntent: true,
          lastOrderWithinDays: 10,
        },
        new Date("2026-06-25T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("rejects contacts outside the requested audience rules", () => {
    expect(
      contactMatchesAudienceFilters(baseContact, {
        contactTypes: ["guest"],
      }),
    ).toBe(false);
    expect(
      contactMatchesAudienceFilters(baseContact, {
        newsletterConsent: "not_opted_in",
      }),
    ).toBe(false);
    expect(
      contactMatchesAudienceFilters(
        baseContact,
        { lastOrderWithinDays: 2 },
        new Date("2026-06-25T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
