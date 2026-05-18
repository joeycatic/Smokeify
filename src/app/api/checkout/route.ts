import { createHash, randomUUID } from "crypto";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
import { resolveCheckoutOrigin, resolveOrderSourceFromRequest } from "@/lib/orderSource";
import {
  buildShippingAddressLines,
  normalizeShippingAddress,
  validateShippingAddress,
} from "@/lib/shippingAddress";
import { loadCheckoutUser } from "@/lib/checkoutUser";

export const runtime = "nodejs";

const CURRENCY_CODE = "EUR";
const COOKIE_NAME = "smokeify_cart";
const ALLOWED_PAYMENT_METHOD_TYPES = ["card", "paypal", "klarna"] as const;
const STRIPE_DEFAULT_API_VERSION = "2024-06-20";
const STRIPE_CUSTOM_CHECKOUT_API_VERSION = "2025-03-31.basil";

const ALLOWED_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "US",
  "CA",
  "AU",
  "NZ",
] as const;

type AllowedPaymentMethodType = (typeof ALLOWED_PAYMENT_METHOD_TYPES)[number];

type CartItem = {
  variantId: string;
  quantity: number;
  options?: Array<{ name: string; value: string }>;
};

type CheckoutCartSummaryItem = {
  imageUrl: string | null;
  lineTotalCents: number;
  name: string;
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

const clampCheckoutDiscount = (value: number, subtotalCents: number) =>
  Math.max(0, Math.min(subtotalCents, Math.round(value)));

const getCouponDiscountPreviewCents = (
  coupon: Stripe.Coupon | null | undefined,
  subtotalCents: number,
) => {
  if (!coupon) return 0;
  if (typeof coupon.amount_off === "number") {
    return clampCheckoutDiscount(coupon.amount_off, subtotalCents);
  }
  if (typeof coupon.percent_off === "number") {
    return clampCheckoutDiscount(
      subtotalCents * (coupon.percent_off / 100),
      subtotalCents,
    );
  }
  return 0;
};

const parseCheckoutPaymentMethodTypes = (): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] | undefined => {
  const raw =
    process.env.STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES?.trim() ??
    process.env.NEXT_PUBLIC_PAYMENT_METHOD_LOGOS?.trim();
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const deduped = Array.from(new Set(values));
  const allowed = deduped.filter((entry): entry is AllowedPaymentMethodType =>
    ALLOWED_PAYMENT_METHOD_TYPES.includes(entry as AllowedPaymentMethodType),
  );
  return allowed.length
    ? (allowed as Stripe.Checkout.SessionCreateParams.PaymentMethodType[])
    : undefined;
};

const normalizeOptions = (
  options?: Array<{ name?: string | null; value?: string | null }>,
): Array<{ name: string; value: string }> => {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: Array<{ name: string; value: string }> = [];
  options.forEach((opt) => {
    const name = String(opt?.name ?? "").trim();
    const value = String(opt?.value ?? "").trim();
    if (!name || !value) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ name, value });
  });
  return normalized;
};

const serializeOptionsMetadata = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map(
      (opt) => `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`,
    )
    .sort()
    .join("&");
};

const formatOptionsLabel = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

const readCartItems = async () => {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return [] as CartItem[];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.variantId && Number.isFinite(item.quantity))
      .map((item) => ({
        variantId: String(item.variantId),
        quantity: Math.max(0, Math.floor(Number(item.quantity))),
        options: normalizeOptions(item.options),
      }))
      .filter((item) => item.quantity > 0);
  } catch {
    return [];
  }
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
  const aliases: Record<string, Stripe.AddressParam["country"]> = {
    DE: "DE",
    DEU: "DE",
    GERMANY: "DE",
    DEUTSCHLAND: "DE",
    AT: "AT",
    AUT: "AT",
    AUSTRIA: "AT",
    OESTERREICH: "AT",
    CH: "CH",
    CHE: "CH",
    SWITZERLAND: "CH",
    SCHWEIZ: "CH",
    UK: "GB",
    GB: "GB",
    GBR: "GB",
    "UNITED KINGDOM": "GB",
    "GREAT BRITAIN": "GB",
    "VEREINIGTES KOENIGREICH": "GB",
    US: "US",
    USA: "US",
    "UNITED STATES": "US",
  };
  const normalized =
    trimmed.length === 2
      ? (trimmed as Stripe.AddressParam["country"])
      : aliases[trimmed];
  if (
    normalized &&
    ALLOWED_COUNTRIES.includes(normalized as (typeof ALLOWED_COUNTRIES)[number])
  ) {
    return normalized;
  }
  return undefined;
};

