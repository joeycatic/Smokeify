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

  return NextResponse.json(
    {
      ok: true,
      pending: true,
      paymentStatus: checkoutSession.payment_status ?? "unpaid",
    },
    { status: 202 }
  );
}
