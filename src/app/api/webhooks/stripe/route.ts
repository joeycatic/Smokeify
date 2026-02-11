import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";

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

  const normalizeOptions = (value: unknown) => {
    if (!Array.isArray(value)) return [] as Array<{ name: string; value: string }>;
    return value
      .map((entry) => {
        const name = typeof entry?.name === "string" ? entry.name : "";
        const val = typeof entry?.value === "string" ? entry.value : "";
        return name && val ? { name, value: val } : null;
      })
      .filter(
        (entry): entry is { name: string; value: string } => Boolean(entry)
      );
  };

  const enrichItemsWithManufacturer = async <
    T extends {
      productId?: string | null;
      variantId?: string | null;
      options?: unknown;
    }
  >(
    items: T[] | null | undefined
  ): Promise<Array<T & { manufacturer: string | null; options: Array<{ name: string; value: string }> }>> => {
  const safeItems = items ?? [];
  const productIds = Array.from(
    new Set(safeItems.map((item) => item.productId).filter(Boolean))
  ) as string[];
  const variantIds = Array.from(
    new Set(safeItems.map((item) => item.variantId).filter(Boolean))
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

    return safeItems.map((item) => ({
      ...item,
      manufacturer: item.productId
        ? manufacturerMap.get(item.productId) ?? null
        : null,
    options: normalizeOptions(item.options).length
      ? normalizeOptions(item.options)
      : item.variantId
        ? optionsMap.get(item.variantId) ?? []
        : [],
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
      .filter(
        (entry): entry is { name: string; value: string } => Boolean(entry)
      );
  };

  const formatOptionsLabel = (options?: Array<{ name: string; value: string }>) => {
    if (!options?.length) return "";
    return options
      .map((opt) => `${opt.name}: ${opt.value}`)
      .filter(Boolean)
      .join(" · ");
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

type PaymentFeeConfig = {
  percentBasisPoints: number;
  fixedCents: number;
};

const PAYMENT_FEE_BY_METHOD: Record<string, PaymentFeeConfig> = {
  card: { percentBasisPoints: 150, fixedCents: 25 },
  link: { percentBasisPoints: 150, fixedCents: 25 },
  paypal: { percentBasisPoints: 299, fixedCents: 35 },
  klarna: { percentBasisPoints: 329, fixedCents: 35 },
  amazon_pay: { percentBasisPoints: 299, fixedCents: 35 },
};

const DEFAULT_PAYMENT_FEE: PaymentFeeConfig = {
  percentBasisPoints: 150,
  fixedCents: 25,
};

const HIGH_PRICE_SHIPPING_THRESHOLD_CENTS = 10_000;

type CostSnapshotItem = {
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  baseCostAmount: number;
};

const allocateByWeight = (total: number, weights: number[]) => {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const positiveWeights = weights.map((weight) => Math.max(0, weight));
  const weightSum = positiveWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const allocations = positiveWeights.map((weight) =>
    Math.floor((total * weight) / weightSum)
  );
  let remainder = total - allocations.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (remainder > 0) {
    if (positiveWeights[index] > 0) {
      allocations[index] += 1;
      remainder -= 1;
    }
    index = (index + 1) % allocations.length;
  }
  return allocations;
};

const applyPaymentFeesToCosts = (
  items: CostSnapshotItem[],
  shippingAmount: number,
  feeConfig: PaymentFeeConfig
) => {
  if (!items.length) {
    return [] as Array<
      CostSnapshotItem & { paymentFeeAmount: number; adjustedCostAmount: number }
    >;
  }

  const shippingEligibleWeights = items.map((item) =>
    item.unitAmount >= HIGH_PRICE_SHIPPING_THRESHOLD_CENTS ? item.totalAmount : 0
  );
  const shippingShares = allocateByWeight(
    Math.max(0, shippingAmount),
    shippingEligibleWeights
  );

  const percentageFees = items.map((item, index) => {
    const base = Math.max(0, item.totalAmount) + (shippingShares[index] ?? 0);
    return Math.max(
      0,
      Math.round((base * feeConfig.percentBasisPoints) / 10_000)
    );
  });

  const fixedShares = allocateByWeight(
    Math.max(0, feeConfig.fixedCents),
    items.map((item) => Math.max(0, item.totalAmount))
  );

  return items.map((item, index) => {
    const paymentFeeAmount = (percentageFees[index] ?? 0) + (fixedShares[index] ?? 0);
    const adjustedCostAmount = Math.max(0, item.baseCostAmount + paymentFeeAmount);
    return {
      ...item,
      paymentFeeAmount,
      adjustedCostAmount,
    };
  });
};

const resolvePaymentMethod = async (
  stripe: Stripe,
  checkoutSession: Stripe.Checkout.Session
) => {
  let paymentMethod = checkoutSession.payment_method_types?.[0] ?? "unknown";
  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;
  if (!paymentIntentId) return paymentMethod;

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

  return paymentMethod;
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
  const paymentMethod = await resolvePaymentMethod(stripe, checkoutSession);
  const paymentFeeConfig =
    PAYMENT_FEE_BY_METHOD[paymentMethod] ?? DEFAULT_PAYMENT_FEE;

  const orderItemDrafts = await Promise.all(
    (lineItems.data ?? []).map(async (item) => {
      const product = item.price?.product as Stripe.Product | null | undefined;
      const variantId =
        product?.metadata?.variantId || item.price?.metadata?.variantId || "";
      const selectedOptions = parseSelectedOptions(
        product?.metadata?.selectedOptions ||
          (item.price?.metadata?.selectedOptions as string | undefined) ||
          undefined
      );
      let name = item.description ?? "Item";
      let imageUrl = product?.images?.[0] ?? null;
      const productId =
        product?.metadata?.productId || item.price?.metadata?.productId || "";
      const quantity = Math.max(0, item.quantity ?? 0);
      const unitAmount = Math.max(0, item.price?.unit_amount ?? 0);
      const totalAmount = Math.max(0, item.amount_total ?? 0);
      let baseCostAmount = 0;

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
          baseCostAmount = Math.max(0, variant.costCents) * quantity;
        }
      }
      if (selectedOptions.length > 0) {
        name = `${name} (${formatOptionsLabel(selectedOptions)})`;
      }

      return {
        name,
        quantity,
        unitAmount,
        totalAmount,
        baseCostAmount,
        taxAmount: getLineItemTaxAmount(item),
        taxRateBasisPoints: getLineItemTaxRateBasisPoints(item),
        currency: (item.currency ?? checkoutSession.currency ?? "eur").toUpperCase(),
        imageUrl,
        productId: productId || undefined,
        variantId: variantId || undefined,
        options: selectedOptions.length > 0 ? selectedOptions : undefined,
      };
    })
  );

  const orderItemsWithFees = applyPaymentFeesToCosts(
    orderItemDrafts.map((item) => ({
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      totalAmount: item.totalAmount,
      baseCostAmount: item.baseCostAmount,
    })),
    shippingAmount,
    paymentFeeConfig
  );

  const orderItemCreates = orderItemDrafts.map((item, index) => {
    const snapshot = orderItemsWithFees[index];
    return {
      ...item,
      paymentFeeAmount: snapshot?.paymentFeeAmount ?? 0,
      adjustedCostAmount: snapshot?.adjustedCostAmount ?? item.baseCostAmount,
    };
  });

  const created = await prisma.order.create({
    data: {
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      stripeSessionId: sessionId,
      stripePaymentIntent:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id,
      paymentMethod,
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
        create: orderItemCreates,
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
      const invoiceUrl = buildInvoiceUrl(origin, created.id);
      const email = buildOrderEmail("confirmation", created, orderUrl, invoiceUrl ?? undefined);
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
  const itemsForEnrichment = created.items.map((item) => ({
    ...item,
    options: normalizeOptions(item.options),
  }));
  const enrichedItems = await enrichItemsWithManufacturer(itemsForEnrichment);
  const itemSummary = enrichedItems
    .map((item) => {
      const qty = item.quantity ?? 0;
      const name = formatItemName(item.name, item.manufacturer);
      const options =
        item.options && item.options.length > 0
          ? ` (${item.options
              .map((opt) => `${opt.name}: ${opt.value}`)
              .filter(Boolean)
              .join(" · ")})`
          : "";
      return qty > 0 ? `${qty}x ${name}${options}` : "";
    })
    .filter(Boolean)
    .join("; ");
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
