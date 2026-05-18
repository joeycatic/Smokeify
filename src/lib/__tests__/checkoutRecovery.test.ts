import { describe, expect, it } from "vitest";
import {
  getCheckoutRecoveryEventId,
  isRecoverableCheckoutSession,
  parseCheckoutRecoveryBatchSize,
  parseCheckoutRecoveryDelayMinutes,
} from "../checkoutRecovery";

describe("checkoutRecovery", () => {
  it("builds stable event ids", () => {
    expect(getCheckoutRecoveryEventId("cs_test_123")).toBe(
      "checkout_recovery:cs_test_123"
    );
  });

  it("parses delay minutes with sane defaults", () => {
    expect(parseCheckoutRecoveryDelayMinutes(undefined)).toBe(60);
    expect(parseCheckoutRecoveryDelayMinutes("0")).toBe(60);
    expect(parseCheckoutRecoveryDelayMinutes("90")).toBe(90);
  });

  it("parses batch size with cap", () => {
    expect(parseCheckoutRecoveryBatchSize(undefined)).toBe(50);
    expect(parseCheckoutRecoveryBatchSize("0")).toBe(50);
    expect(parseCheckoutRecoveryBatchSize("10")).toBe(10);
    expect(parseCheckoutRecoveryBatchSize("500")).toBe(100);
  });

  it("checks recoverable sessions", () => {
    expect(
      isRecoverableCheckoutSession({
        id: "cs_1",
        mode: "payment",
        status: "open",
        payment_status: "unpaid",
      })
    ).toBe(true);
    expect(
      isRecoverableCheckoutSession({
        id: "cs_2",
        mode: "payment",
        status: "complete",
        payment_status: "paid",
      })
    ).toBe(false);
  });
});
