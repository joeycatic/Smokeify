import { describe, expect, it } from "vitest";
import {
  createGuestCheckoutAccess,
  verifyGuestCheckoutAccess,
} from "@/lib/checkoutAccess";

describe("checkoutAccess", () => {
  it("verifies a fresh guest checkout access token", () => {
    const access = createGuestCheckoutAccess(60_000);

    expect(
      verifyGuestCheckoutAccess({
        token: access.token,
        expiresAt: access.expiresAt,
        expectedHash: access.tokenHash,
      })
    ).toBe(true);
  });

  it("rejects mismatched guest checkout access tokens", () => {
    const access = createGuestCheckoutAccess(60_000);

    expect(
      verifyGuestCheckoutAccess({
        token: "wrong-token",
        expiresAt: access.expiresAt,
        expectedHash: access.tokenHash,
      })
    ).toBe(false);
  });

  it("rejects expired guest checkout access tokens", () => {
    const now = Date.now();
    const access = createGuestCheckoutAccess(60_000);

    expect(
      verifyGuestCheckoutAccess({
        token: access.token,
        expiresAt: now - 1,
        expectedHash: access.tokenHash,
      })
    ).toBe(false);
  });
});

