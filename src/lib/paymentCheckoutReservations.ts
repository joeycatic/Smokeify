import { prisma } from "@/lib/prisma";
import {
  buildLoyaltyHoldReason,
  buildLoyaltyReleasedReason,
} from "@/lib/loyalty";
import { captureException } from "@/lib/sentry";

export const releaseReservedInventoryForItems = async (
  items: Array<{ quantity?: number | null; variantId?: string | null }>,
  paymentOrderCode: string,
  options?: { logMissingReservation?: boolean },
) => {
  const variantCounts = new Map<string, number>();
  for (const item of items) {
    if (!item.variantId) continue;
    const quantity = Math.max(0, item.quantity ?? 0);
    if (!quantity) continue;
    variantCounts.set(item.variantId, (variantCounts.get(item.variantId) ?? 0) + quantity);
  }
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
