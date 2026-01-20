import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    items?: Array<{ id: string; quantity?: number }>;
    amount?: number;
  };

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.paymentStatus === "refunded") {
    return NextResponse.json(
      { error: "Order already refunded" },
      { status: 409 }
    );
  }
  if (!order.stripePaymentIntent) {
    return NextResponse.json(
      { error: "Missing payment intent" },
      { status: 400 }
    );
  }

  let refundAmount = 0;

  if (Array.isArray(body.items) && body.items.length > 0) {
    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    for (const requestItem of body.items) {
      const item = itemMap.get(requestItem.id);
      if (!item) continue;
      const requestedQty = Math.max(1, Number(requestItem.quantity ?? 1));
      const qty = Math.min(requestedQty, item.quantity);
      refundAmount += item.unitAmount * qty;
    }
  } else if (Number.isFinite(body.amount)) {
    refundAmount = Math.max(0, Math.floor(Number(body.amount)));
  } else {
    refundAmount = order.amountTotal - order.amountRefunded;
  }

  if (refundAmount <= 0) {
    return NextResponse.json(
      { error: "Refund amount must be greater than zero" },
      { status: 400 }
    );
  }

  const remaining = Math.max(0, order.amountTotal - order.amountRefunded);
  if (refundAmount > remaining) {
    return NextResponse.json(
      { error: "Refund amount exceeds remaining balance" },
      { status: 400 }
    );
  }

  await stripe.refunds.create({
    payment_intent: order.stripePaymentIntent,
    amount: refundAmount,
  });

  const newRefunded = order.amountRefunded + refundAmount;
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
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "order.refund",
    targetType: "order",
    targetId: order.id,
    summary: `Refunded ${refundAmount} of ${order.amountTotal}`,
    metadata: {
      refundAmount,
      totalAmount: order.amountTotal,
      newRefunded,
      fullyRefunded,
    },
  });

  if (updated.customerEmail) {
    try {
      const origin =
        request.headers.get("origin") ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";
      const orderUrl = `${origin}/account/orders/${updated.id}`;
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

  return NextResponse.json({ order: updated });
}