const buildCheckoutItemPresentation = (
  variant: {
    id: string;
    title?: string | null;
    priceCents: number;
    product: {
      id: string;
      title: string;
      manufacturer?: string | null;
      images: Array<{ url: string }>;
    };
  },
  item: CartItem,
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
  const selectedOptions = normalizeOptions(item.options);
  const optionsLabel = selectedOptions.length
    ? ` (${formatOptionsLabel(selectedOptions)})`
    : "";

  return {
    imageUrl: variant.product.images[0]?.url ?? null,
    name: `${name}${optionsLabel}`,
    selectedOptions,
  };
};

const buildStripeAddress = (
  user: {
    shippingAddressType?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    packstationNumber?: string | null;
    postNumber?: string | null;
  },
  fallbackCountry?: string | null,
) => {
  const { line1, line2 } = buildShippingAddressLines({
    shippingAddressType: user.shippingAddressType,
    street: user.street,
    houseNumber: user.houseNumber,
    packstationNumber: user.packstationNumber,
    postNumber: user.postNumber,
  });
  const address: Stripe.AddressParam = {};
  if (line1) address.line1 = line1;
  if (line2) address.line2 = line2;
  if (user.city) address.city = user.city;
  if (user.postalCode) address.postal_code = user.postalCode;
  const country =
    normalizeCountryCode(user.country) ?? normalizeCountryCode(fallbackCountry);
  if (country) address.country = country;
  return Object.keys(address).length ? address : undefined;
};

const createStripeCustomer = async (
  stripe: Stripe,
  user: {
    email?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    shippingAddressType?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    packstationNumber?: string | null;
    postNumber?: string | null;
  },
  userId?: string | null,
  fallbackCountry?: string | null,
) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const name = fullName || user.name || undefined;
  const address = buildStripeAddress(user, fallbackCountry);
  if (!user.email && !name && !address) return null;
  const shipping = address && name ? { name, address } : undefined;
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name,
    address,
    shipping,
    metadata: userId ? { userId } : undefined,
  });
  return customer.id;
};

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, {
    apiVersion: STRIPE_DEFAULT_API_VERSION as Stripe.LatestApiVersion,
  });
};

const getCustomCheckoutStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, {
    apiVersion:
      STRIPE_CUSTOM_CHECKOUT_API_VERSION as unknown as Stripe.LatestApiVersion,
  });
};

const hashCheckoutEditorToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const buildCheckoutSuccessUrl = (
  appBaseUrl: string,
  guestCheckoutAccess?: ReturnType<typeof createGuestCheckoutAccess> | null,
  sessionId?: string,
) => {
  const successUrl = new URL("/order/success", appBaseUrl);
  successUrl.searchParams.set("session_id", sessionId ?? "{CHECKOUT_SESSION_ID}");
  if (guestCheckoutAccess) {
    successUrl.searchParams.set("guest_token", guestCheckoutAccess.token);
    successUrl.searchParams.set(
      "guest_expires",
      String(guestCheckoutAccess.expiresAt),
    );
  }
  return successUrl.toString();
};

const buildCustomCheckoutReturnUrl = (appBaseUrl: string) => {
  const returnUrl = new URL("/checkout/payment", appBaseUrl);
  returnUrl.searchParams.set("checkout_return", "1");
  return returnUrl.toString();
};

