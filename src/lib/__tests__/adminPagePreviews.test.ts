import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  checkoutPaymentDraftFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    checkoutPaymentDraft: {
      findFirst: prismaMocks.checkoutPaymentDraftFindFirst,
    },
    order: {
      findFirst: prismaMocks.orderFindFirst,
    },
  },
}));

import { getAdminPagePreviews } from "@/lib/adminPagePreviews";

const originalEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_GROW_APP_URL: process.env.NEXT_PUBLIC_GROW_APP_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
};

describe("adminPagePreviews", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.test";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.test";
    delete process.env.NEXTAUTH_URL;
    prismaMocks.orderFindFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where?.sourceStorefront === "GROW"
          ? null
          : { paymentOrderCode: "order_smokeify_123" },
      ),
    );
    prismaMocks.checkoutPaymentDraftFindFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where?.sourceStorefront === "GROW"
          ? { paymentOrderCode: "draft_grow_123" }
          : { paymentOrderCode: "draft_smokeify_123" },
      ),
    );
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_GROW_APP_URL = originalEnv.NEXT_PUBLIC_GROW_APP_URL;
    process.env.NEXTAUTH_URL = originalEnv.NEXTAUTH_URL;
    vi.clearAllMocks();
    consoleWarnSpy.mockRestore();
  });

  it("builds whitelisted preview URLs for both storefronts", async () => {
    const previews = await getAdminPagePreviews();

    expect(previews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "MAIN:order-success",
          status: "ready",
          url: "https://smokeify.test/order/success?order_code=order_smokeify_123",
        }),
        expect.objectContaining({
          id: "GROW:pending-order-confirmation",
          status: "contextual",
          url: "https://growvault.test/order/success?order_code=draft_grow_123",
        }),
        expect.objectContaining({
          id: "GROW:order-success",
          status: "missing-context",
          url: "https://growvault.test/order/success?order_code=missing-preview-order",
        }),
      ]),
    );
  });

  it("keeps the preview page available when optional context lookups fail", async () => {
    prismaMocks.orderFindFirst.mockRejectedValue(new Error("missing order context"));
    prismaMocks.checkoutPaymentDraftFindFirst.mockRejectedValue(
      new Error("missing checkout context"),
    );

    const previews = await getAdminPagePreviews();

    expect(previews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "MAIN:cart-empty",
          status: "ready",
          url: "https://smokeify.test/cart",
        }),
        expect.objectContaining({
          id: "MAIN:order-success",
          status: "missing-context",
          url: "https://smokeify.test/order/success?order_code=missing-preview-order",
        }),
        expect.objectContaining({
          id: "GROW:pending-order-confirmation",
          status: "missing-context",
          url: "https://growvault.test/order/success?order_code=missing-pending-draft",
        }),
      ]),
    );
  });
});
