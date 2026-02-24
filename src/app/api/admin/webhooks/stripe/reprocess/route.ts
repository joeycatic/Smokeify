import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import {
  createOrderFromSession,
  getStripe,
  releaseReservedInventory,
} from "@/app/api/webhooks/stripe/route";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-webhooks-reprocess:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    eventId?: string;
  };
  const eventId = body.eventId?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id." }, { status: 400 });
  }

  const tracked = await prisma.processedWebhookEvent.findUnique({
    where: { eventId },
  });
  if (!tracked) {
    return NextResponse.json(
      { error: "Webhook event not found in processedWebhookEvents." },
      { status: 404 }
    );
  }
  if (tracked.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed webhook events can be reprocessed." },
      { status: 400 }
    );
  }

  const event = await stripe.events.retrieve(eventId);
  if (!event) {
    return NextResponse.json({ error: "Stripe event not found." }, { status: 404 });
  }

  await prisma.processedWebhookEvent.update({
    where: { eventId },
    data: { status: "processing" },
  });

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      await createOrderFromSession(stripe, checkoutSession, request);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      await releaseReservedInventory(stripe, checkoutSession.id ?? "");
      const paymentIntent =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id;
      if (paymentIntent) {
        const orders = await prisma.order.findMany({
          where: { stripePaymentIntent: paymentIntent },
          select: { id: true, status: true, paymentStatus: true },
        });
        await prisma.order.updateMany({
          where: { stripePaymentIntent: paymentIntent },
          data: { status: "failed", paymentStatus: "failed" },
        });
        await Promise.all(
          orders.map((order) =>
            logOrderTimelineEvent({
              actor: { id: session.user.id, email: session.user.email ?? null },
              orderId: order.id,
              action: "order.lifecycle.payment_failed",
              summary:
                "Payment failed (reprocess: checkout.session.async_payment_failed)",
              metadata: {
                source: "admin.webhooks.reprocess",
                event: "checkout.session.async_payment_failed",
                eventId,
                previousStatus: order.status,
                nextStatus: "failed",
                previousPaymentStatus: order.paymentStatus,
                nextPaymentStatus: "failed",
                paymentIntent,
              },
            })
          )
        );
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orders = await prisma.order.findMany({
        where: { stripePaymentIntent: intent.id },
        select: { id: true, status: true, paymentStatus: true },
      });
      await prisma.order.updateMany({
        where: { stripePaymentIntent: intent.id },
        data: { status: "failed", paymentStatus: "failed" },
      });
      await Promise.all(
        orders.map((order) =>
          logOrderTimelineEvent({
            actor: { id: session.user.id, email: session.user.email ?? null },
            orderId: order.id,
            action: "order.lifecycle.payment_failed",
            summary: "Payment failed (reprocess: payment_intent.payment_failed)",
            metadata: {
              source: "admin.webhooks.reprocess",
              event: "payment_intent.payment_failed",
              eventId,
              previousStatus: order.status,
              nextStatus: "failed",
              previousPaymentStatus: order.paymentStatus,
              nextPaymentStatus: "failed",
              paymentIntent: intent.id,
            },
          })
        )
      );
    } else if (event.type === "checkout.session.expired") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      await releaseReservedInventory(stripe, checkoutSession.id ?? "");
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntent =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (paymentIntent) {
        const order = await prisma.order.findFirst({
          where: { stripePaymentIntent: paymentIntent },
        });
        if (order) {
          const refunded = charge.amount_refunded ?? 0;
          const fullyRefunded = refunded >= order.amountTotal;
          await prisma.order.update({
            where: { id: order.id },
            data: {
              amountRefunded: refunded,
              status: fullyRefunded ? "refunded" : order.status,
              paymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
            },
          });
          await logOrderTimelineEvent({
            actor: { id: session.user.id, email: session.user.email ?? null },
            orderId: order.id,
            action: "order.lifecycle.refund_updated",
            summary: `Refund updated (reprocess): ${order.amountRefunded} -> ${refunded}`,
            metadata: {
              source: "admin.webhooks.reprocess",
              event: "charge.refunded",
              eventId,
              previousAmountRefunded: order.amountRefunded,
              nextAmountRefunded: refunded,
              previousStatus: order.status,
              nextStatus: fullyRefunded ? "refunded" : order.status,
              previousPaymentStatus: order.paymentStatus,
              nextPaymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
              chargeId: charge.id,
            },
          });
        }
      }
    } else {
      await prisma.processedWebhookEvent.update({
        where: { eventId },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { error: `Unsupported event type for manual reprocess: ${event.type}` },
        { status: 400 }
      );
    }
  } catch (error) {
    await prisma.processedWebhookEvent.update({
      where: { eventId },
      data: { status: "failed" },
    });
    const message =
      error instanceof Error ? error.message : "Reprocess failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await prisma.processedWebhookEvent.update({
    where: { eventId },
    data: { status: "processed", processedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
