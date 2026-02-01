import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

type SessionWithDiscounts = Stripe.Checkout.Session & {
  discounts?: Array<{
    promotion_code?: Stripe.PromotionCode | string | null;
  }>;
};

const getDiscountDetails = (session: Stripe.Checkout.Session) => {
  const discountTotal = session.total_details?.amount_discount ?? 0;
  let discountCode = session.metadata?.discountCode ?? undefined;
  const sessionDiscount = (session as SessionWithDiscounts).discounts?.[0];
  const promotion = sessionDiscount?.promotion_code;
  if (promotion && typeof promotion !== "string" && promotion.code) {
    discountCode = promotion.code;
  }
  return { discountTotal, discountCode };
};

const formatAmountWithComma = (amountMinor: number, currency: string) => {
  const total = Math.round(amountMinor);
  const major = Math.floor(Math.abs(total) / 100);
  const minor = Math.abs(total) % 100;
  const sign = total < 0 ? "-" : "";
  return `${sign}${major},${minor.toString().padStart(2, "0")} ${currency}`;
};

const enrichItemsWithManufacturer = async <
  T extends { productId?: string | null }
>(
  items: T[] | null | undefined
): Promise<Array<T & { manufacturer: string | null }>> => {
  const safeItems = items ?? [];
  const productIds = Array.from(
    new Set(safeItems.map((item) => item.productId).filter(Boolean))
  ) as string[];
  if (productIds.length === 0) {
    return safeItems.map((item) => ({ ...item, manufacturer: null }));
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, manufacturer: true },
  });
  const manufacturerMap = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null])
  );

  return safeItems.map((item) => ({
    ...item,
    manufacturer: item.productId
      ? manufacturerMap.get(item.productId) ?? null
      : null,
  }));
};

const formatItemName = (name: string, manufacturer?: string | null) => {
  const defaultSuffix = / - Default( Title)?$/i;
  if (!defaultSuffix.test(name)) return name;
  const trimmed = manufacturer?.trim();
  if (trimmed) {
    return name.replace(defaultSuffix, ` - ${trimmed}`);
  }
  return name.replace(defaultSuffix, "");
};

type LineItemWithTax = Stripe.LineItem & {
  tax_amounts?: Array<{
    amount?: number | null;
    tax_rate?: Stripe.TaxRate | string | null;
  }>;
  amount_tax?: number | null;
};

const getLineItemTaxAmount = (item: LineItemWithTax) => {
  const taxAmounts = item.tax_amounts ?? [];
  if (taxAmounts.length > 0) {
    return taxAmounts.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  }
  const legacyAmount = (item as { amount_tax?: number }).amount_tax;
  return Number.isFinite(legacyAmount) ? legacyAmount : 0;
};

const getLineItemTaxRateBasisPoints = (item: LineItemWithTax) => {
  const taxAmounts = item.tax_amounts ?? [];
  if (taxAmounts.length === 0) return null;
  const rates = taxAmounts
    .map((entry) => {
      const rate = entry.tax_rate;
      if (!rate || typeof rate === "string") return null;
      const percent = rate.percentage;
      return Number.isFinite(percent) ? Math.round(percent * 100) : null;
    })
    .filter((rate): rate is number => rate !== null);
  if (rates.length === 0) return null;
  return rates.every((rate) => rate === rates[0]) ? rates[0] : null;
};

const getVariantCountsForSession = async (
  stripe: Stripe,
  sessionId: string
) => {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
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
  return variantCounts;
};

const releaseReservedInventory = async (
  stripe: Stripe,
  sessionId: string
) => {
  const variantCounts = await getVariantCountsForSession(stripe, sessionId);
  if (variantCounts.size === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const [variantId, qty] of variantCounts) {
      if (qty <= 0) continue;
      const updated = await tx.variantInventory.updateMany({
        where: { variantId, reserved: { gte: qty } },
        data: { reserved: { decrement: qty } },
      });
      if (updated.count === 0) {
        console.warn("[stripe webhook] Reservation not found to release.", {
          variantId,
          qty,
        });
      }
    }
  });
};

const sendTelegramMessage = async (text: string) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, status: 0 };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    // Ignore Telegram errors for webhook processing.
    return { ok: false, status: 0 };
  }
};

