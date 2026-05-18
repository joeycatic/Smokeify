import { describe, expect, it } from "vitest";
import {
  calculateReturnRequestAmountCents,
  getReturnOrderStatus,
} from "@/lib/adminReturns";

describe("adminReturns", () => {
  it("calculates itemized return value from quantities and unit amounts", () => {
    expect(
      calculateReturnRequestAmountCents([
        { quantity: 2, unitAmount: 1299 },
        { quantity: 1, unitAmount: 499 },
      ])
    ).toBe(3097);
  });

  it("maps exchange approvals to a dedicated exchange in-progress order status", () => {
    expect(
      getReturnOrderStatus({
        requestStatus: "APPROVED",
        requestedResolution: "EXCHANGE",
      })
    ).toBe("return_exchange_in_progress");
  });

  it("maps rejected requests to return_rejected regardless of resolution type", () => {
    expect(
      getReturnOrderStatus({
        requestStatus: "REJECTED",
        requestedResolution: "STORE_CREDIT",
      })
    ).toBe("return_rejected");
  });
});
