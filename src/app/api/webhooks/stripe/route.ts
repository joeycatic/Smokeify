import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { buildReceiptUrl } from "@/lib/receiptLink";
import { buildOrderViewUrl } from "@/lib/orderViewLink";
import { getAppOrigin } from "@/lib/appOrigin";
import { captureException } from "@/lib/sentry";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import {
  PAYMENT_FEE_BY_METHOD,
  DEFAULT_PAYMENT_FEE,
  applyPaymentFeesToCosts,
} from "@/lib/paymentFees";
import {
  buildLoyaltyHoldReason,
  buildLoyaltyRedeemedReason,
  buildLoyaltyReleasedReason,
  getLoyaltyPointsPerEuro,
} from "@/lib/loyalty";
import {
  DEFAULT_VAT_RATE_BASIS_POINTS,
  calculateVatComponentsFromGross,
  canApplyDefaultVatFallback,
} from "@/lib/vat";
import { formatOrderSourceLabel, resolveOrderSourceFromMetadata } from "@/lib/orderSource";
import {
  getStorefrontOrigin,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import { parseStorefront } from "@/lib/storefronts";
import { recordAutomationEvent } from "@/lib/automationEvents";

export const runtime = "nodejs";

export const getStripe = () => {
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

const awardLoyaltyPointsForOrder = async (order: {
  id: string;
  userId: string | null;
  amountSubtotal: number;
  amountDiscount: number;
  amountShipping: number;
  currency: string;
}) => {
  if (!order.userId) return 0;
  if (order.currency.toUpperCase() !== "EUR") return 0;

  const netSpendCents = Math.max(
    0,
    order.amountSubtotal - Math.max(0, order.amountDiscount)
  );
  const pointsPerEuro = getLoyaltyPointsPerEuro();
  const points = Math.max(0, Math.floor(netSpendCents / 100) * pointsPerEuro);
  if (points <= 0) return 0;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "LoyaltyPointTransaction"
        WHERE "orderId" = ${order.id}
        LIMIT 1
      `;
      if (existing.length > 0) return;

      await tx.$executeRaw`
        INSERT INTO "LoyaltyPointTransaction" (
          id,
          "userId",
          "orderId",
          "pointsDelta",
          reason,
          metadata,
          "createdAt"
        )
        VALUES (
          ${crypto.randomUUID()},
          ${order.userId as string},
          ${order.id},
          ${points},
          ${"order_paid"},
          ${{
            amountSubtotal: order.amountSubtotal,
            amountDiscount: order.amountDiscount,
            amountShipping: order.amountShipping,
          }},
          NOW()
        )
      `;
      await tx.$executeRaw`
        UPDATE "User"
        SET "loyaltyPointsBalance" = "loyaltyPointsBalance" + ${points}
        WHERE id = ${order.userId as string}
      `;
    });
  } catch (error) {
    // Don't fail webhook on loyalty accounting issues.
    captureException(error, { context: "awardLoyaltyPointsForOrder", orderId: order.id });
    return 0;
  }

  return points;
};

const consumeLoyaltyHoldForSession = async (sessionId: string, orderId: string) => {
  const holdReason = buildLoyaltyHoldReason(sessionId);
  const redeemedReason = buildLoyaltyRedeemedReason(sessionId);
  try {
    await prisma.loyaltyPointTransaction.updateMany({
      where: { reason: holdReason },
      data: {
        reason: redeemedReason,
        metadata: {
          sessionId,
          orderId,
          status: "redeemed",
        },
      },
    });
  } catch (error) {
    captureException(error, { context: "consumeLoyaltyHoldForSession", sessionId, orderId });
  }
};

const releaseLoyaltyHoldForSession = async (sessionId: string) => {
  const holdReason = buildLoyaltyHoldReason(sessionId);
  const releasedReason = buildLoyaltyReleasedReason(sessionId);
  try {
    await prisma.$transaction(async (tx) => {
      const holds = await tx.loyaltyPointTransaction.findMany({
        where: { reason: holdReason },
        select: { id: true, userId: true, pointsDelta: true },
      });
      if (holds.length === 0) return;

      for (const hold of holds) {
        const releasedPoints = Math.max(0, -hold.pointsDelta);
        if (releasedPoints > 0) {
          await tx.user.update({
            where: { id: hold.userId },
            data: { loyaltyPointsBalance: { increment: releasedPoints } },
          });
        }
        await tx.loyaltyPointTransaction.update({
          where: { id: hold.id },
          data: {
            reason: releasedReason,
            metadata: {
              sessionId,
              releasedPoints,
              status: "released",
            },
          },
        });
      }
    });
  } catch (error) {
    captureException(error, { context: "releaseLoyaltyHoldForSession", sessionId });
  }
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
  } catch (err) {
    captureException(err, { context: "resolvePaymentMethod", paymentIntentId });
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

const listAllCheckoutSessionLineItems = async (
  stripe: Stripe,
  sessionId: string
) => {
  const items: Stripe.LineItem[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.price.product"],
    });
    items.push(...(page.data ?? []));
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }

  return items;
};

const getVariantCountsForSession = async (
  stripe: Stripe,
  sessionId: string
) => {
  const lineItems = await listAllCheckoutSessionLineItems(stripe, sessionId);
  const variantCounts = new Map<string, number>();
  for (const item of lineItems) {
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

export const releaseReservedInventory = async (
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

export const createOrderFromSession = async (
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  request: Request
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

  const lineItems = await listAllCheckoutSessionLineItems(stripe, sessionId);
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
  const orderSource = resolveOrderSourceFromMetadata(checkoutSession.metadata ?? {}, [
    checkoutSession.success_url,
    checkoutSession.cancel_url,
    checkoutSession.return_url,
    checkoutSession.url,
  ]);

  const variantIds = Array.from(
    new Set(
      lineItems
        .map((item) => {
          const product = item.price?.product as Stripe.Product | null | undefined;
          return product?.metadata?.variantId || item.price?.metadata?.variantId || "";
        })
        .filter(Boolean)
    )
  );
  const variantsById = new Map(
    (
      await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        include: {
          product: { include: { images: { orderBy: { position: "asc" } } } },
        },
      })
    ).map((variant) => [variant.id, variant])
  );

  const orderItemDrafts = await Promise.all(
    lineItems.map(async (item) => {
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
        const variant = variantsById.get(variantId);
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

  const shouldApplyVatFallback =
    canApplyDefaultVatFallback(currency, address?.country ?? null) &&
    taxAmount <= 0 &&
    orderItemDrafts.every((item) => (item.taxAmount ?? 0) <= 0);
  const resolvedTaxAmount = shouldApplyVatFallback
    ? calculateVatComponentsFromGross(total).vatAmount
    : taxAmount;
  const orderItemDraftsWithResolvedTax = shouldApplyVatFallback
    ? orderItemDrafts.map((item) => ({
        ...item,
        taxAmount: calculateVatComponentsFromGross(item.totalAmount).vatAmount,
        taxRateBasisPoints: DEFAULT_VAT_RATE_BASIS_POINTS,
      }))
    : orderItemDrafts;

  const orderItemsWithFees = applyPaymentFeesToCosts(
    orderItemDraftsWithResolvedTax.map((item) => ({
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      totalAmount: item.totalAmount,
      baseCostAmount: item.baseCostAmount,
    })),
    shippingAmount,
    paymentFeeConfig
  );

  const orderItemCreates = orderItemDraftsWithResolvedTax.map((item, index) => {
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
      sourceStorefront: orderSource.sourceStorefront ?? undefined,
      sourceHost: orderSource.sourceHost ?? undefined,
      sourceOrigin: orderSource.sourceOrigin ?? undefined,
      paymentMethod,
      status: checkoutSession.status ?? "open",
      paymentStatus: checkoutSession.payment_status ?? "unpaid",
      currency,
      amountSubtotal: subtotal,
      amountTax: resolvedTaxAmount,
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
  await logOrderTimelineEvent({
    orderId: created.id,
    action: "order.lifecycle.created",
    summary: `Order created from Stripe session ${sessionId}`,
    metadata: {
      source: "stripe.webhook",
      event: "checkout.session.completed",
      sessionId,
      paymentIntentId:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id ?? null,
      status: created.status,
      paymentStatus: created.paymentStatus,
    },
  });
  await recordAutomationEvent({
    eventType: "order.paid",
    aggregateType: "order",
    aggregateId: created.id,
    storefront: created.sourceStorefront ?? null,
    dedupeKey: `order-paid::${created.id}`,
    payload: {
      orderId: created.id,
      orderNumber: created.orderNumber,
      amountTotal: created.amountTotal,
      customerEmail: created.customerEmail,
    },
  });
  const variantCounts = new Map<string, number>();
  for (const item of lineItems) {
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
        // Decrement stock and release checkout reservation in one atomic statement.
        // GREATEST(0, reserved - qty) ensures backward compatibility with orders
        // placed before atomic reservation was introduced.
        const updated = await tx.$executeRaw`
          UPDATE "VariantInventory"
          SET
            "quantityOnHand" = "quantityOnHand" - ${qty},
            reserved = GREATEST(0, reserved - ${qty})
          WHERE "variantId" = ${variantId}
            AND "quantityOnHand" >= ${qty}
        `;
        if (updated === 0) {
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

  const awardedPoints = await awardLoyaltyPointsForOrder(created);
  await consumeLoyaltyHoldForSession(sessionId, created.id);
  if (awardedPoints > 0) {
    await logOrderTimelineEvent({
      orderId: created.id,
      action: "order.lifecycle.status_changed",
      summary: `${awardedPoints} loyalty points awarded`,
      metadata: { points: awardedPoints, source: "stripe.webhook" },
    });
  }

  try {
    if (created.customerEmail) {
      const storefront = resolveStorefrontEmailBrand(
        parseStorefront(created.sourceStorefront ?? null),
        [created.sourceOrigin, created.sourceHost, getAppOrigin(request)],
      );
      const origin = getStorefrontOrigin(
        storefront,
        created.sourceOrigin ?? getAppOrigin(request),
      );
      const guestOrderUrl = buildOrderViewUrl(origin, created.id);
      const orderUrl = created.userId
        ? `${origin}/account/orders/${created.id}`
          : guestOrderUrl ?? undefined;
      const invoiceUrl = buildInvoiceUrl(origin, created.id);
      const receiptUrl =
        storefront === "MAIN" ? buildReceiptUrl(origin, created.id) : null;
      const email = buildOrderEmail(
        "confirmation",
        created,
        orderUrl,
        invoiceUrl ?? undefined,
        {
          storefront,
          fallbackOrigin: origin,
          receiptUrl: receiptUrl ?? undefined,
        },
      );
      await sendResendEmail({
        to: created.customerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    }
  } catch (err) {
    // Don't fail the webhook — but report so we know the customer didn't get their email.
    captureException(err, { context: "sendOrderConfirmationEmail", orderId: created.id });
  }

  const orderLabel = created.id.slice(0, 8).toUpperCase();
  const orderNumber = created.orderNumber;
  const orderCurrency = created.currency;
  const customer = created.customerEmail ?? "unknown";
  const orderSourceLabel = formatOrderSourceLabel(
    created.sourceStorefront,
    created.sourceHost,
    created.sourceOrigin,
  );
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
  const telegramResult = await sendTelegramMessage(
    [
      "",
      `New order #${orderNumber} (${orderLabel})`,
      "",
      `Items: ${itemSummary || "unknown"}`,
      `Amount: ${formattedAmount}`,
      `Payment: ${paymentMethod}`,
      `Website: ${orderSourceLabel}`,
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

const PREMIUM_ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

const resolveSubscriptionUserId = async (
  stripe: Stripe,
  subscription: Stripe.Subscription,
) => {
  const metadataUserId =
    subscription.metadata?.mobileUserId?.trim() ||
    subscription.metadata?.userId?.trim() ||
    "";
  if (metadataUserId) {
    return metadataUserId;
  }

  if (!subscription.customer) {
    return null;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  if (!customerId) {
    return null;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (!("deleted" in customer) || customer.deleted) {
    return null;
  }
  const email = customer.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  return user?.id ?? null;
};

const syncPremiumAccessFromSubscription = async (
  stripe: Stripe,
  subscription: Stripe.Subscription,
) => {
  const userId = await resolveSubscriptionUserId(stripe, subscription);
  if (!userId) {
    return;
  }

  const premiumActive = PREMIUM_ACTIVE_STATUSES.has(subscription.status);
  await prisma.user.update({
    where: { id: userId },
    data: { customerGroup: premiumActive ? "VIP" : "NORMAL" },
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
  if (process.env.NODE_ENV !== "production") {
    console.info("[stripe webhook] Event received:", event.type);
  }

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
      await createOrderFromSession(stripe, session, request);
    }
    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await releaseReservedInventory(stripe, session.id ?? "");
      await releaseLoyaltyHoldForSession(session.id ?? "");
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
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
              orderId: order.id,
              action: "order.lifecycle.payment_failed",
              summary: "Payment failed (checkout.session.async_payment_failed)",
              metadata: {
                source: "stripe.webhook",
                event: "checkout.session.async_payment_failed",
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
    }
    if (event.type === "payment_intent.payment_failed") {
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
            orderId: order.id,
            action: "order.lifecycle.payment_failed",
            summary: "Payment failed (payment_intent.payment_failed)",
            metadata: {
              source: "stripe.webhook",
              event: "payment_intent.payment_failed",
              previousStatus: order.status,
              nextStatus: "failed",
              previousPaymentStatus: order.paymentStatus,
              nextPaymentStatus: "failed",
              paymentIntent: intent.id,
            },
          })
        )
      );
    }
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await releaseReservedInventory(stripe, session.id ?? "");
      await releaseLoyaltyHoldForSession(session.id ?? "");
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncPremiumAccessFromSubscription(stripe, subscription);
    }
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) {
        // no-op: non-subscription invoice
      } else {
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
          );
          await syncPremiumAccessFromSubscription(stripe, subscription);
        }
      }
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
          await logOrderTimelineEvent({
            orderId: order.id,
            action: "order.lifecycle.refund_updated",
            summary: `Refund updated from Stripe: ${order.amountRefunded} -> ${refunded}`,
            metadata: {
              source: "stripe.webhook",
              event: "charge.refunded",
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
    }
  } catch (error) {
    captureException(error, { eventId, eventType: event.type });
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
