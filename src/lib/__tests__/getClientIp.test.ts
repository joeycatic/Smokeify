import { describe, it, expect } from "vitest";

// getClientIp uses 'server-only' which throws in test environments.
// We extract + re-test just the IP resolution logic directly.
import { isIP } from "node:net";

// Replicate the logic from rateLimit.ts for testability
function getClientIp(
  headers: Headers | Record<string, string | string[] | undefined> | undefined
): string {
  const readHeader = (name: string) => {
    if (!headers) return undefined;
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) ?? undefined;
    }
    const record = headers as Record<string, string | string[] | undefined>;
    const value = record[name] ?? record[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const parseValidIp = (value: string | undefined) => {
    if (!value) return undefined;
    const candidate = value.split(",")[0]?.trim();
    if (!candidate) return undefined;
    return isIP(candidate) ? candidate : undefined;
  };

  const directProxyIp = parseValidIp(readHeader("x-vercel-forwarded-for"));
  if (directProxyIp) return directProxyIp;

  const cloudflareIp = parseValidIp(readHeader("cf-connecting-ip"));
  if (cloudflareIp) return cloudflareIp;

  const forwarded = parseValidIp(readHeader("x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = parseValidIp(readHeader("x-real-ip"));
  if (realIp) return realIp;

  return "unknown";
}

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for over all others", () => {
    expect(
      getClientIp({
        "x-vercel-forwarded-for": "1.2.3.4",
        "cf-connecting-ip": "5.6.7.8",
        "x-forwarded-for": "9.10.11.12",
      })
    ).toBe("1.2.3.4");
  });

  it("falls back to cf-connecting-ip", () => {
    expect(
      getClientIp({
        "cf-connecting-ip": "5.6.7.8",
        "x-forwarded-for": "9.10.11.12",
      })
    ).toBe("5.6.7.8");
  });

  it("falls back to x-forwarded-for", () => {
    expect(
      getClientIp({
        "x-forwarded-for": "9.10.11.12",
      })
    ).toBe("9.10.11.12");
  });

  it("takes only the first IP from x-forwarded-for chain", () => {
    expect(
      getClientIp({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" })
    ).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp({ "x-real-ip": "203.0.113.1" })).toBe("203.0.113.1");
  });

  it("returns 'unknown' when no valid IP header is present", () => {
    expect(getClientIp({})).toBe("unknown");
  });

  it("returns 'unknown' when headers is undefined", () => {
    expect(getClientIp(undefined)).toBe("unknown");
  });

  it("rejects non-IP values", () => {
    expect(getClientIp({ "x-forwarded-for": "not-an-ip" })).toBe("unknown");
  });

  it("accepts IPv6 addresses", () => {
    expect(
      getClientIp({ "x-forwarded-for": "2001:db8::1" })
    ).toBe("2001:db8::1");
  });

  it("works with a Headers object", () => {
    const headers = new Headers({ "x-real-ip": "10.0.0.1" });
    expect(getClientIp(headers)).toBe("10.0.0.1");
  });
});
