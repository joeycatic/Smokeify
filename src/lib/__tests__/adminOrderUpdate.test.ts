import { describe, expect, it } from "vitest";
import { buildAdminOrderPatch } from "@/lib/adminOrderUpdate";

describe("buildAdminOrderPatch", () => {
  it("blocks direct payment status writes", () => {
    expect(() =>
      buildAdminOrderPatch({
        paymentStatus: "paid",
      }),
    ).toThrow(/Payment status is managed by Stripe webhooks/i);
  });

  it("allows operational status and tracking updates", () => {
    expect(
      buildAdminOrderPatch({
        status: " Fulfilled ",
        trackingCarrier: " DHL ",
        trackingNumber: " 123 ",
        trackingUrl: "",
      }),
    ).toEqual({
      updates: {
        status: "fulfilled",
        trackingCarrier: "DHL",
        trackingNumber: "123",
        trackingUrl: null,
      },
      changedFields: ["status", "trackingCarrier", "trackingNumber", "trackingUrl"],
    });
  });

  it("rejects payment-managed statuses in the generic admin editor", () => {
    expect(() =>
      buildAdminOrderPatch({
        status: "paid",
      }),
    ).toThrow(/Only fulfillment and return statuses can be updated/i);
  });

  it("does not reject unchanged legacy statuses while saving tracking updates", () => {
    expect(
      buildAdminOrderPatch(
        {
          status: "complete",
          trackingCarrier: "DHL",
          trackingNumber: "123456",
        },
        { currentStatus: "complete" },
      ),
    ).toEqual({
      updates: {
        trackingCarrier: "DHL",
        trackingNumber: "123456",
      },
      changedFields: ["trackingCarrier", "trackingNumber"],
    });
  });
});
