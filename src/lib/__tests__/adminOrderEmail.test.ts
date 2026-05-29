import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendResendEmail = vi.fn();
const buildOrderEmail = vi.fn(() => ({
  subject: "Shipping update",
  html: "<p>Update</p>",
  text: "Update",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/resend", () => ({
  sendResendEmail,
}));

vi.mock("@/lib/orderEmail", () => ({
  buildOrderEmail,
}));

let sendAdminOrderEmailForOrder: typeof import("../adminOrderEmail").sendAdminOrderEmailForOrder;

describe("sendAdminOrderEmailForOrder", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    ({ sendAdminOrderEmailForOrder } = await import("../adminOrderEmail"));
  });

  it("falls back to the linked user email when the order email is missing", async () => {
    const result = await sendAdminOrderEmailForOrder({
      type: "shipping",
      requestOrigin: "https://smokeify.test",
      order: {
        id: "ord_123",
        userId: "user_123",
        user: { email: "account@example.com", name: "Test User" },
        sourceStorefront: null,
        sourceHost: "www.smokeify.de",
        sourceOrigin: "https://www.smokeify.de",
        customerEmail: null,
        shippingName: "Test User",
        createdAt: new Date("2026-05-29T10:00:00.000Z"),
        currency: "EUR",
        amountSubtotal: 1000,
        amountTax: 190,
        amountShipping: 490,
        amountDiscount: 0,
        amountTotal: 1680,
        amountRefunded: 0,
        discountCode: null,
        trackingCarrier: "DHL",
        trackingNumber: "TRACK-123",
        trackingUrl: "https://tracking.example/track-123",
        items: [
          {
            name: "Product",
            quantity: 1,
            totalAmount: 1680,
            currency: "EUR",
          },
        ],
      },
    });

    expect(sendResendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "account@example.com" }),
    );
    expect(buildOrderEmail).toHaveBeenCalled();
    expect(result.recipient).toBe("account@example.com");
  });
});
