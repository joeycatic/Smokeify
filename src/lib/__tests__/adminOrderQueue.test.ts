import { describe, expect, it } from "vitest";
import type { AdminOrderRecord } from "@/lib/adminOrders";
import {
  getOrderQueueTone,
  isArchivedOrder,
  isAwaitingPaymentOrder,
  isReadyToFulfillOrder,
  matchesOrderSearch,
} from "@/lib/adminOrderQueue";

function buildOrder(overrides: Partial<AdminOrderRecord> = {}): AdminOrderRecord {
  return {
    id: "order_1",
    orderNumber: 101,
    createdAt: "2026-04-03T09:00:00.000Z",
    updatedAt: "2026-04-03T09:15:00.000Z",
    sourceStorefront: "SMOKEIFY",
    sourceHost: "smokeify.io",
    sourceOrigin: "https://smokeify.io",
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "card",
    currency: "EUR",
    amountSubtotal: 10000,
    amountTax: 1900,
    amountShipping: 490,
    amountDiscount: 0,
    amountTotal: 12390,
    amountRefunded: 0,
    stripePaymentIntent: "pi_123",
    trackingCarrier: null,
    trackingNumber: null,
    trackingUrl: null,
    shippingName: "Jane Operator",
    shippingLine1: "Example Street 1",
    shippingLine2: null,
    shippingPostalCode: "10115",
    shippingCity: "Berlin",
    shippingCountry: "DE",
    confirmationEmailSentAt: null,
    shippingEmailSentAt: null,
    refundEmailSentAt: null,
    discountCode: null,
    customerEmail: "jane@example.com",
    userId: "user_1",
    user: {
      email: "jane@example.com",
      name: "Jane Operator",
    },
    items: [
      {
        id: "item_1",
        productId: "product_1",
        variantId: "variant_1",
        name: "Hemp Grinder",
        manufacturer: "Smokeify",
        quantity: 2,
        unitAmount: 5000,
        totalAmount: 10000,
        baseCostAmount: 4000,
        paymentFeeAmount: 390,
        adjustedCostAmount: 4390,
        taxAmount: 1900,
        taxRateBasisPoints: 1900,
        currency: "EUR",
        imageUrl: null,
        options: [],
      },
    ],
    ...overrides,
  };
}

describe("adminOrderQueue", () => {
  it("classifies paid non-fulfilled orders as ready to fulfill", () => {
    expect(
      isReadyToFulfillOrder(
        buildOrder({
          status: "processing",
          paymentStatus: "paid",
        }),
      ),
    ).toBe(true);
  });

  it("treats unpaid open orders as awaiting payment", () => {
    expect(
      isAwaitingPaymentOrder(
        buildOrder({
          status: "processing",
          paymentStatus: "pending",
        }),
      ),
    ).toBe(true);
  });

  it("marks fulfilled orders as archived", () => {
    expect(
      isArchivedOrder(
        buildOrder({
          status: "fulfilled",
        }),
      ),
    ).toBe(true);
  });

  it("prioritizes paid orders without tracking as attention items", () => {
    expect(
      getOrderQueueTone(
        buildOrder({
          status: "processing",
          paymentStatus: "paid",
          trackingNumber: null,
        }),
      ),
    ).toBe("attention");
  });

  it("matches search against order number, customer, tracking, and source metadata", () => {
    const order = buildOrder({
      orderNumber: 404,
      trackingCarrier: "DHL",
      trackingNumber: "TRACK-404",
      user: {
        email: "ops@example.com",
        name: "Queue Owner",
      },
    });

    expect(matchesOrderSearch(order, "404")).toBe(true);
    expect(matchesOrderSearch(order, "queue owner")).toBe(true);
    expect(matchesOrderSearch(order, "track-404")).toBe(true);
    expect(matchesOrderSearch(order, "smokeify.io")).toBe(true);
    expect(matchesOrderSearch(order, "no-hit")).toBe(false);
  });
});
