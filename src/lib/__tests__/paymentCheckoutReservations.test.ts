import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkoutPaymentDraftFindMany: vi.fn(),
  checkoutPaymentDraftUpdateMany: vi.fn(),
  loyaltyPointTransactionFindMany: vi.fn(),
  transaction: vi.fn(),
  variantInventoryUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    checkoutPaymentDraft: {
      findMany: mocks.checkoutPaymentDraftFindMany,
      updateMany: mocks.checkoutPaymentDraftUpdateMany,
    },
    loyaltyPointTransaction: {
      findMany: mocks.loyaltyPointTransactionFindMany,
    },
  },
}));

vi.mock("@/lib/sentry", () => ({ captureException: vi.fn() }));

import {
  STALE_CHECKOUT_DRAFT_AGE_MS,
  cancelPendingCheckoutPaymentDraft,
  expireStaleCheckoutPaymentDrafts,
} from "@/lib/paymentCheckoutReservations";

const draft = {
  id: "draft_1",
  items: [
    { quantity: 2, variantId: "variant_1" },
    { quantity: 1, variantId: "variant_1" },
    { quantity: 1, variantId: "variant_2" },
  ],
  paymentOrderCode: "order_1",
};

describe("checkout payment reservation cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkoutPaymentDraftFindMany.mockResolvedValue([]);
    mocks.checkoutPaymentDraftUpdateMany.mockResolvedValue({ count: 1 });
    mocks.loyaltyPointTransactionFindMany.mockResolvedValue([]);
    mocks.variantInventoryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        checkoutPaymentDraft: {
          updateMany: mocks.checkoutPaymentDraftUpdateMany,
        },
        variantInventory: { updateMany: mocks.variantInventoryUpdateMany },
      }),
    );
  });

  it("releases a pending draft exactly once", async () => {
    await expect(cancelPendingCheckoutPaymentDraft(draft)).resolves.toBe(true);

    expect(mocks.checkoutPaymentDraftUpdateMany).toHaveBeenCalledWith({
      where: { id: "draft_1", status: "pending" },
      data: { paymentStatus: "cancelled", status: "cancelled" },
    });
    expect(mocks.variantInventoryUpdateMany).toHaveBeenCalledTimes(2);
    expect(mocks.variantInventoryUpdateMany).toHaveBeenCalledWith({
      where: { variantId: "variant_1", reserved: { gte: 3 } },
      data: { reserved: { decrement: 3 } },
    });
  });

  it("does not release inventory when another request already cancelled the draft", async () => {
    mocks.checkoutPaymentDraftUpdateMany.mockResolvedValue({ count: 0 });

    await expect(cancelPendingCheckoutPaymentDraft(draft)).resolves.toBe(false);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.variantInventoryUpdateMany).not.toHaveBeenCalled();
    expect(mocks.loyaltyPointTransactionFindMany).not.toHaveBeenCalled();
  });

  it("expires only drafts outside the Viva timeout safety window", async () => {
    const now = new Date("2026-07-14T20:00:00.000Z");
    mocks.checkoutPaymentDraftFindMany.mockResolvedValue([draft]);

    await expect(expireStaleCheckoutPaymentDrafts(now)).resolves.toBe(1);

    expect(mocks.checkoutPaymentDraftFindMany).toHaveBeenCalledWith({
      where: {
        status: "pending",
        createdAt: {
          lte: new Date(now.getTime() - STALE_CHECKOUT_DRAFT_AGE_MS),
        },
      },
      select: {
        id: true,
        items: true,
        paymentOrderCode: true,
      },
    });
  });
});
