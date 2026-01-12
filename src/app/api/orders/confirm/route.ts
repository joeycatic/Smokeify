import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
    sessionId?: string;
  };
  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    include: { items: true },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      order: {
        id: existing.id,
        createdAt: existing.createdAt,
        amountSubtotal: existing.amountSubtotal,
        amountShipping: existing.amountShipping,
        amountTotal: existing.amountTotal,
        currency: existing.currency,
        paymentStatus: existing.paymentStatus,
        status: existing.status,
        customerEmail: existing.customerEmail,
        shippingName: existing.shippingName,
        shippingLine1: existing.shippingLine1,
        shippingLine2: existing.shippingLine2,
        shippingPostalCode: existing.shippingPostalCode,
        shippingCity: existing.shippingCity,
        shippingCountry: existing.shippingCountry,
        items: existing.items,
      },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  if (!checkoutSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (checkoutSession.client_reference_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
  });

  const shipping = checkoutSession.shipping_details;
  const address = shipping?.address;
  const subtotal = checkoutSession.amount_subtotal ?? 0;
  const total = checkoutSession.amount_total ?? 0;
  const shippingAmount = checkoutSession.total_details?.amount_shipping ?? 0;
  const currency = (checkoutSession.currency ?? "eur").toUpperCase();

  const created = await prisma.order.create({
    data: {
      userId: session.user.id,
      stripeSessionId: sessionId,
      stripePaymentIntent:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id,
      status: checkoutSession.status ?? "open",
      paymentStatus: checkoutSession.payment_status ?? "unpaid",
      currency,
      amountSubtotal: subtotal,
      amountShipping: shippingAmount,
      amountTotal: total,
      customerEmail: checkoutSession.customer_details?.email ?? undefined,
      shippingName: shipping?.name ?? undefined,
      shippingLine1: address?.line1 ?? undefined,
      shippingLine2: address?.line2 ?? undefined,
      shippingPostalCode: address?.postal_code ?? undefined,
      shippingCity: address?.city ?? undefined,
      shippingCountry: address?.country ?? undefined,
      items: {
        create: (lineItems.data ?? []).map((item) => ({
          name: item.description ?? "Item",
          quantity: item.quantity ?? 0,
          unitAmount: item.price?.unit_amount ?? 0,
          totalAmount: item.amount_total ?? 0,
          currency: (item.currency ?? checkoutSession.currency ?? "eur").toUpperCase(),
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({
    ok: true,
    order: {
      id: created.id,
      createdAt: created.createdAt,
      amountSubtotal: created.amountSubtotal,
      amountShipping: created.amountShipping,
      amountTotal: created.amountTotal,
      currency: created.currency,
      paymentStatus: created.paymentStatus,
      status: created.status,
      customerEmail: created.customerEmail,
      shippingName: created.shippingName,
      shippingLine1: created.shippingLine1,
      shippingLine2: created.shippingLine2,
      shippingPostalCode: created.shippingPostalCode,
      shippingCity: created.shippingCity,
      shippingCountry: created.shippingCountry,
      items: created.items,
    },
  });
}
