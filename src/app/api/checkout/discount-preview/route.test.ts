import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  findRedeemableDiscountCode: vi.fn(),
  getServerSession: vi.fn(),
  isSameOrigin: vi.fn(),
  resolveCartItemsForRequest: vi.fn(),
  variantFindMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/discountCodes", () => ({
  findRedeemableDiscountCode: mocks.findRedeemableDiscountCode,
  normalizeDiscountCode: (value: string) => value.trim().replace(/\s+/g, "").toUpperCase(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { variant: { findMany: mocks.variantFindMany } },
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/requestSecurity", () => ({ isSameOrigin: mocks.isSameOrigin }));
vi.mock("@/lib/serverCartStorage", () => ({
  resolveCartItemsForRequest: mocks.resolveCartItemsForRequest,
}));

import { POST } from "./route";

const buildRequest = (body: unknown) =>
  new Request("https://www.smokeify.de/api/checkout/discount-preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://www.smokeify.de",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/checkout/discount-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOrigin.mockReturnValue(true);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getServerSession.mockResolvedValue(null);
    mocks.resolveCartItemsForRequest.mockResolvedValue([
      { variantId: "variant_1", quantity: 2 },
    ]);
    mocks.variantFindMany.mockResolvedValue([{ id: "variant_1", priceCents: 2500 }]);
  });

  it("calculates the preview from server-owned cart prices", async () => {
    mocks.findRedeemableDiscountCode.mockResolvedValue({
      discount: { code: "WELCOME10" },
      discountCents: 1000,
    });

    const response = await POST(
      buildRequest({ country: "DE", discountCode: " welcome 10 ", subtotalCents: 1 }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      valid: true,
      code: "WELCOME10",
      discountCents: 1000,
      subtotalCents: 5000,
      currency: "EUR",
    });
    expect(body.totalCents).toBe(body.subtotalCents + body.shippingCents - 1000);
    expect(mocks.findRedeemableDiscountCode).toHaveBeenCalledWith({
      code: "WELCOME10",
      customerEmail: undefined,
      currency: "EUR",
      subtotalCents: 5000,
    });
  });

  it("returns an immediate invalid state for an unknown code", async () => {
    mocks.findRedeemableDiscountCode.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ country: "DE", discountCode: "UNKNOWN" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: false,
      code: "UNKNOWN",
      discountCents: 0,
      message: "Rabattcode ungültig oder abgelaufen.",
    });
  });

  it("does not query a discount for an empty cart", async () => {
    mocks.resolveCartItemsForRequest.mockResolvedValue([]);
    mocks.variantFindMany.mockResolvedValue([]);

    const response = await POST(
      buildRequest({ country: "DE", discountCode: "WELCOME10" }),
    );

    expect(await response.json()).toMatchObject({
      valid: false,
      subtotalCents: 0,
      message: "Dein Warenkorb ist leer.",
    });
    expect(mocks.findRedeemableDiscountCode).not.toHaveBeenCalled();
  });

  it("enforces same-origin and rate-limit checks", async () => {
    mocks.isSameOrigin.mockReturnValue(false);
    expect((await POST(buildRequest({ discountCode: "WELCOME10" }))).status).toBe(403);

    mocks.isSameOrigin.mockReturnValue(true);
    mocks.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await POST(buildRequest({ discountCode: "WELCOME10" }))).status).toBe(429);
  });
});
