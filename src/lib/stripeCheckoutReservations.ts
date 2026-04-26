import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  buildLoyaltyHoldReason,
  buildLoyaltyReleasedReason,
} from "@/lib/loyalty";
import { captureException } from "@/lib/sentry";

const listAllCheckoutSessionLineItems = async (
  stripe: Stripe,
  sessionId: string,
) => {
  const items: Stripe.ApiList<Stripe.LineItem>["data"] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.price.product"],
    });
    items.push(...(page.data ?? []));
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return items;
};

const getVariantCountsForSession = async (stripe: Stripe, sessionId: string) => {
  const lineItems = await listAllCheckoutSessionLineItems(stripe, sessionId);
  const variantCounts = new Map<string, number>();

  for (const item of lineItems) {
    const product = item.price?.product as Stripe.Product | null | undefined;
    const variantId =
      product?.metadata?.variantId || item.price?.metadata?.variantId || "";
    if (!variantId) continue;

    const quantity = Math.max(0, item.quantity ?? 0);
    if (!quantity) continue;

    variantCounts.set(
      variantId,
      (variantCounts.get(variantId) ?? 0) + quantity,
    );
  }

  return variantCounts;
};

export const releaseReservedInventory = async (
  stripe: Stripe,
  sessionId: string,
  options?: { logMissingReservation?: boolean },
) => {
  const variantCounts = await getVariantCountsForSession(stripe, sessionId);
  if (variantCounts.size === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const [variantId, quantity] of variantCounts) {
      if (quantity <= 0) continue;

      const updated = await tx.variantInventory.updateMany({
        where: { variantId, reserved: { gte: quantity } },
        data: { reserved: { decrement: quantity } },
      });

      if (updated.count === 0 && options?.logMissingReservation !== false) {
        console.warn("[stripe checkout] Reservation not found to release.", {
          quantity,
          sessionId,
          variantId,
        });
      }
    }
  });
};

export const releaseLoyaltyHoldForSession = async (sessionId: string) => {
  const holdReason = buildLoyaltyHoldReason(sessionId);
  const releasedReason = buildLoyaltyReleasedReason(sessionId);

  try {
    await prisma.$transaction(async (tx) => {
      const holds = await tx.loyaltyPointTransaction.findMany({
        where: { reason: holdReason },
        select: { id: true, userId: true, pointsDelta: true },
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
              releasedPoints,
              sessionId,
              status: "released",
            },
          },
        });
      }
    });
  } catch (error) {
    captureException(error, {
      context: "releaseLoyaltyHoldForSession",
      sessionId,
    });
  }
};
