import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import {
  FREE_SHIPPING_THRESHOLD_EUR,
  MIN_ORDER_TOTAL_EUR,
  toCents,
} from "@/lib/checkoutPolicy";
import { getShippingAmount, SHIPPING_BASE, type ShippingCountry } from "@/lib/shippingPolicy";
import {
  buildLoyaltyHoldReason,
  discountCentsToPoints,
  formatRedeemRateLabel,
  pointsToDiscountCents,
} from "@/lib/loyalty";
import { createGuestCheckoutAccess } from "@/lib/checkoutAccess";
import { persistCheckoutRecoverySession } from "@/lib/checkoutRecoveryService";
import { resolveCheckoutOrigin, resolveOrderSourceFromRequest } from "@/lib/orderSource";
import { SITE_NAME } from "@/lib/siteConfig";
import {
  buildShippingAddressLines,
  normalizeShippingAddress,
  validateShippingAddress,
} from "@/lib/shippingAddress";
import { loadCheckoutUser } from "@/lib/checkoutUser";
import {
  normalizeCartOptions,
  resolveCartItemsForRequest,
  type ServerCartItem,
} from "@/lib/serverCartStorage";
import {
  createVivaPaymentOrder,
  getVivaCheckoutUrl,
  getVivaSourceCode,
} from "@/lib/viva";
import { findRedeemableDiscountCode } from "@/lib/discountCodes";
import { expireStaleCheckoutPaymentDrafts } from "@/lib/paymentCheckoutReservations";

export const runtime = "nodejs";

const CURRENCY_CODE = "EUR";

type CheckoutCartSummaryItem = {
  imageUrl: string | null;
  lineTotalCents: number;
  name: string;
  options?: Array<{ name: string; value: string }>;
  quantity: number;
  variantId: string;
};

type CheckoutSummarySnapshot = {
  currency: string;
  discountCents: number;
  items: CheckoutCartSummaryItem[];
  shippingCents: number;
  subtotalCents: number;
  totalCents: number;
};

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
};

const jsonNoStore = (body: unknown, init?: number | ResponseInit) => {
  const responseInit =
    typeof init === "number" ? { status: init } : (init ?? {});
  return NextResponse.json(body, {
    ...responseInit,
    headers: {
      ...noStoreHeaders,
      ...(responseInit.headers ?? {}),
    },
  });
};

const hashCheckoutEditorToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const clampCheckoutDiscount = (value: number, subtotalCents: number) =>
  Math.max(0, Math.min(subtotalCents, Math.round(value)));

const formatOptionsLabel = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

const truncatePaymentText = (value: string, maxLength = 240) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
    : normalized;
};

const buildPaymentItemSummary = (items: CheckoutCartSummaryItem[]) => {
  const summary = items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join("; ");
  return truncatePaymentText(summary || "unknown items", 180);
};

const getSafeCountry = (value: unknown): ShippingCountry => {
  const raw = String(value ?? "").toUpperCase();
  if (raw in SHIPPING_BASE) return raw as ShippingCountry;
  return "DE";
};

const getRequestedCountry = (value: unknown): ShippingCountry | null => {
  const raw = String(value ?? "").toUpperCase();
  if (raw in SHIPPING_BASE) return raw as ShippingCountry;
  return null;
};

const normalizeCountryCode = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase();
  const aliases: Record<string, string> = {
    AT: "AT",
    AUT: "AT",
    AUSTRIA: "AT",
    DE: "DE",
    DEU: "DE",
    DEUTSCHLAND: "DE",
    GERMANY: "DE",
    CH: "CH",
    CHE: "CH",
    SCHWEIZ: "CH",
    SWITZERLAND: "CH",
    UK: "GB",
    GB: "GB",
    GBR: "GB",
    "UNITED KINGDOM": "GB",
    US: "US",
    USA: "US",
    "UNITED STATES": "US",
  };
  return trimmed.length === 2 ? trimmed : aliases[trimmed];
};

