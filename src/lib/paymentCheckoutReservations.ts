import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildLoyaltyHoldReason,
  buildLoyaltyReleasedReason,
} from "@/lib/loyalty";
import { captureException } from "@/lib/sentry";

export const STALE_CHECKOUT_DRAFT_AGE_MS = 60 * 60 * 1000;

type CheckoutDraftForCancellation = {
  id: string;
  items: Prisma.JsonValue;
  paymentOrderCode: string;
};

const readDraftItemsForRelease = (value: Prisma.JsonValue) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { quantity: 0, variantId: null };
      }
      return {
        quantity: typeof item.quantity === "number" ? item.quantity : 0,
        variantId: typeof item.variantId === "string" ? item.variantId : null,
      };
    })
    .filter((item) => item.variantId && item.quantity > 0);
};

const countVariants = (
  items: Array<{ quantity?: number | null; variantId?: string | null }>,
) => {
  const variantCounts = new Map<string, number>();
  for (const item of items) {
    if (!item.variantId) continue;
    const quantity = Math.max(0, item.quantity ?? 0);
    if (!quantity) continue;
    variantCounts.set(item.variantId, (variantCounts.get(item.variantId) ?? 0) + quantity);
  }
  return variantCounts;
};

export const releaseReservedInventoryForItems = async (
  items: Array<{ quantity?: number | null; variantId?: string | null }>,
  paymentOrderCode: string,
  options?: { logMissingReservation?: boolean },
) => {
  const variantCounts = countVariants(items);
  if (variantCounts.size === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const [variantId, quantity] of variantCounts) {
      const updated = await tx.variantInventory.updateMany({
        where: { variantId, reserved: { gte: quantity } },
        data: { reserved: { decrement: quantity } },
      });
      if (updated.count === 0 && options?.logMissingReservation !== false) {
        console.warn("[payment checkout] Reservation not found to release.", {
          paymentOrderCode,
          quantity,
          variantId,
        });
      }
    }
  });
};

export const releaseLoyaltyHoldForPaymentOrder = async (paymentOrderCode: string) => {
  const holdReason = buildLoyaltyHoldReason(paymentOrderCode);
  const releasedReason = buildLoyaltyReleasedReason(paymentOrderCode);

  try {
    await prisma.$transaction(async (tx) => {
      const holds = await tx.loyaltyPointTransaction.findMany({
        where: { reason: holdReason },
        select: { id: true, pointsDelta: true, userId: true },
      });
      if (holds.length === 0) return;

      for (const hold of holds) {
        const releasedPoints = Math.max(0, -hold.pointsDelta);
        if (releasedPoints > 0) {
          await tx.user.update({
            where: { id: hold.userId },
            data: { loyaltyPointsBalance: { increment: releasedPoints } },
          });
        }
        await tx.loyaltyPointTransaction.update({
          where: { id: hold.id },
          data: {
            reason: releasedReason,
            metadata: {
              paymentOrderCode,
              releasedPoints,
              status: "released",
            },
          },
        });
      }
    });
  } catch (error) {
    captureException(error, {
      context: "releaseLoyaltyHoldForPaymentOrder",
      paymentOrderCode,
    });
  }
};

export const cancelPendingCheckoutPaymentDraft = async (
  draft: CheckoutDraftForCancellation,
) => {
  const variantCounts = countVariants(readDraftItemsForRelease(draft.items));
  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.checkoutPaymentDraft.updateMany({
      where: { id: draft.id, status: "pending" },
      data: { paymentStatus: "cancelled", status: "cancelled" },
    });
    if (updated.count === 0) return false;

    for (const [variantId, quantity] of variantCounts) {
      await tx.variantInventory.updateMany({
        where: { variantId, reserved: { gte: quantity } },
        data: { reserved: { decrement: quantity } },
      });
    }
    return true;
  });
  if (!claimed) return false;

  await releaseLoyaltyHoldForPaymentOrder(draft.paymentOrderCode);
  return true;
};

export const expireStaleCheckoutPaymentDrafts = async (
  now = new Date(),
) => {
  const cutoff = new Date(now.getTime() - STALE_CHECKOUT_DRAFT_AGE_MS);
  const staleDrafts = await prisma.checkoutPaymentDraft.findMany({
    where: {
      status: "pending",
      createdAt: { lte: cutoff },
    },
    select: {
      id: true,
      items: true,
      paymentOrderCode: true,
    },
  });

  let expiredCount = 0;
  for (const draft of staleDrafts) {
    if (await cancelPendingCheckoutPaymentDraft(draft)) {
      expiredCount += 1;
    }
  }
  return expiredCount;
};
