import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseMobileToken, signMobileToken } from "@/lib/mobileToken";

const ORIGINAL_MOBILE_SECRET = process.env.MOBILE_API_TOKEN_SECRET;
const ORIGINAL_AUTH_SECRET = process.env.NEXTAUTH_SECRET;

describe("mobileToken", () => {
  beforeEach(() => {
    delete process.env.MOBILE_API_TOKEN_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    if (typeof ORIGINAL_MOBILE_SECRET === "string") {
      process.env.MOBILE_API_TOKEN_SECRET = ORIGINAL_MOBILE_SECRET;
    } else {
      delete process.env.MOBILE_API_TOKEN_SECRET;
    }

    if (typeof ORIGINAL_AUTH_SECRET === "string") {
      process.env.NEXTAUTH_SECRET = ORIGINAL_AUTH_SECRET;
    } else {
      delete process.env.NEXTAUTH_SECRET;
    }
  });

  it("fails closed when no token secret is configured", () => {
    expect(() =>
      signMobileToken({
        sub: "user_123",
        email: "user@example.com",
        name: "User",
        exp: Math.floor(Date.now() / 1000) + 60,
      })
    ).toThrow("Mobile API token secret is not configured");
    expect(parseMobileToken("Bearer anything")).toBeNull();
  });

  it("signs and parses tokens with the mobile secret", () => {
    process.env.MOBILE_API_TOKEN_SECRET = "mobile-secret";

    const token = signMobileToken({
      sub: "user_123",
      email: "user@example.com",
      name: "User",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expect(parseMobileToken(`Bearer ${token}`)).toMatchObject({
      sub: "user_123",
      email: "user@example.com",
      name: "User",
    });
  });

  it("falls back to NEXTAUTH_SECRET when the dedicated mobile secret is absent", () => {
    process.env.NEXTAUTH_SECRET = "nextauth-secret";

    const token = signMobileToken({
      sub: "user_456",
      email: "fallback@example.com",
      name: "Fallback User",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expect(parseMobileToken(`Bearer ${token}`)).toMatchObject({
      sub: "user_456",
      email: "fallback@example.com",
    });
  });
});

