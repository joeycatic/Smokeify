import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";

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
        amountTax: existing.amountTax,
        amountShipping: existing.amountShipping,
        amountDiscount: existing.amountDiscount,
        amountTotal: existing.amountTotal,
        currency: existing.currency,
        paymentStatus: existing.paymentStatus,
        status: existing.status,
        discountCode: existing.discountCode,
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

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["discounts", "discounts.promotion_code"],
  });
  if (!checkoutSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (checkoutSession.client_reference_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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
  const discountTotal = checkoutSession.total_details?.amount_discount ?? 0;
  let discountCode = checkoutSession.metadata?.discountCode ?? undefined;
  const sessionDiscount = checkoutSession.discounts?.[0];
  const promotion = sessionDiscount?.promotion_code;
  if (promotion && typeof promotion !== "string" && promotion.code) {
    discountCode = promotion.code;
  }
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
    include: { items: true },
  });

  try {
    const origin = request.headers.get("origin") ?? "http://localhost:3000";
    const orderUrl = `${origin}/account/orders/${created.id}`;
    const email = buildOrderEmail("confirmation", created, orderUrl);
    if (created.customerEmail) {
      await sendResendEmail({
        to: created.customerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    }
  } catch {
    // Don't block order creation on email failures.
  }

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

  return NextResponse.json({
    ok: true,
    order: {
      id: created.id,
      createdAt: created.createdAt,
      amountSubtotal: created.amountSubtotal,
      amountTax: created.amountTax,
      amountShipping: created.amountShipping,
      amountDiscount: created.amountDiscount,
      amountTotal: created.amountTotal,
      currency: created.currency,
      paymentStatus: created.paymentStatus,
      status: created.status,
      discountCode: created.discountCode,
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
