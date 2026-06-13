import { Prisma, type CheckoutPaymentDraft } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { buildOrderViewUrl } from "@/lib/orderViewLink";
import { getAppOrigin } from "@/lib/appOrigin";
import { captureException } from "@/lib/sentry";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import {
  DEFAULT_PAYMENT_FEE,
  PAYMENT_FEE_BY_METHOD,
  applyPaymentFeesToCosts,
} from "@/lib/paymentFees";
import {
  buildLoyaltyHoldReason,
  buildLoyaltyRedeemedReason,
  getLoyaltyPointsPerEuro,
} from "@/lib/loyalty";
import {
  DEFAULT_VAT_RATE_BASIS_POINTS,
  calculateVatComponentsFromGross,
  canApplyDefaultVatFallback,
} from "@/lib/vat";
import {
  getStorefrontOrigin,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import { parseStorefront } from "@/lib/storefronts";
import { sendTelegramMessage } from "@/lib/telegram";
import { recordAutomationEvent } from "@/lib/automationEvents";
import { markCheckoutRecoveryOrderLinked } from "@/lib/checkoutRecoveryService";
import {
  mapVivaCurrencyCode,
  normalizeVivaAmountToMinorUnits,
  normalizeVivaTransaction,
  normalizeVivaStatus,
  type VivaTransaction,
} from "@/lib/viva";

type DraftItem = {
  baseCostAmount?: number;
  currency?: string;
  imageUrl?: string | null;
  name?: string;
  options?: Array<{ name: string; value: string }>;
  productId?: string | null;
  quantity?: number;
  totalAmount?: number;
  unitAmount?: number;
  variantId?: string | null;
};

const normalizeOptions = (value: unknown) => {
  if (!Array.isArray(value)) return [] as Array<{ name: string; value: string }>;
  return value
    .map((entry) => {
      const name = typeof entry?.name === "string" ? entry.name : "";
      const optionValue = typeof entry?.value === "string" ? entry.value : "";
      return name && optionValue ? { name, value: optionValue } : null;
    })
    .filter((entry): entry is { name: string; value: string } => Boolean(entry));
};

const readDraftItems = (value: Prisma.JsonValue): DraftItem[] =>
  Array.isArray(value) ? (value as DraftItem[]) : [];

const formatAmountWithComma = (amountMinor: number, currency: string) => {
  const total = Math.round(amountMinor);
  const major = Math.floor(Math.abs(total) / 100);
  const minor = Math.abs(total) % 100;
  const sign = total < 0 ? "-" : "";
  return `${sign}${major},${minor.toString().padStart(2, "0")} ${currency}`;
};

const buildShippingSummary = (order: {
  shippingCity?: string | null;
  shippingCountry?: string | null;
  shippingName?: string | null;
  shippingPostalCode?: string | null;
}) =>
  [
    order.shippingName,
    [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" "),
    order.shippingCountry,
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .join(", ");

const resolvePaymentMethod = (transaction?: VivaTransaction | null) =>
  transaction?.cardNumber ? "card" : "viva";

const consumeLoyaltyHoldForPaymentOrder = async (
  paymentOrderCode: string,
  orderId: string,
) => {
  try {
    await prisma.loyaltyPointTransaction.updateMany({
      where: { reason: buildLoyaltyHoldReason(paymentOrderCode) },
      data: {
        reason: buildLoyaltyRedeemedReason(paymentOrderCode),
        metadata: {
          orderId,
          paymentOrderCode,
          status: "redeemed",
        },
      },
    });
  } catch (error) {
    captureException(error, {
      context: "consumeLoyaltyHoldForPaymentOrder",
      orderId,
      paymentOrderCode,
    });
  }
};

const awardLoyaltyPointsForOrder = async (order: {
  amountDiscount: number;
  amountShipping: number;
  amountSubtotal: number;
  currency: string;
  id: string;
  userId: string | null;
}) => {
  if (!order.userId || order.currency.toUpperCase() !== "EUR") return 0;
  const netSpendCents = Math.max(0, order.amountSubtotal - Math.max(0, order.amountDiscount));
  const points = Math.max(0, Math.floor(netSpendCents / 100) * getLoyaltyPointsPerEuro());
  if (points <= 0) return 0;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltyPointTransaction.findFirst({
        where: { orderId: order.id },
        select: { id: true },
      });
      if (existing) return;

      await tx.loyaltyPointTransaction.create({
        data: {
          userId: order.userId as string,
          orderId: order.id,
          pointsDelta: points,
          reason: "order_paid",
          metadata: {
            amountDiscount: order.amountDiscount,
            amountShipping: order.amountShipping,
            amountSubtotal: order.amountSubtotal,
          },
        },
      });
      await tx.user.update({
        where: { id: order.userId as string },
        data: { loyaltyPointsBalance: { increment: points } },
      });
    });
  } catch (error) {
    captureException(error, { context: "awardLoyaltyPointsForVivaOrder", orderId: order.id });
    return 0;
  }

  return points;
};

