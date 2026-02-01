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

const enrichItemsWithManufacturer = async <
  T extends { productId: string | null }
>(
  items: T[]
): Promise<Array<T & { manufacturer: string | null }>> => {
  const productIds = Array.from(
    new Set(items.map((item) => item.productId).filter(Boolean))
  ) as string[];
  if (productIds.length === 0) {
    return items.map((item) => ({ ...item, manufacturer: null }));
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, manufacturer: true },
  });
  const manufacturerMap = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null])
  );

  return items.map((item) => ({
    ...item,
    manufacturer: item.productId
      ? manufacturerMap.get(item.productId) ?? null
      : null,
  }));
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

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
    if (existing.userId && existing.userId !== session?.user?.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const items = await enrichItemsWithManufacturer(existing.items);
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
        items,
      },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  if (!checkoutSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (checkoutSession.client_reference_id) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (checkoutSession.client_reference_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  if (checkoutSession.payment_status === "paid") {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ["data.price.product"],
    });
    const items = await enrichItemsWithManufacturer(
      (lineItems.data ?? []).map((item) => {
        const product = item.price?.product as Stripe.Product | null | undefined;
        const imageUrl = product?.images?.[0] ?? null;
        const productId =
          product?.metadata?.productId || item.price?.metadata?.productId || null;
        return {
          id: item.id,
          name: item.description ?? "Item",
          quantity: item.quantity ?? 0,
          unitAmount: item.price?.unit_amount ?? 0,
          totalAmount: item.amount_total ?? 0,
          currency: (item.currency ?? checkoutSession.currency ?? "eur").toUpperCase(),
          imageUrl,
          productId,
        };
      })
    );
    return NextResponse.json({
      ok: true,
      pending: true,
      order: {
        id: sessionId,
        createdAt: checkoutSession.created
          ? new Date(checkoutSession.created * 1000).toISOString()
          : new Date().toISOString(),
        amountSubtotal: checkoutSession.amount_subtotal ?? 0,
        amountTax: checkoutSession.total_details?.amount_tax ?? 0,
        amountShipping: checkoutSession.total_details?.amount_shipping ?? 0,
        amountDiscount: checkoutSession.total_details?.amount_discount ?? 0,
        amountTotal: checkoutSession.amount_total ?? 0,
        currency: (checkoutSession.currency ?? "eur").toUpperCase(),
        paymentStatus: checkoutSession.payment_status ?? "paid",
        status: checkoutSession.status ?? "open",
        discountCode: checkoutSession.metadata?.discountCode ?? null,
        customerEmail: checkoutSession.customer_details?.email ?? null,
        shippingName: checkoutSession.shipping_details?.name ?? null,
        shippingLine1: checkoutSession.shipping_details?.address?.line1 ?? null,
        shippingLine2: checkoutSession.shipping_details?.address?.line2 ?? null,
        shippingPostalCode:
          checkoutSession.shipping_details?.address?.postal_code ?? null,
        shippingCity: checkoutSession.shipping_details?.address?.city ?? null,
        shippingCountry:
          checkoutSession.shipping_details?.address?.country ?? null,
        items,
        provisional: true,
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      pending: true,
      paymentStatus: checkoutSession.payment_status ?? "unpaid",
    },
    { status: 202 }
  );
}
