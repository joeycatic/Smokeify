import { afterEach, describe, expect, it } from "vitest";
import {
  buildRefundRequestToken,
  buildRefundRequestUrl,
  verifyRefundRequestToken,
} from "@/lib/refundRequestLink";

const originalSecret = process.env.REFUND_REQUEST_LINK_SECRET;
const originalOrderSecret = process.env.ORDER_VIEW_LINK_SECRET;

const restoreEnvVar = (key: string, value: string | undefined) => {
  if (typeof value === "undefined") {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

afterEach(() => {
  restoreEnvVar("REFUND_REQUEST_LINK_SECRET", originalSecret);
  restoreEnvVar("ORDER_VIEW_LINK_SECRET", originalOrderSecret);
});

describe("refundRequestLink", () => {
  it("builds and verifies a refund request token", () => {
    process.env.REFUND_REQUEST_LINK_SECRET = "refund-secret";

    const expiresAt = Date.now() + 10_000;
    const token = buildRefundRequestToken("ord_test_123", expiresAt);

    expect(token).toBeTruthy();
    expect(verifyRefundRequestToken("ord_test_123", expiresAt, token!)).toBe(true);
    expect(verifyRefundRequestToken("ord_test_999", expiresAt, token!)).toBe(false);
  });

  it("falls back to the order view secret when a dedicated secret is missing", () => {
    delete process.env.REFUND_REQUEST_LINK_SECRET;
    process.env.ORDER_VIEW_LINK_SECRET = "order-view-secret";

    const url = buildRefundRequestUrl("https://growvault.test", "ord_test_123");

    expect(url).toContain("https://growvault.test/returns/request/ord_test_123");
    expect(url).toContain("token=");
    expect(url).toContain("expires=");
  });
});
