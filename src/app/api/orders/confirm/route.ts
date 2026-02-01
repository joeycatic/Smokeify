import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const enrichItemsWithManufacturer = async <
  T extends { productId?: string | null; variantId?: string | null }
>(
  items: T[]
): Promise<Array<T & { manufacturer: string | null; options: Array<{ name: string; value: string }> }>> => {
  const productIds = Array.from(
    new Set(items.map((item) => item.productId).filter(Boolean))
  ) as string[];
  const variantIds = Array.from(
    new Set(items.map((item) => item.variantId).filter(Boolean))
  ) as string[];

  const products = await prisma.product.findMany({
    where: productIds.length ? { id: { in: productIds } } : { id: "__none__" },
    select: { id: true, manufacturer: true },
  });
  const manufacturerMap = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null])
  );

  const options = await prisma.variantOption.findMany({
    where: variantIds.length ? { variantId: { in: variantIds } } : { id: "__none__" },
    select: { variantId: true, name: true, value: true },
  });
  const optionsMap = new Map<string, Array<{ name: string; value: string }>>();
  options.forEach((opt) => {
    const list = optionsMap.get(opt.variantId) ?? [];
    list.push({ name: opt.name, value: opt.value });
    optionsMap.set(opt.variantId, list);
  });

  return items.map((item) => ({
    ...item,
    manufacturer: item.productId
      ? manufacturerMap.get(item.productId) ?? null
      : null,
    options: item.variantId ? optionsMap.get(item.variantId) ?? [] : [],
  }));
};

const parseSelectedOptions = (value?: string | null) => {
  if (!value) return [] as Array<{ name: string; value: string }>;
  return value
    .split("&")
    .map((pair) => {
      const [rawName, rawValue] = pair.split("=");
      const name = decodeURIComponent(rawName ?? "").trim();
      const val = decodeURIComponent(rawValue ?? "").trim();
      if (!name || !val) return null;
      return { name, value: val };
    })
    .filter((entry): entry is { name: string; value: string } => Boolean(entry));
};

const formatOptionsLabel = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `order-confirm:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
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
    const items = await enrichItemsWithManufacturer(
      existing.items.map((item) => ({
        ...item,
        options: Array.isArray(item.options) ? item.options : [],
      }))
    );
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
        const variantId =
          product?.metadata?.variantId || item.price?.metadata?.variantId || null;
        const selectedOptions = parseSelectedOptions(
          product?.metadata?.selectedOptions ||
            (item.price?.metadata?.selectedOptions as string | undefined) ||
            undefined
        );
        const baseName = item.description ?? "Item";
        const name = selectedOptions.length
          ? `${baseName} (${formatOptionsLabel(selectedOptions)})`
          : baseName;
        return {
          id: item.id,
          name,
          quantity: item.quantity ?? 0,
          unitAmount: item.price?.unit_amount ?? 0,
          totalAmount: item.amount_total ?? 0,
          currency: (item.currency ?? checkoutSession.currency ?? "eur").toUpperCase(),
          imageUrl,
          productId,
          variantId,
          options: selectedOptions,
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
