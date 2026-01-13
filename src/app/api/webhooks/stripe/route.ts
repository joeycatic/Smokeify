import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const getDiscountDetails = (session: Stripe.Checkout.Session) => {
  const discountTotal = session.total_details?.amount_discount ?? 0;
  let discountCode = session.metadata?.discountCode ?? undefined;
  const sessionDiscount = session.discounts?.[0];
  const promotion = sessionDiscount?.promotion_code;
  if (promotion && typeof promotion !== "string" && promotion.code) {
    discountCode = promotion.code;
  }
  return { discountTotal, discountCode };
};

const createOrderFromSession = async (
  stripe: Stripe,
  session: Stripe.Checkout.Session
) => {
  const sessionId = session.id;
  if (!sessionId) return;
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["discounts", "discounts.promotion_code"],
  });
  const userId = checkoutSession.client_reference_id ?? "";
  if (!userId) return;

  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    include: { items: true },
  });
  if (existing) return;

  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
  });
  const shipping = checkoutSession.shipping_details;
  const address = shipping?.address;
  const subtotal = checkoutSession.amount_subtotal ?? 0;
  const total = checkoutSession.amount_total ?? 0;
  const shippingAmount = checkoutSession.total_details?.amount_shipping ?? 0;
  const taxAmount = checkoutSession.total_details?.amount_tax ?? 0;
  const { discountTotal, discountCode } = getDiscountDetails(checkoutSession);
  const currency = (checkoutSession.currency ?? "eur").toUpperCase();

  const created = await prisma.order.create({
    data: {
      userId,
      stripeSessionId: sessionId,
      stripePaymentIntent:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id,
      status: checkoutSession.status ?? "open",
      paymentStatus: checkoutSession.payment_status ?? "unpaid",
      currency,
      amountSubtotal: subtotal,
      amountTax: taxAmount,
      amountShipping: shippingAmount,
      amountDiscount: discountTotal,
      amountTotal: total,
      discountCode: discountCode || undefined,
      customerEmail: checkoutSession.customer_details?.email ?? undefined,
      shippingName: shipping?.name ?? undefined,
      shippingLine1: address?.line1 ?? undefined,
      shippingLine2: address?.line2 ?? undefined,
      shippingPostalCode: address?.postal_code ?? undefined,
      shippingCity: address?.city ?? undefined,
      shippingCountry: address?.country ?? undefined,
      items: {
        create: await Promise.all(
          (lineItems.data ?? []).map(async (item) => {
            const product = item.price?.product as Stripe.Product | null | undefined;
            const variantId =
              product?.metadata?.variantId || item.price?.metadata?.variantId || "";
            let name = item.description ?? "Item";
            let imageUrl = product?.images?.[0] ?? null;
            const productId = product?.metadata?.productId || item.price?.metadata?.productId || "";

            if (variantId) {
              const variant = await prisma.variant.findUnique({
                where: { id: variantId },
                include: {
                  product: { include: { images: { orderBy: { position: "asc" } } } },
                },
              });
              if (variant) {
                const productName = variant.product.title;
                const variantTitle = variant.title?.trim();
                name =
                  variantTitle && variantTitle !== productName
                    ? `${productName} - ${variantTitle}`
                    : productName;
                imageUrl = variant.product.images[0]?.url ?? imageUrl;
              }
            }

            return {
              name,
              quantity: item.quantity ?? 0,
              unitAmount: item.price?.unit_amount ?? 0,
              totalAmount: item.amount_total ?? 0,
              currency: (item.currency ?? checkoutSession.currency ?? "eur").toUpperCase(),
              imageUrl,
              productId: productId || undefined,
              variantId: variantId || undefined,
            };
          })
        ),
      },
    },
  });

  const variantCounts = new Map<string, number>();
  for (const item of lineItems.data ?? []) {
    const product = item.price?.product as Stripe.Product | null | undefined;
    const variantId =
      product?.metadata?.variantId || item.price?.metadata?.variantId || "";
    if (!variantId) continue;
    const qty = Math.max(0, item.quantity ?? 0);
    if (!qty) continue;
    variantCounts.set(variantId, (variantCounts.get(variantId) ?? 0) + qty);
  }

  if (variantCounts.size > 0) {
    await prisma.$transaction(async (tx) => {
      for (const [variantId, qty] of variantCounts) {
        const inventory = await tx.variantInventory.findUnique({
          where: { variantId },
        });
        if (!inventory) continue;
        const nextQuantity = Math.max(0, inventory.quantityOnHand - qty);
        await tx.variantInventory.update({
          where: { variantId },
          data: { quantityOnHand: nextQuantity },
        });
      }
    });
  }

  try {
    if (created.customerEmail) {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const orderUrl = `${origin}/account/orders/${created.id}`;
      const email = buildOrderEmail("confirmation", created, orderUrl);
      await sendResendEmail({
        to: created.customerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    }
  } catch {
    // Ignore email errors for webhook processing.
  }
};

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook secret not configured." },
      { status: 500 }
    );
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    await createOrderFromSession(stripe, session);
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (paymentIntent) {
      await prisma.order.updateMany({
        where: { stripePaymentIntent: paymentIntent },
        data: { status: "failed", paymentStatus: "failed" },
      });
    }
  }
  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    await prisma.order.updateMany({
      where: { stripePaymentIntent: intent.id },
      data: { status: "failed", paymentStatus: "failed" },
    });
  }
  if (event.type === "charge.refunded") {
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
      }
    }
  }
  if (event.type === "payment_intent.refunded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    await prisma.order.updateMany({
      where: { stripePaymentIntent: intent.id },
      data: {
        amountRefunded: intent.amount_received ?? 0,
        status: "refunded",
        paymentStatus: "refunded",
      },
    });
  }

  return NextResponse.json({ received: true });
}
