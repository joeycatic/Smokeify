import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireFreshAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  isSameOrigin: vi.fn(),
  suppressCheckoutRecoverySession: vi.fn(),
  resumeCheckoutRecoverySession: vi.fn(),
  sendCheckoutRecoverySessionNow: vi.fn(),
  logAdminAction: vi.fn(),
}));

vi.mock("@/lib/adminCatalog", () => ({
  requireFreshAdmin: mocks.requireFreshAdmin,
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/requestSecurity", () => ({
  isSameOrigin: mocks.isSameOrigin,
}));

vi.mock("@/lib/checkoutRecoveryService", () => ({
  suppressCheckoutRecoverySession: mocks.suppressCheckoutRecoverySession,
  resumeCheckoutRecoverySession: mocks.resumeCheckoutRecoverySession,
  sendCheckoutRecoverySessionNow: mocks.sendCheckoutRecoverySessionNow,
}));

vi.mock("@/lib/adminAuditLog", () => ({
  logAdminAction: mocks.logAdminAction,
}));

import { PATCH } from "./route";

const session = {
  user: {
    id: "admin_123",
    email: "admin@smokeify.com",
    role: "ADMIN",
  },
};

const buildRequest = (body: unknown) =>
  new NextRequest("https://www.smokeify.de/api/admin/checkout-recovery/sessions/session_1", {
    method: "PATCH",
    headers: {
      origin: "https://www.smokeify.de",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("PATCH /api/admin/checkout-recovery/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOrigin.mockReturnValue(true);
    mocks.requireFreshAdmin.mockResolvedValue(session);
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 39,
      resetAt: new Date("2026-05-24T12:00:00.000Z"),
    });
  });

  it("rejects unsupported session actions", async () => {
    const response = await PATCH(buildRequest({ action: "noop" }), {
      params: Promise.resolve({ id: "session_1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unsupported action." });
  });

  it("dispatches suppression requests and records an audit log", async () => {
    mocks.suppressCheckoutRecoverySession.mockResolvedValue({
      id: "session_1",
      suppressionReason: "customer asked to stop",
    });

    const response = await PATCH(buildRequest({
      action: "suppress",
      reason: "customer asked to stop",
    }), {
      params: Promise.resolve({ id: "session_1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.suppressCheckoutRecoverySession).toHaveBeenCalledWith({
      sessionId: "session_1",
      reason: "customer asked to stop",
    });
    expect(mocks.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "checkout_recovery.session_suppressed",
        targetId: "session_1",
      }),
    );
  });
});