export async function GET() {
  const authSession = await getServerSession(authOptions);
  const userId = authSession?.user?.id ?? null;
  const user = userId ? await loadCheckoutUser(userId) : null;
  const items = await readCartItems();
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
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          street: user.street,
          houseNumber: user.houseNumber,
          postalCode: user.postalCode,
          city: user.city,
          country: user.country,
          shippingAddressType: user.shippingAddressType,
          packstationNumber: user.packstationNumber,
          postNumber: user.postNumber,
          loyaltyPointsBalance: user.loyaltyPointsBalance,
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
  const authSession = await getServerSession(authOptions);
  const body = await req.json().catch(() => ({}));
  const checkoutMode =
    body?.mode === "custom" ? ("custom" as const) : ("hosted" as const);

  const stripe =
    checkoutMode === "custom" ? getCustomCheckoutStripe() : getStripe();
  if (!stripe) {
    return jsonNoStore(
      { error: "Stripe secret key not configured." },
      { status: 500 },
    );
  }
  const rawDiscountCode =
    typeof body?.discountCode === "string" ? body.discountCode.trim() : "";
  const useLoyaltyPoints = body?.useLoyaltyPoints === true;
  if (rawDiscountCode && rawDiscountCode.length > 64) {
    return jsonNoStore({ error: "Rabattcode ungueltig." }, { status: 400 });
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
    return jsonNoStore(
      { error: "E-Mail ist erforderlich." },
      { status: 400 },
    );
  }
  if (!checkoutFirstName || !checkoutLastName) {
    return jsonNoStore(
      { error: "Vorname und Nachname sind erforderlich." },
      { status: 400 },
    );
  }

  const normalizedShippingAddress = normalizeShippingAddress({
    shippingAddressType:
      typeof body?.shippingAddressType === "string"
        ? body.shippingAddressType
        : user?.shippingAddressType,
    street:
      typeof body?.street === "string"
        ? body.street
        : user?.street,
    houseNumber:
      typeof body?.houseNumber === "string"
        ? body.houseNumber
        : user?.houseNumber,
    postalCode:
      typeof body?.postalCode === "string"
        ? body.postalCode
        : user?.postalCode,
    city:
      typeof body?.city === "string"
        ? body.city
        : user?.city,
    country:
      typeof body?.country === "string"
        ? body.country
        : user?.country,
    packstationNumber:
      typeof body?.packstationNumber === "string"
        ? body.packstationNumber
        : user?.packstationNumber,
    postNumber:
      typeof body?.postNumber === "string"
        ? body.postNumber
        : user?.postNumber,
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
  const customerId = await createStripeCustomer(
    stripe,
    {
      email: checkoutEmail,
      name: user?.name ?? null,
      firstName: checkoutFirstName,
      lastName: checkoutLastName,
      shippingAddressType: normalizedShippingAddress.shippingAddressType,
      street: normalizedShippingAddress.street,
      houseNumber: normalizedShippingAddress.houseNumber,
      postalCode: normalizedShippingAddress.postalCode,
      city: normalizedShippingAddress.city,
      country: normalizedShippingAddress.country,
      packstationNumber: normalizedShippingAddress.packstationNumber,
      postNumber: normalizedShippingAddress.postNumber,
    },
    userId,
    country,
  );

  const items = await readCartItems();
  if (items.length === 0) {
    return jsonNoStore({ error: "Cart is empty." }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((item) => item.variantId) } },
    include: {
      product: { include: { images: { orderBy: { position: "asc" } } } },
    },
  });
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const cartSummaryItems: CheckoutCartSummaryItem[] = [];
  let subtotalCents = 0;
  const variantCounts = new Map<string, number>();

  for (const item of items) {
    const variant = variantMap.get(item.variantId);
    if (!variant) continue;
    const presentation = buildCheckoutItemPresentation(variant, item);
    const optionsMeta = serializeOptionsMetadata(presentation.selectedOptions);
    lineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: CURRENCY_CODE,
        unit_amount: variant.priceCents,
        product_data: {
          name:
            presentation.name.length > 127
              ? presentation.name.slice(0, 127)
              : presentation.name,
          images:
            presentation.imageUrl && presentation.imageUrl.startsWith("http")
              ? [presentation.imageUrl]
              : undefined,
          metadata: {
            variantId: variant.id,
            productId: variant.product.id,
            ...(optionsMeta ? { selectedOptions: optionsMeta } : {}),
          },
        },
      },
    });
    const lineTotalCents = variant.priceCents * item.quantity;
    subtotalCents += lineTotalCents;
    cartSummaryItems.push({
      imageUrl: presentation.imageUrl,
      lineTotalCents,
      name: presentation.name,
      quantity: item.quantity,
      variantId: variant.id,
    });
    variantCounts.set(
      variant.id,
      (variantCounts.get(variant.id) ?? 0) + item.quantity,
    );
  }

  if (lineItems.length === 0) {
    return jsonNoStore(
      { error: "No valid items in cart." },
      { status: 400 },
    );
  }

  const minOrderCents = toCents(MIN_ORDER_TOTAL_EUR);
  if (subtotalCents < minOrderCents) {
    return jsonNoStore(
      { error: `Mindestbestellwert ${MIN_ORDER_TOTAL_EUR.toFixed(2)} EUR.` },
      { status: 400 },
    );
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

  let promotionCodeId: string | undefined;
  let promotionDiscountCents = 0;
  let couponId: string | undefined;
  let appliedDiscountCode: string | undefined;
  if (rawDiscountCode) {
    const promotionCodes = await stripe.promotionCodes.list({
      code: rawDiscountCode,
      active: true,
      limit: 1,
    });
    const promotionCode = promotionCodes.data[0];
    if (!promotionCode || !promotionCode.active || !promotionCode.coupon?.valid) {
      return jsonNoStore(
        { error: "Rabattcode ungueltig." },
        { status: 400 },
      );
    }
    promotionCodeId = promotionCode.id;
    appliedDiscountCode = promotionCode.code ?? rawDiscountCode;
    promotionDiscountCents = getCouponDiscountPreviewCents(
      promotionCode.coupon,
      subtotalCents,
    );
  }

  const metadata: Record<string, string> = {
    country,
    shippingAddressType: normalizedShippingAddress.shippingAddressType,
  };
  if (orderSource.sourceStorefront) {
    metadata.sourceStorefront = orderSource.sourceStorefront;
  }
  if (orderSource.sourceHost) {
    metadata.sourceHost = orderSource.sourceHost;
  }
  if (orderSource.sourceOrigin) {
    metadata.sourceOrigin = orderSource.sourceOrigin;
  }
  if (appliedDiscountCode) {
    metadata.discountCode = appliedDiscountCode;
  }
  if (loyaltyPointsToRedeem > 0) {
    metadata.discountCode = `Smokeify Punkte (${loyaltyPointsToRedeem} Punkte)`;
    metadata.loyaltyPointsRedeemed = String(loyaltyPointsToRedeem);
    metadata.loyaltyDiscountAmount = String(loyaltyDiscountCents);
  }

  const guestCheckoutAccess = userId ? null : createGuestCheckoutAccess();
  if (guestCheckoutAccess) {
    metadata.guestCheckoutAccessHash = guestCheckoutAccess.tokenHash;
    metadata.guestCheckoutAccessExpiresAt = String(
      guestCheckoutAccess.expiresAt,
    );
  }
  const checkoutEditorToken =
    checkoutMode === "custom" ? randomUUID() : null;
  if (checkoutEditorToken) {
    metadata.checkoutEditorHash = hashCheckoutEditorToken(checkoutEditorToken);
  }

  const reservedVariants: Array<{ variantId: string; qty: number }> = [];
  const releaseReservation = async () => {
    if (reservedVariants.length === 0) return;
    await prisma.$transaction(async (tx) => {
      for (const { variantId, qty } of reservedVariants) {
        await tx.variantInventory.updateMany({
          where: { variantId, reserved: { gte: qty } },
          data: { reserved: { decrement: qty } },
        });
      }
    });
  };

  try {
    await prisma.$transaction(async (tx) => {
      for (const [variantId, qty] of variantCounts) {
        const updated = await tx.$executeRaw`
          UPDATE "VariantInventory"
          SET reserved = reserved + ${qty}
          WHERE "variantId" = ${variantId}
            AND ("quantityOnHand" - reserved) >= ${qty}
        `;
        if (updated === 0) {
          throw Object.assign(new Error("INSUFFICIENT_INVENTORY"), { variantId });
        }
        reservedVariants.push({ variantId, qty });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_INVENTORY") {
      return jsonNoStore({ error: "Nicht genug Bestand." }, { status: 409 });
    }
    throw error;
  }

  let checkoutSession: Stripe.Checkout.Session;
  const paymentMethodTypes = parseCheckoutPaymentMethodTypes();
  try {
    if (loyaltyDiscountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: loyaltyDiscountCents,
        currency: CURRENCY_CODE.toLowerCase(),
        duration: "once",
        name: `Smokeify Punkte ${loyaltyPointsToRedeem} Punkte`,
        metadata: {
          userId: userId ?? "",
          loyaltyPointsRedeemed: String(loyaltyPointsToRedeem),
        },
      });
      couponId = coupon.id;
    }

    const successUrl = buildCheckoutSuccessUrl(appBaseUrl, guestCheckoutAccess);
    const customReturnUrl = buildCustomCheckoutReturnUrl(appBaseUrl);

    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(checkoutMode === "custom"
        ? {
            ui_mode:
              "custom" as unknown as Stripe.Checkout.SessionCreateParams.UiMode,
          }
        : {
            payment_method_types: paymentMethodTypes,
          }),
      line_items: lineItems,
      discounts: promotionCodeId
        ? [{ promotion_code: promotionCodeId }]
        : couponId
          ? [{ coupon: couponId }]
          : undefined,
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : checkoutEmail,
      customer_update: customerId
        ? { address: "auto", name: "auto", shipping: "auto" }
        : undefined,
      client_reference_id: userId ?? undefined,
      shipping_address_collection:
        checkoutMode === "hosted"
          ? { allowed_countries: Array.from(ALLOWED_COUNTRIES) }
          : undefined,
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: "Versand",
            type: "fixed_amount",
            fixed_amount: {
              amount: shippingCents,
              currency: CURRENCY_CODE,
            },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        },
      ],
      automatic_tax: { enabled: true },
      success_url: checkoutMode === "hosted" ? successUrl : undefined,
      cancel_url:
        checkoutMode === "hosted"
          ? `${appBaseUrl}/order/rejected?reason=cancelled`
          : undefined,
      return_url: checkoutMode === "custom" ? customReturnUrl : undefined,
      metadata,
    });
  } catch (error) {
    await releaseReservation();
    throw error;
  }

  if (checkoutMode === "custom" && !checkoutSession.client_secret) {
    await releaseReservation();
    try {
      await stripe.checkout.sessions.expire(checkoutSession.id);
    } catch {
      // Ignore session expiration failures.
    }
    return jsonNoStore(
      { error: "Checkout konnte nicht initialisiert werden." },
      { status: 500 },
    );
  }

  if (loyaltyPointsToRedeem > 0 && userId) {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltyPointTransaction.findFirst({
          where: { reason: buildLoyaltyHoldReason(checkoutSession.id) },
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
            reason: buildLoyaltyHoldReason(checkoutSession.id),
            metadata: {
              sessionId: checkoutSession.id,
              loyaltyPointsRedeemed: loyaltyPointsToRedeem,
              loyaltyDiscountAmount: loyaltyDiscountCents,
              description: formatRedeemRateLabel(),
            },
          },
        });
      });
    } catch (error) {
      await releaseReservation();
      try {
        await stripe.checkout.sessions.expire(checkoutSession.id);
      } catch {
        // Ignore session expiration failures.
      }
      return jsonNoStore(
        {
          error:
            error instanceof Error &&
            error.message === "LOYALTY_POINTS_UNAVAILABLE"
              ? "Smokeify Punkte standen nicht mehr in ausreichender Höhe zur Verfügung."
              : "Smokeify Punkte konnten nicht reserviert werden.",
        },
        { status: 409 },
      );
    }
  }

  if (checkoutMode === "custom") {
    const effectiveDiscountCents = clampCheckoutDiscount(
      promotionDiscountCents + loyaltyDiscountCents,
      subtotalCents,
    );
    const summary: CheckoutSummarySnapshot = {
      currency: CURRENCY_CODE,
      discountCents: effectiveDiscountCents,
      items: cartSummaryItems,
      shippingCents,
      subtotalCents,
      totalCents: subtotalCents + shippingCents - effectiveDiscountCents,
    };
    const successUrl = buildCheckoutSuccessUrl(
      appBaseUrl,
      guestCheckoutAccess,
      checkoutSession.id,
    );

    return jsonNoStore({
      clientSecret: checkoutSession.client_secret,
      editToken: checkoutEditorToken,
      sessionId: checkoutSession.id,
      successUrl,
      summary,
    });
  }

  return jsonNoStore({ url: checkoutSession.url });
}
