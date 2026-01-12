import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const createOrderFromSession = async (
  stripe: Stripe,
  session: Stripe.Checkout.Session
) => {
  if (!session.id) return;
  const userId = session.client_reference_id ?? "";
  if (!userId) return;

  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    include: { items: true },
  });
  if (existing) return;

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });
  const shipping = session.shipping_details;
  const address = shipping?.address;
  const subtotal = session.amount_subtotal ?? 0;
  const total = session.amount_total ?? 0;
  const shippingAmount = session.total_details?.amount_shipping ?? 0;
  const taxAmount = session.total_details?.amount_tax ?? 0;
  const currency = (session.currency ?? "eur").toUpperCase();

  await prisma.order.create({
    data: {
      userId,
      stripeSessionId: session.id,
      stripePaymentIntent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
      status: session.status ?? "open",
      paymentStatus: session.payment_status ?? "unpaid",
      currency,
      amountSubtotal: subtotal,
      amountTax: taxAmount,
      amountShipping: shippingAmount,
      amountTotal: total,
      customerEmail: session.customer_details?.email ?? undefined,
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
              currency: (item.currency ?? session.currency ?? "eur").toUpperCase(),
              imageUrl,
              productId: productId || undefined,
              variantId: variantId || undefined,
            };
          })
        ),
      },
    },
  });
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

  return NextResponse.json({ received: true });
}
