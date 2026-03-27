import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildOrderViewUrl } from "@/lib/orderViewLink";

type AdminActor = {
  id: string;
  email: string | null;
};

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

export async function refundAdminOrder(input: {
  orderId: string;
  refundAmount: number;
  includeShipping?: boolean;
  shippingRefundAmount?: number;
  actor: AdminActor;
  source: string;
  origin?: string;
}) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe secret key not configured.");
  }

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
  if (!order.stripePaymentIntent) {
    throw new Error("Missing payment intent");
  }

  const remaining = Math.max(0, order.amountTotal - order.amountRefunded);
  if (input.refundAmount <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }
  if (input.refundAmount > remaining) {
    throw new Error("Refund amount exceeds remaining balance");
  }

  await stripe.refunds.create({
    payment_intent: order.stripePaymentIntent,
    amount: input.refundAmount,
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
      const guestOrderUrl = buildOrderViewUrl(input.origin, updated.id);
      const orderUrl = updated.userId
        ? `${input.origin}/account/orders/${updated.id}`
        : guestOrderUrl ?? undefined;
      const email = buildOrderEmail("refund", updated, orderUrl);
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
