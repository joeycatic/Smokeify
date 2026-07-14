import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelPendingCheckoutPaymentDraft: vi.fn(),
  checkRateLimit: vi.fn(),
  draftFindUnique: vi.fn(),
  isSameOrigin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    checkoutPaymentDraft: { findUnique: mocks.draftFindUnique },
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/requestSecurity", () => ({ isSameOrigin: mocks.isSameOrigin }));

vi.mock("@/lib/paymentCheckoutReservations", () => ({
  cancelPendingCheckoutPaymentDraft: mocks.cancelPendingCheckoutPaymentDraft,
}));

import { DELETE } from "./route";

const editToken = "editor-token";
const buildRequest = () =>
  new Request("https://www.smokeify.de/api/checkout/session", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      origin: "https://www.smokeify.de",
    },
    body: JSON.stringify({ editToken, sessionId: "order_1" }),
  });

describe("DELETE /api/checkout/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOrigin.mockReturnValue(true);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.cancelPendingCheckoutPaymentDraft.mockResolvedValue(true);
  });

  it("treats an already-removed session as successfully released", async () => {
    mocks.draftFindUnique.mockResolvedValue(null);

    const response = await DELETE(buildRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.cancelPendingCheckoutPaymentDraft).not.toHaveBeenCalled();
  });

  it("cancels a matching draft through the idempotent reservation helper", async () => {
    const draft = {
      id: "draft_1",
      editTokenHash: createHash("sha256").update(editToken).digest("hex"),
      items: [],
      paymentOrderCode: "order_1",
      status: "pending",
    };
    mocks.draftFindUnique.mockResolvedValue(draft);

    const response = await DELETE(buildRequest());

    expect(response.status).toBe(200);
    expect(mocks.cancelPendingCheckoutPaymentDraft).toHaveBeenCalledWith(draft);
  });

  it("does not allow a mismatched editor token to cancel a draft", async () => {
    mocks.draftFindUnique.mockResolvedValue({
      id: "draft_1",
      editTokenHash: createHash("sha256").update("different-token").digest("hex"),
      items: [],
      paymentOrderCode: "order_1",
      status: "pending",
    });

    const response = await DELETE(buildRequest());

    expect(response.status).toBe(403);
    expect(mocks.cancelPendingCheckoutPaymentDraft).not.toHaveBeenCalled();
  });
});
