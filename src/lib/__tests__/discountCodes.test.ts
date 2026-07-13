import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    discountCode: {
      findFirst: mocks.findFirst,
    },
  },
}));

import { findRedeemableDiscountCode } from "@/lib/discountCodes";

const discount = {
  id: "discount_1",
  code: "PERSONAL5",
  active: true,
  percentOff: null,
  amountOffCents: 500,
  currency: "EUR",
  maxRedemptions: 1,
  timesRedeemed: 0,
  expiresAt: null,
  source: "newsletter_offer",
  metadata: { email: "owner@example.com" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("findRedeemableDiscountCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(discount);
  });

  it("accepts a personal code for its owning email", async () => {
    await expect(
      findRedeemableDiscountCode({
        code: "personal5",
        customerEmail: " Owner@Example.com ",
        currency: "EUR",
        subtotalCents: 5000,
      }),
    ).resolves.toMatchObject({ discount, discountCents: 500 });
  });

  it("rejects a personal code for a different checkout email", async () => {
    await expect(
      findRedeemableDiscountCode({
        code: "PERSONAL5",
        customerEmail: "other@example.com",
        currency: "EUR",
        subtotalCents: 5000,
      }),
    ).resolves.toBeNull();
  });

  it("allows a guest preview while checkout performs the final email check", async () => {
    await expect(
      findRedeemableDiscountCode({
        code: "PERSONAL5",
        currency: "EUR",
        subtotalCents: 5000,
      }),
    ).resolves.toMatchObject({ discountCents: 500 });
  });
});
