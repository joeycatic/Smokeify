import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/adminCatalog", () => ({
  requireFreshAdmin: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/requestSecurity", () => ({
  isSameOrigin: vi.fn(),
}));

import { requireFreshAdmin } from "@/lib/adminCatalog";
import { withAdminRoute } from "@/lib/adminRoute";
import { checkRateLimit } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

const buildRequest = (init?: RequestInit) =>
  new NextRequest("https://www.smokeify.de/api/admin/test", {
    method: "POST",
    headers: {
      origin: "https://www.smokeify.de",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

const adminSession = {
  user: {
    id: "admin_123",
    email: "admin@example.com",
    role: "ADMIN",
  },
};

describe("withAdminRoute", () => {
  beforeEach(() => {
    vi.mocked(isSameOrigin).mockReturnValue(true);
    vi.mocked(requireFreshAdmin).mockResolvedValue(adminSession as never);
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: new Date("2026-05-17T10:00:00.000Z"),
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects forged mutating requests before auth and adds timing headers", async () => {
    vi.mocked(isSameOrigin).mockReturnValue(false);
    const handler = vi.fn(async () => new Response("ok"));

    const response = await withAdminRoute(handler)(buildRequest());

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(requireFreshAdmin).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Server-Timing")).toContain("origin");
    expect(response.headers.get("Server-Timing")).toContain("total");
    expect(response.headers.get("X-Response-Time")).toMatch(/ms$/);
  });

  it("returns rate-limit metadata when a protected route is throttled", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date("2026-05-17T10:00:00.000Z"),
    } as never);

    const response = await withAdminRoute(
      async () => new Response("ok"),
      {
        rateLimit: {
          keyPrefix: "admin-test",
          limit: 10,
          windowMs: 60_000,
        },
      },
    )(buildRequest());

    expect(response.status).toBe(429);
    expect(requireFreshAdmin).not.toHaveBeenCalled();
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("Server-Timing")).toContain("ratelimit");
    expect(response.headers.get("X-Response-Time")).toMatch(/ms$/);
  });

  it("returns unauthorized when the fresh admin session is missing", async () => {
    vi.mocked(requireFreshAdmin).mockResolvedValue(null);

    const response = await withAdminRoute(async () => new Response("ok"))(buildRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("Server-Timing")).toContain("auth");
    expect(response.headers.get("X-Response-Time")).toMatch(/ms$/);
  });

  it("wraps successful responses with admin cache and timing headers", async () => {
    const response = await withAdminRoute(async () => new Response("ok"))(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Server-Timing")).toContain("handler");
    expect(response.headers.get("Server-Timing")).toContain("total");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("X-Response-Time")).toMatch(/ms$/);
  });
});