const createOrderFromSession = async (
  stripe: Stripe,
  session: Stripe.Checkout.Session
) => {
  const sessionId = session.id;
  if (!sessionId) {
    console.warn("[stripe webhook] Missing session id.");
    return;
  }
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["discounts", "discounts.promotion_code"],
  });
  if (checkoutSession.payment_status !== "paid") {
    console.info("[stripe webhook] Session not paid; skipping order creation.", {
      sessionId,
      paymentStatus: checkoutSession.payment_status,
    });
    return;
  }
  const userId = checkoutSession.client_reference_id ?? undefined;

  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    include: { items: true },
  });
  if (existing) {
    console.info("[stripe webhook] Order already exists for session.");
    return;
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
              taxAmount: getLineItemTaxAmount(item),
              taxRateBasisPoints: getLineItemTaxRateBasisPoints(item),
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
  console.info("[stripe webhook] Order created.", {
    id: created.id,
    amountTotal: created.amountTotal,
    currency: created.currency,
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
    const variants = await prisma.variant.findMany({
      where: { id: { in: Array.from(variantCounts.keys()) } },
      select: { id: true, productId: true },
    });
    const productByVariant = new Map(
      variants.map((variant) => [variant.id, variant.productId])
    );

    await prisma.$transaction(async (tx) => {
      for (const [variantId, qty] of variantCounts) {
        if (qty <= 0) continue;
        const updated = await tx.variantInventory.updateMany({
          where: { variantId, quantityOnHand: { gte: qty } },
          data: { quantityOnHand: { decrement: qty } },
        });
        if (updated.count === 0) {
          console.warn("[stripe webhook] Insufficient inventory for variant.", {
            variantId,
            qty,
          });
          continue;
        }
        const productId = productByVariant.get(variantId);
        if (!productId) {
          console.warn("[stripe webhook] Missing product for variant.", {
            variantId,
          });
          continue;
        }
        await tx.inventoryAdjustment.create({
          data: {
            variantId,
            productId,
            orderId: created.id,
            quantityDelta: -qty,
            reason: "checkout_paid",
          },
        });
      }
    });
  }

  try {
    if (created.customerEmail) {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const orderUrl = created.userId
        ? `${origin}/account/orders/${created.id}`
        : undefined;
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

  const orderLabel = created.id.slice(0, 8).toUpperCase();
  const orderNumber = created.orderNumber;
  const orderCurrency = created.currency;
  const customer = created.customerEmail ?? "unknown";
  const enrichedItems = await enrichItemsWithManufacturer(created.items);
  const itemSummary = enrichedItems
    .map((item) => {
      const qty = item.quantity ?? 0;
      const name = formatItemName(item.name, item.manufacturer);
      return qty > 0 ? `${qty}x ${name}` : "";
    })
    .filter(Boolean)
    .join("; ");
  let paymentMethod = "unknown";
  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;
  if (paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });
      const latestCharge = intent.latest_charge as Stripe.Charge | null;
      const chargeMethod = latestCharge?.payment_method_details?.type;
      paymentMethod =
        chargeMethod ??
        intent.payment_method_types?.[0] ??
        checkoutSession.payment_method_types?.[0] ??
        paymentMethod;
    } catch {
      paymentMethod = checkoutSession.payment_method_types?.[0] ?? paymentMethod;
    }
  } else {
    paymentMethod = checkoutSession.payment_method_types?.[0] ?? paymentMethod;
  }
  const orderTime = new Date(created.createdAt).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const formattedAmount = formatAmountWithComma(created.amountTotal, orderCurrency);
  const telegramEnvOk = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
  );
  console.info("[stripe webhook] Telegram env present:", telegramEnvOk);
  const telegramResult = await sendTelegramMessage(
    [
      "",
      `New order #${orderNumber} (${orderLabel})`,
      "",
      `Items: ${itemSummary || "unknown"}`,
      `Amount: ${formattedAmount}`,
      `Payment: ${paymentMethod}`,
      `Customer: ${customer}`,
      `Time: ${orderTime}`,
      "",
    ].join("\n")
  );
  if (!telegramResult.ok) {
    console.warn("[stripe webhook] Telegram send failed.", telegramResult);
  }
};

const beginWebhookEvent = async (eventId: string, type: string) => {
  try {
    await prisma.processedWebhookEvent.create({
      data: { eventId, type, status: "processing" },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.processedWebhookEvent.findUnique({
        where: { eventId },
      });
      if (existing?.status === "failed") {
        await prisma.processedWebhookEvent.update({
          where: { eventId },
          data: { status: "processing" },
        });
        return true;
      }
      return false;
    }
    throw error;
  }
};

const finalizeWebhookEvent = async (eventId: string) => {
  await prisma.processedWebhookEvent.update({
    where: { eventId },
    data: { status: "processed", processedAt: new Date() },
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
  console.info("[stripe webhook] Event received:", event.type);

  const eventId = event.id ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id." }, { status: 400 });
  }

  const shouldProcess = await beginWebhookEvent(eventId, event.type);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await createOrderFromSession(stripe, session);
    }
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await releaseReservedInventory(stripe, session.id ?? "");
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
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await releaseReservedInventory(stripe, session.id ?? "");
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
  } catch (error) {
    console.error("[stripe webhook] Handler failed.", {
      eventId,
      type: event.type,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
    });
    await prisma.processedWebhookEvent.update({
      where: { eventId },
      data: { status: "failed" },
    });
    return NextResponse.json(
      { error: "Webhook handling failed." },
      { status: 500 }
    );
  }

  await finalizeWebhookEvent(eventId);

  return NextResponse.json({ received: true });
}