const formatOrderItemName = (name: string, manufacturer?: string | null) => {
  const defaultSuffix = / - Default( Title)?$/i;
  if (!defaultSuffix.test(name)) return name;
  const trimmed = manufacturer?.trim();
  return trimmed ? name.replace(defaultSuffix, ` - ${trimmed}`) : name.replace(defaultSuffix, "");
};

const loadManufacturerByProductId = async (items: Array<{ productId?: string | null }>) => {
  const productIds = Array.from(
    new Set(items.map((item) => item.productId).filter(Boolean)),
  ) as string[];
  const products = await prisma.product.findMany({
    where: productIds.length ? { id: { in: productIds } } : { id: "__none__" },
    select: { id: true, manufacturer: true },
  });
  return new Map(products.map((product) => [product.id, product.manufacturer ?? null]));
};

export const createOrderFromVivaDraft = async ({
  draft,
  request,
  transaction,
}: {
  draft: CheckoutPaymentDraft;
  request: Request;
  transaction?: VivaTransaction | null;
}) => {
  const existing = await prisma.order.findFirst({
    where: {
      OR: [
        { paymentOrderCode: draft.paymentOrderCode },
        { stripeSessionId: draft.paymentOrderCode },
      ],
    },
    include: { items: true },
  });
  if (existing) return existing;

  const vivaTransaction = normalizeVivaTransaction(transaction);
  const status = normalizeVivaStatus(vivaTransaction?.statusId);
  if (status !== "paid" && status !== "refunded") {
    await prisma.checkoutPaymentDraft.update({
      where: { paymentOrderCode: draft.paymentOrderCode },
      data: {
        paymentStatus: status,
        paymentTransactionId: vivaTransaction?.transactionId ?? draft.paymentTransactionId,
        status,
      },
    });
    return null;
  }

  const transactionAmount = normalizeVivaAmountToMinorUnits(
    vivaTransaction?.amount,
    draft.amountTotal,
  );
  if (transactionAmount !== draft.amountTotal) {
    throw new Error("Viva payment amount mismatch.");
  }

  const currency = mapVivaCurrencyCode(vivaTransaction?.currencyCode) || draft.currency;
  const paymentMethod = resolvePaymentMethod(vivaTransaction);
  const paymentFeeConfig = PAYMENT_FEE_BY_METHOD[paymentMethod] ?? DEFAULT_PAYMENT_FEE;
  const draftItems = readDraftItems(draft.items);
  const shouldApplyVatFallback =
    canApplyDefaultVatFallback(currency, draft.shippingCountry ?? null) && draft.amountTax <= 0;
  const resolvedTaxAmount = shouldApplyVatFallback
    ? calculateVatComponentsFromGross(draft.amountTotal).vatAmount
    : draft.amountTax;
  const orderItemDrafts = draftItems.map((item) => {
    const totalAmount = Math.max(0, item.totalAmount ?? 0);
    return {
      name: item.name ?? "Artikel",
      quantity: Math.max(0, item.quantity ?? 0),
      unitAmount: Math.max(0, item.unitAmount ?? 0),
      totalAmount,
      baseCostAmount: Math.max(0, item.baseCostAmount ?? 0),
      taxAmount: shouldApplyVatFallback
        ? calculateVatComponentsFromGross(totalAmount).vatAmount
        : 0,
      taxRateBasisPoints: shouldApplyVatFallback ? DEFAULT_VAT_RATE_BASIS_POINTS : null,
      currency: (item.currency ?? currency).toUpperCase(),
      imageUrl: item.imageUrl ?? null,
      productId: item.productId ?? undefined,
      variantId: item.variantId ?? undefined,
      options: normalizeOptions(item.options),
    };
  });
  const orderItemsWithFees = applyPaymentFeesToCosts(
    orderItemDrafts.map((item) => ({
      baseCostAmount: item.baseCostAmount,
      quantity: item.quantity,
      totalAmount: item.totalAmount,
      unitAmount: item.unitAmount,
    })),
    draft.amountShipping,
    paymentFeeConfig,
  );
  const orderItemCreates = orderItemDrafts.map((item, index) => {
    const snapshot = orderItemsWithFees[index];
    return {
      ...item,
      adjustedCostAmount: snapshot?.adjustedCostAmount ?? item.baseCostAmount,
      paymentFeeAmount: snapshot?.paymentFeeAmount ?? 0,
    };
  });

  const created = await prisma.order.create({
    data: {
      userId: draft.userId ?? undefined,
      paymentProvider: "viva",
      paymentOrderCode: draft.paymentOrderCode,
      paymentTransactionId: vivaTransaction?.transactionId ?? draft.paymentTransactionId,
      stripeSessionId: draft.paymentOrderCode,
      sourceStorefront: draft.sourceStorefront ?? undefined,
      sourceHost: draft.sourceHost ?? undefined,
      sourceOrigin: draft.sourceOrigin ?? undefined,
      paymentMethod,
      status: "paid",
      paymentStatus: status,
      currency,
      amountSubtotal: draft.amountSubtotal,
      amountTax: resolvedTaxAmount,
      amountShipping: draft.amountShipping,
      amountDiscount: draft.amountDiscount,
      amountTotal: draft.amountTotal,
      discountCode: draft.discountCode ?? undefined,
      recoveredFromCheckoutSessionId: draft.recoveredFromCheckoutSessionId ?? undefined,
      customerEmail: draft.customerEmail ?? vivaTransaction?.email ?? undefined,
      shippingName: draft.shippingName ?? vivaTransaction?.fullName ?? undefined,
      shippingLine1: draft.shippingLine1 ?? undefined,
      shippingLine2: draft.shippingLine2 ?? undefined,
      shippingPostalCode: draft.shippingPostalCode ?? undefined,
      shippingCity: draft.shippingCity ?? undefined,
      shippingCountry: draft.shippingCountry ?? undefined,
      items: { create: orderItemCreates },
    },
    include: { items: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.checkoutPaymentDraft.update({
      where: { paymentOrderCode: draft.paymentOrderCode },
      data: {
        paymentStatus: status,
        paymentTransactionId: vivaTransaction?.transactionId ?? draft.paymentTransactionId,
        status: "paid",
      },
    });

    for (const item of draftItems) {
      const variantId = item.variantId;
      const quantity = Math.max(0, item.quantity ?? 0);
      if (!variantId || quantity <= 0) continue;
      const variant = await tx.variant.findUnique({
        where: { id: variantId },
        select: { productId: true },
      });
      if (!variant) continue;
      const updated = await tx.$executeRaw`
        UPDATE "VariantInventory"
        SET
          "quantityOnHand" = "quantityOnHand" - ${quantity},
          reserved = GREATEST(0, reserved - ${quantity})
        WHERE "variantId" = ${variantId}
          AND "quantityOnHand" >= ${quantity}
      `;
      if (updated === 0) {
        console.warn("[viva webhook] Insufficient inventory for variant.", {
          quantity,
          variantId,
        });
        continue;
      }
      await tx.inventoryAdjustment.create({
        data: {
          variantId,
          productId: variant.productId,
          orderId: created.id,
          quantityDelta: -quantity,
          reason: "checkout_paid",
        },
      });
    }
  });

  await consumeLoyaltyHoldForPaymentOrder(draft.paymentOrderCode, created.id);
  const awardedPoints = await awardLoyaltyPointsForOrder(created);
  await logOrderTimelineEvent({
    orderId: created.id,
    action: "order.lifecycle.created",
    summary: `Order created from Viva order ${draft.paymentOrderCode}`,
      metadata: {
        paymentOrderCode: draft.paymentOrderCode,
        paymentStatus: created.paymentStatus,
        paymentTransactionId: vivaTransaction?.transactionId ?? null,
        source: "viva.webhook",
      },
  });
  if (awardedPoints > 0) {
    await logOrderTimelineEvent({
      orderId: created.id,
      action: "order.lifecycle.status_changed",
      summary: `${awardedPoints} loyalty points awarded`,
      metadata: { points: awardedPoints, source: "viva.webhook" },
    });
  }
  await recordAutomationEvent({
    eventType: "order.paid",
    aggregateType: "order",
    aggregateId: created.id,
    storefront: created.sourceStorefront ?? null,
    dedupeKey: `order-paid::${created.id}`,
    payload: {
      amountTotal: created.amountTotal,
      customerEmail: created.customerEmail,
      orderId: created.id,
      orderNumber: created.orderNumber,
    },
  });
  await markCheckoutRecoveryOrderLinked({
    stripeSessionId: draft.paymentOrderCode,
    recoverySessionId: draft.recoveredFromCheckoutSessionId,
    orderId: created.id,
  });

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
      const email = buildOrderEmail(
        "confirmation",
        created,
        orderUrl,
        invoiceUrl ?? undefined,
        {
          fallbackOrigin: origin,
          storefront,
        },
      );
      await sendResendEmail({
        to: created.customerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      await prisma.order.update({
        where: { id: created.id },
        data: { confirmationEmailSentAt: new Date() },
      });
    }
  } catch (error) {
    captureException(error, { context: "sendVivaOrderConfirmationEmail", orderId: created.id });
  }

  const manufacturerByProductId = await loadManufacturerByProductId(created.items);
  const itemSummary = created.items
    .map((item) => {
      const manufacturer = item.productId
        ? manufacturerByProductId.get(item.productId) ?? null
        : null;
      const name = formatOrderItemName(item.name, manufacturer);
      return item.quantity > 0 ? `- ${item.quantity}x ${name}` : "";
    })
    .filter(Boolean)
    .join("\n");
  const orderTime = new Date(created.createdAt).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const discountLine =
    created.amountDiscount > 0
      ? `Discount: ${formatAmountWithComma(created.amountDiscount, created.currency)}${
          created.discountCode ? ` (${created.discountCode})` : ""
        }`
      : "Discount: none";
  const shippingSummary = buildShippingSummary(created);
  const telegramResult = await sendTelegramMessage({
    text: [
      "",
      `New order #${created.orderNumber} (${created.id.slice(0, 8).toUpperCase()})`,
      "",
      `Amount: ${formatAmountWithComma(created.amountTotal, created.currency)}`,
      discountLine,
      `Payment: ${paymentMethod} via Viva`,
      `Viva order: ${draft.paymentOrderCode}`,
      `Viva transaction: ${vivaTransaction?.transactionId ?? "pending"}`,
      `Customer: ${created.customerEmail ?? "unknown"}`,
      `Ship to: ${shippingSummary || "unknown"}`,
      `Time: ${orderTime}`,
      "",
      "Items:",
      itemSummary || "- unknown",
      "",
    ].join("\n"),
  });
  if (!telegramResult.ok) {
    console.warn("[viva webhook] Telegram send failed.", telegramResult);
  }

  return created;
};