const buildCheckoutItemPresentation = (
  variant: {
    id: string;
    priceCents: number;
    product: {
      id: string;
      images: Array<{ url: string }>;
      manufacturer?: string | null;
      title: string;
    };
    title?: string | null;
  },
  item: ServerCartItem,
) => {
  const productName = variant.product.title;
  const variantTitle = variant.title?.trim();
  const manufacturer = variant.product.manufacturer?.trim();
  const isDefaultVariant =
    !variantTitle || variantTitle.toLowerCase().includes("default");
  const baseName =
    manufacturer && !productName.toLowerCase().includes(manufacturer.toLowerCase())
      ? `${manufacturer} ${productName}`
      : productName;
  const name =
    !isDefaultVariant && variantTitle
      ? `${baseName} — ${variantTitle}`
      : baseName;
  const selectedOptions = normalizeCartOptions(item.options);
  const optionsLabel = selectedOptions.length
    ? ` (${formatOptionsLabel(selectedOptions)})`
    : "";

  return {
    imageUrl: variant.product.images[0]?.url ?? null,
    name: `${name}${optionsLabel}`,
    selectedOptions,
  };
};

const buildCheckoutAddress = (
  user: {
    city?: string | null;
    country?: string | null;
    houseNumber?: string | null;
    packstationNumber?: string | null;
    postalCode?: string | null;
    postNumber?: string | null;
    shippingAddressType?: string | null;
    street?: string | null;
  },
  fallbackCountry?: string | null,
) => {
  const { line1, line2 } = buildShippingAddressLines({
    houseNumber: user.houseNumber,
    packstationNumber: user.packstationNumber,
    postNumber: user.postNumber,
    shippingAddressType: user.shippingAddressType,
    street: user.street,
  });
  const address: {
    city?: string;
    country?: string;
    line1?: string;
    line2?: string;
    postalCode?: string;
  } = {};
  if (line1) address.line1 = line1;
  if (line2) address.line2 = line2;
  if (user.city) address.city = user.city;
  if (user.postalCode) address.postalCode = user.postalCode;
  const country =
    normalizeCountryCode(user.country) ?? normalizeCountryCode(fallbackCountry);
  if (country) address.country = country;
  return Object.keys(address).length ? address : undefined;
};

const buildCheckoutSuccessUrl = (
  appBaseUrl: string,
  guestCheckoutAccess?: ReturnType<typeof createGuestCheckoutAccess> | null,
  paymentOrderCode?: string,
) => {
  const successUrl = new URL("/order/success", appBaseUrl);
  successUrl.searchParams.set("order_code", paymentOrderCode ?? "{VIVA_ORDER_CODE}");
  if (guestCheckoutAccess) {
    successUrl.searchParams.set("guest_token", guestCheckoutAccess.token);
    successUrl.searchParams.set("guest_expires", String(guestCheckoutAccess.expiresAt));
  }
  return successUrl.toString();
};

const buildCheckoutFailureUrl = (appBaseUrl: string, paymentOrderCode?: string) => {
  const failureUrl = new URL("/order/failure", appBaseUrl);
  failureUrl.searchParams.set("order_code", paymentOrderCode ?? "{VIVA_ORDER_CODE}");
  return failureUrl.toString();
};

