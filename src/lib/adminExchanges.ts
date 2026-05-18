import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id: string;
  email: string | null;
};

function scaleLineAmount(amount: number, originalQuantity: number, nextQuantity: number) {
  if (originalQuantity <= 0 || nextQuantity <= 0 || amount <= 0) {
    return 0;
  }

  return Math.round((amount * nextQuantity) / originalQuantity);
}

export async function createAdminExchangeOrder({
  returnRequestId,
  actor,
}: {
  returnRequestId: string;
  actor: AdminActor;
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: true,
        items: {
          include: {
            orderItem: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error("Return request not found");
    }

    if (request.exchangeOrderId) {
      throw new Error("Exchange order already exists");
    }

    if (request.items.length === 0) {
      throw new Error("Return request has no items");
    }

    const variantQuantities = new Map<string, number>();
    for (const item of request.items) {
      const variantId = item.orderItem.variantId;
      if (!variantId) {
        throw new Error(`Exchange item ${item.orderItem.name} is missing a variant.`);
      }
      variantQuantities.set(variantId, (variantQuantities.get(variantId) ?? 0) + item.quantity);
    }

    const variants = await tx.variant.findMany({
      where: { id: { in: Array.from(variantQuantities.keys()) } },
      select: {
        id: true,
        productId: true,
      },
    });
    const productIdByVariantId = new Map(
      variants.map((variant) => [variant.id, variant.productId])
    );

    for (const [variantId, quantity] of variantQuantities) {
      const productId = productIdByVariantId.get(variantId);
      if (!productId) {
        throw new Error("Exchange item variant not found.");
      }

      const updatedInventory = await tx.$executeRaw`
        UPDATE "VariantInventory"
        SET "quantityOnHand" = "quantityOnHand" - ${quantity}
        WHERE "variantId" = ${variantId}
          AND "quantityOnHand" >= ${quantity}
      `;
      if (updatedInventory === 0) {
        throw new Error("Insufficient inventory for requested exchange items.");
      }

      await tx.inventoryAdjustment.create({
        data: {
          variantId,
          productId,
          quantityDelta: -quantity,
          reason: "return_exchange",
        },
      });
    }

    const exchangeOrder = await tx.order.create({
      data: {
        stripeSessionId: `exchange_${request.id}`,
        userId: request.order.userId,
        stripePaymentIntent: null,
        sourceStorefront: request.order.sourceStorefront,
        sourceHost: request.order.sourceHost,
        sourceOrigin: request.order.sourceOrigin,
        paymentMethod: request.order.paymentMethod ?? "exchange",
        status: "exchange_pending_fulfillment",
        paymentStatus: "exchange",
        currency: request.order.currency,
        amountSubtotal: 0,
        amountTax: 0,
        amountShipping: 0,
        amountDiscount: 0,
        amountTotal: 0,
        customerEmail: request.order.customerEmail,
        shippingName: request.order.shippingName,
        shippingLine1: request.order.shippingLine1,
        shippingLine2: request.order.shippingLine2,
        shippingPostalCode: request.order.shippingPostalCode,
        shippingCity: request.order.shippingCity,
        shippingCountry: request.order.shippingCountry,
        items: {
          create: request.items.map((item) => ({
            name: item.orderItem.name,
            quantity: item.quantity,
            unitAmount: 0,
            totalAmount: 0,
            baseCostAmount: scaleLineAmount(
              item.orderItem.baseCostAmount,
              item.orderItem.quantity,
              item.quantity
            ),
            paymentFeeAmount: 0,
            adjustedCostAmount: scaleLineAmount(
              item.orderItem.adjustedCostAmount,
              item.orderItem.quantity,
              item.quantity
            ),
            taxAmount: 0,
            taxRateBasisPoints: item.orderItem.taxRateBasisPoints,
            currency: request.order.currency,
            imageUrl: item.orderItem.imageUrl,
            productId: item.orderItem.productId,
            variantId: item.orderItem.variantId,
            options:
              item.orderItem.options === null
                ? Prisma.JsonNull
                : (item.orderItem.options as Prisma.InputJsonValue),
          })),
        },
      },
      select: {
        id: true,
        orderNumber: true,
      },
    });

    await tx.returnRequest.update({
      where: { id: request.id },
      data: {
        exchangeOrderId: exchangeOrder.id,
        exchangeApprovedAt: new Date(),
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "return.exchange_order_created",
        targetType: "order",
        targetId: exchangeOrder.id,
        summary: `Created exchange order #${exchangeOrder.orderNumber}`,
        metadata: {
          returnRequestId: request.id,
          originalOrderId: request.orderId,
          exchangeOrderId: exchangeOrder.id,
          exchangeOrderNumber: exchangeOrder.orderNumber,
        },
      },
    });

    return exchangeOrder;
  });
}
