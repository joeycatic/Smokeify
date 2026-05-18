import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSmokeifyDiscordLinkTokenPayload,
  createSmokeifyDiscordLinkToken,
  normalizeDiscordLinkChallenge,
  signSmokeifyDiscordLinkToken,
  verifySmokeifyDiscordLinkToken,
} from "@/lib/discordLinkToken";

const ORIGINAL_LINK_SECRET = process.env.SMOKEIFY_LINK_TOKEN_SECRET;

describe("discordLinkToken", () => {
  beforeEach(() => {
    delete process.env.SMOKEIFY_LINK_TOKEN_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();

    if (typeof ORIGINAL_LINK_SECRET === "string") {
      process.env.SMOKEIFY_LINK_TOKEN_SECRET = ORIGINAL_LINK_SECRET;
    } else {
      delete process.env.SMOKEIFY_LINK_TOKEN_SECRET;
    }
  });

  it("requires the dedicated Smokeify link token secret", () => {
    const payload = buildSmokeifyDiscordLinkTokenPayload({
      discordUserId: "123456789012345678",
      challenge: "ABCD-EFGH",
      customerId: "user_123",
    });

    expect(() => signSmokeifyDiscordLinkToken(payload)).toThrow(
      "SMOKEIFY_LINK_TOKEN_SECRET is not configured",
    );
  });

  it("normalizes compact and lowercase challenge input", () => {
    expect(normalizeDiscordLinkChallenge("abcd efgh")).toBe("ABCD-EFGH");
    expect(normalizeDiscordLinkChallenge("abcd-efgh")).toBe("ABCD-EFGH");
    expect(normalizeDiscordLinkChallenge("abcd123")).toBeNull();
  });

  it("creates tokens that round-trip through the Smokeify contract", () => {
    process.env.SMOKEIFY_LINK_TOKEN_SECRET = "smokeify-link-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:05:00.000Z"));

    const issuedAt = new Date("2026-04-01T12:00:00.000Z");
    const { token, payload } = createSmokeifyDiscordLinkToken({
      discordUserId: "123456789012345678",
      challenge: "abcd-efgh",
      customerId: "cus_123",
      customerRef: "joey",
      displayName: "Joey Example",
      issuedAt,
      ttlSeconds: 600,
    });

    expect(payload).toEqual({
      v: 1,
      provider: "SMOKEIFY",
      discordUserId: "123456789012345678",
      challenge: "ABCD-EFGH",
      customerId: "cus_123",
      customerRef: "joey",
      displayName: "Joey Example",
      iat: 1_775_044_800,
      exp: 1_775_045_400,
    });
    expect(verifySmokeifyDiscordLinkToken(token, "smokeify-link-secret")).toEqual(
      payload,
    );
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:20:00.000Z"));

    const expiredToken = signSmokeifyDiscordLinkToken(
      {
        v: 1,
        provider: "SMOKEIFY",
        discordUserId: "123456789012345678",
        challenge: "ABCD-EFGH",
        customerId: "cus_123",
        iat: 1_775_044_800,
        exp: 1_775_045_400,
      },
      "smokeify-link-secret",
    );

    expect(() =>
      verifySmokeifyDiscordLinkToken(expiredToken, "smokeify-link-secret"),
    ).toThrow("Link token has expired.");
  });
});