export async function GET() {
  const authSession = await getServerSession(authOptions);
  const userId = authSession?.user?.id ?? null;
  const user = userId ? await loadCheckoutUser(userId) : null;
  const items = await resolveCartItemsForRequest(userId);
  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((item) => item.variantId) } },
    include: {
      product: { include: { images: { orderBy: { position: "asc" } } } },
    },
  });
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const cartItems: CheckoutCartSummaryItem[] = [];
  let subtotalCents = 0;

  for (const item of items) {
    const variant = variantMap.get(item.variantId);
    if (!variant) continue;
    const presentation = buildCheckoutItemPresentation(variant, item);
    const lineTotalCents = variant.priceCents * item.quantity;
    subtotalCents += lineTotalCents;
    cartItems.push({
      imageUrl: presentation.imageUrl,
      lineTotalCents,
      name: presentation.name,
      quantity: item.quantity,
      variantId: variant.id,
    });
  }

  return jsonNoStore({
    cart: {
      currency: CURRENCY_CODE,
      items: cartItems,
      subtotalCents,
    },
    user: user
      ? {
          city: user.city,
          country: user.country,
          email: user.email,
          firstName: user.firstName,
          houseNumber: user.houseNumber,
          lastName: user.lastName,
          loyaltyPointsBalance: user.loyaltyPointsBalance,
          name: user.name,
          packstationNumber: user.packstationNumber,
          postalCode: user.postalCode,
          postNumber: user.postNumber,
          shippingAddressType: user.shippingAddressType,
          street: user.street,
        }
      : null,
  });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit({
    key: `checkout:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return jsonNoStore(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  await expireStaleCheckoutPaymentDrafts();

  const authSession = await getServerSession(authOptions);
  const body = await req.json().catch(() => ({}));
  const rawDiscountCode =
    typeof body?.discountCode === "string" ? body.discountCode.trim() : "";
  const useLoyaltyPoints = body?.useLoyaltyPoints === true;
  const checkoutRecoveryConsent = body?.checkoutRecoveryConsent === true;
  const recoverySessionId =
    typeof body?.recoverySessionId === "string" ? body.recoverySessionId.trim() : "";
  if (rawDiscountCode && rawDiscountCode.length > 64) {
    return jsonNoStore({ error: "Rabattcode ungültig." }, { status: 400 });
  }

  const userId = authSession?.user?.id ?? null;
  const user = userId ? await loadCheckoutUser(userId) : null;
  const checkoutEmail =
    typeof body?.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : user?.email ?? "";
  const checkoutFirstName =
    typeof body?.firstName === "string" && body.firstName.trim()
      ? body.firstName.trim()
      : user?.firstName ?? "";
  const checkoutLastName =
    typeof body?.lastName === "string" && body.lastName.trim()
      ? body.lastName.trim()
      : user?.lastName ?? "";

  if (!checkoutEmail) {
    return jsonNoStore({ error: "E-Mail ist erforderlich." }, { status: 400 });
  }
  if (!checkoutFirstName || !checkoutLastName) {
    return jsonNoStore(
      { error: "Vorname und Nachname sind erforderlich." },
      { status: 400 },
    );
  }

  const normalizedShippingAddress = normalizeShippingAddress({
    city: typeof body?.city === "string" ? body.city : user?.city,
    country: typeof body?.country === "string" ? body.country : user?.country,
    houseNumber:
      typeof body?.houseNumber === "string" ? body.houseNumber : user?.houseNumber,
    packstationNumber:
      typeof body?.packstationNumber === "string"
        ? body.packstationNumber
        : user?.packstationNumber,
    postalCode:
      typeof body?.postalCode === "string" ? body.postalCode : user?.postalCode,
    postNumber:
      typeof body?.postNumber === "string" ? body.postNumber : user?.postNumber,
    shippingAddressType:
      typeof body?.shippingAddressType === "string"
        ? body.shippingAddressType
        : user?.shippingAddressType,
    street: typeof body?.street === "string" ? body.street : user?.street,
  });

  const shippingAddressError = validateShippingAddress(normalizedShippingAddress, {
    requireComplete: true,
  });
  if (shippingAddressError) {
    return jsonNoStore({ error: shippingAddressError }, { status: 400 });
  }

  const requestedCountry = getRequestedCountry(normalizedShippingAddress.country);
  if (!requestedCountry) {
    return jsonNoStore(
      { error: "Lieferland wird derzeit nicht unterstützt." },
      { status: 400 },
    );
  }

  const country = requestedCountry ?? getSafeCountry(body?.country);
  const items = await resolveCartItemsForRequest(userId);
  if (items.length === 0) {
    return jsonNoStore({ error: "Cart is empty." }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((item) => item.variantId) } },
    include: {
      inventory: true,
      product: { include: { images: { orderBy: { position: "asc" } } } },
    },
  });
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const cartSummaryItems: CheckoutCartSummaryItem[] = [];
  const variantCounts = new Map<string, number>();
  let subtotalCents = 0;

  for (const item of items) {
    const variant = variantMap.get(item.variantId);
    if (!variant) continue;
    const presentation = buildCheckoutItemPresentation(variant, item);
    const lineTotalCents = variant.priceCents * item.quantity;
    subtotalCents += lineTotalCents;
    cartSummaryItems.push({
      imageUrl: presentation.imageUrl,
      lineTotalCents,
      name: presentation.name,
      options: presentation.selectedOptions,
      quantity: item.quantity,
      variantId: variant.id,
    });
    variantCounts.set(
      variant.id,
      (variantCounts.get(variant.id) ?? 0) + item.quantity,
    );
  }

  if (cartSummaryItems.length === 0) {
    return jsonNoStore({ error: "No valid items in cart." }, { status: 400 });
  }

  const minOrderCents = toCents(MIN_ORDER_TOTAL_EUR);
  if (subtotalCents < minOrderCents) {
    return jsonNoStore(
      { error: `Mindestbestellwert ${MIN_ORDER_TOTAL_EUR.toFixed(2)} EUR.` },
      { status: 400 },
    );
  }

  for (const [variantId, quantity] of variantCounts) {
    const variant = variantMap.get(variantId);
    const onHand = variant?.inventory?.quantityOnHand ?? 0;
    const reserved = variant?.inventory?.reserved ?? 0;
    if (Math.max(0, onHand - reserved) < quantity) {
      return jsonNoStore({ error: "Nicht genug Bestand." }, { status: 409 });
    }
  }

  const orderSource = resolveOrderSourceFromRequest(req);
  const appBaseUrl = resolveCheckoutOrigin(orderSource);
  const shippingAmount = getShippingAmount(country);
  const freeShippingCents = toCents(FREE_SHIPPING_THRESHOLD_EUR);
  const shippingCents =
    subtotalCents >= freeShippingCents
      ? 0
      : Math.max(0, Math.round(shippingAmount * 100));

  if (useLoyaltyPoints && !userId) {
    return jsonNoStore(
      { error: "Smokeify Punkte können nur im Kundenkonto eingelöst werden." },
      { status: 401 },
    );
  }
  if (useLoyaltyPoints && rawDiscountCode) {
    return jsonNoStore(
      { error: "Smokeify Punkte können nicht mit Rabattcodes kombiniert werden." },
      { status: 400 },
    );
  }

  let loyaltyPointsToRedeem = 0;
  let loyaltyDiscountCents = 0;
  if (useLoyaltyPoints && user) {
    loyaltyPointsToRedeem = Math.max(0, Math.floor(user.loyaltyPointsBalance));
    loyaltyDiscountCents = Math.min(
      subtotalCents,
      pointsToDiscountCents(loyaltyPointsToRedeem),
    );
    loyaltyPointsToRedeem = discountCentsToPoints(loyaltyDiscountCents);
  }

  let promotionDiscountCents = 0;
  let appliedDiscountCode: string | undefined;
  if (rawDiscountCode) {
    const promotionCode = await findRedeemableDiscountCode({
      code: rawDiscountCode,
      customerEmail: checkoutEmail,
      currency: CURRENCY_CODE,
      subtotalCents,
    });
    if (!promotionCode) {
      return jsonNoStore({ error: "Rabattcode ungültig." }, { status: 400 });
    }
    appliedDiscountCode = promotionCode.discount.code;
    promotionDiscountCents = promotionCode.discountCents;
  }

  const effectiveDiscountCents = clampCheckoutDiscount(
    promotionDiscountCents + loyaltyDiscountCents,
    subtotalCents,
  );
  const totalCents = Math.max(0, subtotalCents + shippingCents - effectiveDiscountCents);
  const checkoutEditorToken = randomUUID();
  const guestCheckoutAccess = userId ? null : createGuestCheckoutAccess();
  const shippingAddress =
    buildCheckoutAddress(normalizedShippingAddress, country) ?? {};
  const shippingName = [checkoutFirstName, checkoutLastName].filter(Boolean).join(" ").trim();
  const reservedVariants: Array<{ quantity: number; variantId: string }> = [];
  const releaseReservation = async () => {
    if (reservedVariants.length === 0) return;
    await prisma.$transaction(async (tx) => {
      for (const { quantity, variantId } of reservedVariants) {
        await tx.variantInventory.updateMany({
          where: { variantId, reserved: { gte: quantity } },
          data: { reserved: { decrement: quantity } },
        });
      }
    });
  };

  try {
    await prisma.$transaction(async (tx) => {
      for (const [variantId, quantity] of variantCounts) {
        const updated = await tx.$executeRaw`
          UPDATE "VariantInventory"
          SET reserved = reserved + ${quantity}
          WHERE "variantId" = ${variantId}
            AND ("quantityOnHand" - reserved) >= ${quantity}
        `;
        if (updated === 0) {
          throw Object.assign(new Error("INSUFFICIENT_INVENTORY"), { variantId });
        }
        reservedVariants.push({ quantity, variantId });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_INVENTORY") {
      return jsonNoStore({ error: "Nicht genug Bestand." }, { status: 409 });
    }
    throw error;
  }

  let vivaOrder: { orderCode: string };
  try {
    const vivaItemSummary = buildPaymentItemSummary(cartSummaryItems);
    vivaOrder = await createVivaPaymentOrder({
      amount: totalCents,
      customerTrns: `${SITE_NAME} Bestellung`,
      customer: {
        countryCode: country,
        email: checkoutEmail,
        fullName: shippingName,
        requestLang: "de-DE",
      },
      merchantTrns: truncatePaymentText(`${SITE_NAME}: ${vivaItemSummary}`),
      paymentTimeout: 1800,
      sourceCode: getVivaSourceCode(),
      tags: ["smokeify", "checkout", orderSource.sourceStorefront ?? "main"],
    });
  } catch (error) {
    await releaseReservation();
    return jsonNoStore(
      {
        error:
          error instanceof Error
            ? error.message
            : "Viva Checkout konnte nicht initialisiert werden.",
      },
      { status: 500 },
    );
  }

  if (loyaltyPointsToRedeem > 0 && userId) {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltyPointTransaction.findFirst({
          where: { reason: buildLoyaltyHoldReason(vivaOrder.orderCode) },
          select: { id: true },
        });
        if (existing) return;

        const updated = await tx.user.updateMany({
          where: {
            id: userId,
            loyaltyPointsBalance: { gte: loyaltyPointsToRedeem },
          },
          data: {
            loyaltyPointsBalance: { decrement: loyaltyPointsToRedeem },
          },
        });
        if (updated.count === 0) {
          throw new Error("LOYALTY_POINTS_UNAVAILABLE");
        }
        await tx.loyaltyPointTransaction.create({
          data: {
            userId,
            pointsDelta: -loyaltyPointsToRedeem,
            reason: buildLoyaltyHoldReason(vivaOrder.orderCode),
            metadata: {
              description: formatRedeemRateLabel(),
              loyaltyDiscountAmount: loyaltyDiscountCents,
              loyaltyPointsRedeemed: loyaltyPointsToRedeem,
              paymentOrderCode: vivaOrder.orderCode,
            },
          },
        });
      });
    } catch (error) {
      await releaseReservation();
      return jsonNoStore(
        {
          error:
            error instanceof Error && error.message === "LOYALTY_POINTS_UNAVAILABLE"
              ? "Smokeify Punkte standen nicht mehr in ausreichender Höhe zur Verfügung."
              : "Smokeify Punkte konnten nicht reserviert werden.",
        },
        { status: 409 },
      );
    }
  }

  const draftItems = cartSummaryItems.map((item) => {
    const variant = variantMap.get(item.variantId);
    return {
      ...item,
      baseCostAmount: Math.max(0, variant?.costCents ?? 0) * item.quantity,
      currency: CURRENCY_CODE,
      productId: variant?.product.id ?? null,
      totalAmount: item.lineTotalCents,
      unitAmount: item.quantity > 0 ? Math.round(item.lineTotalCents / item.quantity) : 0,
    };
  });

  const recoverySession = await persistCheckoutRecoverySession({
    paymentOrderCode: vivaOrder.orderCode,
    userId,
    customerEmail: checkoutEmail,
    customerFirstName: checkoutFirstName,
    customerLastName: checkoutLastName,
    sourceStorefront: orderSource.sourceStorefront,
    sourceHost: orderSource.sourceHost,
    sourceOrigin: orderSource.sourceOrigin,
    isGuest: !userId,
    consentGranted: checkoutRecoveryConsent,
    cartItems: items,
    cartSummary: {
      currency: CURRENCY_CODE,
      discountCents: effectiveDiscountCents,
      items: cartSummaryItems,
      shippingCents,
      subtotalCents,
      totalCents,
    },
    discountCode: appliedDiscountCode ?? null,
    shippingCountry: country,
  });

  await prisma.checkoutPaymentDraft.create({
    data: {
      paymentProvider: "viva",
      paymentOrderCode: vivaOrder.orderCode,
      userId,
      editTokenHash: hashCheckoutEditorToken(checkoutEditorToken),
      guestCheckoutAccessHash: guestCheckoutAccess?.tokenHash,
      guestCheckoutAccessExpiresAt: guestCheckoutAccess
        ? BigInt(guestCheckoutAccess.expiresAt)
        : undefined,
      sourceStorefront: orderSource.sourceStorefront ?? undefined,
      sourceHost: orderSource.sourceHost ?? undefined,
      sourceOrigin: orderSource.sourceOrigin ?? undefined,
      currency: CURRENCY_CODE,
      amountSubtotal: subtotalCents,
      amountShipping: shippingCents,
      amountDiscount: effectiveDiscountCents,
      amountTotal: totalCents,
      discountCode: appliedDiscountCode,
      loyaltyPointsRedeemed: loyaltyPointsToRedeem,
      loyaltyDiscountAmount: loyaltyDiscountCents,
      customerEmail: checkoutEmail,
      shippingName,
      shippingLine1: shippingAddress.line1,
      shippingLine2: shippingAddress.line2,
      shippingPostalCode: shippingAddress.postalCode,
      shippingCity: shippingAddress.city,
      shippingCountry: shippingAddress.country,
      shippingAddressType: normalizedShippingAddress.shippingAddressType,
      recoveredFromCheckoutSessionId: recoverySessionId || recoverySession.id,
      items: draftItems as Prisma.InputJsonValue,
    },
  });

  const summary: CheckoutSummarySnapshot = {
    currency: CURRENCY_CODE,
    discountCents: effectiveDiscountCents,
    items: cartSummaryItems,
    shippingCents,
    subtotalCents,
    totalCents,
  };
  const successUrl = buildCheckoutSuccessUrl(
    appBaseUrl,
    guestCheckoutAccess,
    vivaOrder.orderCode,
  );
  const failureUrl = buildCheckoutFailureUrl(appBaseUrl, vivaOrder.orderCode);

  return jsonNoStore({
    checkoutUrl: getVivaCheckoutUrl(vivaOrder.orderCode),
    discountCode: appliedDiscountCode,
    editToken: checkoutEditorToken,
    failureUrl,
    orderCode: vivaOrder.orderCode,
    sessionId: vivaOrder.orderCode,
    successUrl,
    summary,
  });
}
