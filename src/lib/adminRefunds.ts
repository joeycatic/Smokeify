import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildOrderViewUrl } from "@/lib/orderViewLink";
import {
  getStorefrontOrigin,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import { parseStorefront } from "@/lib/storefronts";
import {
  getVivaSourceCode,
  normalizeVivaStatus,
  refundVivaTransaction,
  retrieveVivaTransactionByOrderCode,
  vivaAmountMatches,
} from "@/lib/viva";

type AdminActor = {
  id: string;
  email: string | null;
};

const orderCodeMatches = (returnedOrderCode: unknown, expectedOrderCode: string) => {
  const normalized = String(returnedOrderCode ?? "").trim();
  if (!normalized) return true;
  if (normalized === expectedOrderCode) return true;
  return normalized.length >= 10 && expectedOrderCode.startsWith(normalized);
};

async function resolveVivaTransactionId(order: {
  amountTotal: number;
  id: string;
  paymentOrderCode: string | null;
  paymentTransactionId: string | null;
}) {
  if (order.paymentTransactionId) return order.paymentTransactionId;
  if (!order.paymentOrderCode) {
    throw new Error("Missing Viva transaction id");
  }

  const transaction = await retrieveVivaTransactionByOrderCode(order.paymentOrderCode);
  const transactionId = transaction?.transactionId?.trim();
  const status = normalizeVivaStatus(transaction?.statusId);
  const matchesOrderCode = orderCodeMatches(transaction?.orderCode, order.paymentOrderCode);
  const matchesAmount = vivaAmountMatches(transaction?.amount, order.amountTotal);

  if (!transactionId || status !== "paid" || !matchesOrderCode || !matchesAmount) {
    throw new Error("Missing Viva transaction id");
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentTransactionId: transactionId },
  });
  await prisma.checkoutPaymentDraft.updateMany({
    where: {
      paymentOrderCode: order.paymentOrderCode,
      paymentTransactionId: null,
    },
    data: { paymentTransactionId: transactionId },
  });

  return transactionId;
}

export async function refundAdminOrder(input: {
  orderId: string;
  refundAmount: number;
  includeShipping?: boolean;
  shippingRefundAmount?: number;
  reason: string;
  actor: AdminActor;
  source: string;
  origin?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });
  if (!order) {
    throw new Error("Order not found");
  }
  if (order.paymentStatus === "refunded") {
    throw new Error("Order already refunded");
  }
  const paymentProvider = order.paymentProvider ?? "viva";
  if (paymentProvider !== "viva") {
    throw new Error("Only Viva refunds are supported from the admin console.");
  }
  const paymentTransactionId = await resolveVivaTransactionId(order);

  const remaining = Math.max(0, order.amountTotal - order.amountRefunded);
  if (input.refundAmount <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }
  if (input.refundAmount > remaining) {
    throw new Error("Refund amount exceeds remaining balance");
  }

  await refundVivaTransaction({
    amount: input.refundAmount,
    sourceCode: getVivaSourceCode(),
    transactionId: paymentTransactionId,
  });

  const newRefunded = order.amountRefunded + input.refundAmount;
  const fullyRefunded = newRefunded >= order.amountTotal;

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      amountRefunded: newRefunded,
      status: fullyRefunded ? "refunded" : order.status,
      paymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
    },
    include: { items: true },
  });

  await logAdminAction({
    actor: input.actor,
    action: "order.refund",
    targetType: "order",
    targetId: order.id,
    summary: `Refunded ${input.refundAmount} of ${order.amountTotal}${
      (input.shippingRefundAmount ?? 0) > 0
        ? ` (incl. ${input.shippingRefundAmount} shipping)`
        : ""
    }`,
    metadata: {
      includeShipping: input.includeShipping === true,
      shippingRefundAmount: input.shippingRefundAmount ?? 0,
      refundAmount: input.refundAmount,
      reason: input.reason,
      totalAmount: order.amountTotal,
      newRefunded,
      fullyRefunded,
      source: input.source,
    },
  });

  await logOrderTimelineEvent({
    actor: input.actor,
    orderId: order.id,
    action: "order.lifecycle.refund_updated",
    summary: `Refund updated: ${order.amountRefunded} -> ${newRefunded} (${fullyRefunded ? "full" : "partial"})`,
    metadata: {
      includeShipping: input.includeShipping === true,
      shippingRefundAmount: input.shippingRefundAmount ?? 0,
      refundAmount: input.refundAmount,
      reason: input.reason,
      previousAmountRefunded: order.amountRefunded,
      nextAmountRefunded: newRefunded,
      previousPaymentStatus: order.paymentStatus,
      nextPaymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
      previousStatus: order.status,
      nextStatus: fullyRefunded ? "refunded" : order.status,
      source: input.source,
    },
  });

  if (updated.customerEmail && input.origin) {
    try {
      const storefront = resolveStorefrontEmailBrand(
        parseStorefront(updated.sourceStorefront ?? null),
        [updated.sourceOrigin, updated.sourceHost, input.origin],
      );
      const origin = getStorefrontOrigin(
        storefront,
        updated.sourceOrigin ?? input.origin,
      );
      const guestOrderUrl = buildOrderViewUrl(origin, updated.id);
      const orderUrl = updated.userId
        ? `${origin}/account/orders/${updated.id}`
        : guestOrderUrl ?? undefined;
      const email = buildOrderEmail("refund", updated, orderUrl, undefined, {
        storefront,
        fallbackOrigin: origin,
      });
      await sendResendEmail({
        to: updated.customerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch {
      // Ignore email errors for refund processing.
    }
  }

  return {
    order,
    updated,
    newRefunded,
    fullyRefunded,
  };
}
