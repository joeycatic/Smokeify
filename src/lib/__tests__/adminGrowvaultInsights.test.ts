import { describe, expect, it, vi } from "vitest";
import {
  buildGrowvaultFunnelSnapshot,
  isGrowvaultRangePartiallyTracked,
} from "@/lib/adminGrowvaultInsights";

vi.mock("server-only", () => ({}));

describe("adminGrowvaultInsights", () => {
  it("falls back to paid orders when purchase sessions are missing", () => {
    const snapshot = buildGrowvaultFunnelSnapshot({
      addToCart: 20,
      beginCheckout: 10,
      shippingSubmitted: 8,
      paymentStarted: 5,
      purchaseSessions: 0,
      paidOrders: 4,
    });

    expect(snapshot.paymentToPaidRate).toBe(0.8);
    expect(snapshot.paymentDropoffRate).toBe(0.2);
  });

  it("computes adjacent-stage rates and dropoffs", () => {
    const snapshot = buildGrowvaultFunnelSnapshot({
      addToCart: 12,
      beginCheckout: 9,
      shippingSubmitted: 6,
      paymentStarted: 3,
      purchaseSessions: 2,
      paidOrders: 2,
    });

    expect(snapshot.cartToCheckoutRate).toBe(0.75);
    expect(snapshot.checkoutToShippingRate).toBeCloseTo(2 / 3);
    expect(snapshot.shippingToPaymentRate).toBe(0.5);
    expect(snapshot.paymentToPaidRate).toBeCloseTo(2 / 3);
    expect(snapshot.checkoutDropoffRate).toBeCloseTo(1 / 3);
    expect(snapshot.shippingDropoffRate).toBe(0.5);
  });

  it("marks ranges before the first tagged event as partial", () => {
    expect(
      isGrowvaultRangePartiallyTracked(
        new Date("2026-04-01T00:00:00.000Z"),
        new Date("2026-04-10T00:00:00.000Z"),
      ),
    ).toBe(true);

    expect(
      isGrowvaultRangePartiallyTracked(
        new Date("2026-04-12T00:00:00.000Z"),
        new Date("2026-04-10T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
