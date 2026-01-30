import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FREE_SHIPPING_THRESHOLD_EUR,
  MIN_ORDER_TOTAL_EUR,
  toCents,
} from "@/lib/checkoutPolicy";

export const runtime = "nodejs";

const CURRENCY_CODE = "EUR";
const COOKIE_NAME = "smokeify_cart";

const SHIPPING_BASE = {
  DE: 4.9,
  AT: 7.9,
  CH: 9.9,
  EU: 8.9,
  UK: 9.9,
  US: 12.9,
  OTHER: 12.9,
} as const;

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

type ShippingCountry = keyof typeof SHIPPING_BASE;
type CartItem = { variantId: string; quantity: number };

const getShippingEstimate = (country: ShippingCountry, itemCount: number) => {
  const base = SHIPPING_BASE[country] ?? SHIPPING_BASE.OTHER;
  const perItem = 0.5;
  return base + Math.max(itemCount, 0) * perItem;
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

const buildStripeAddress = (
  user: {
    street?: string | null;
    houseNumber?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  },
  fallbackCountry?: string | null
) => {
  const line1 = [user.street, user.houseNumber].filter(Boolean).join(" ").trim();
  const address: Stripe.AddressParam = {};
  if (line1) address.line1 = line1;
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
    street?: string | null;
    houseNumber?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  },
  userId: string,
  fallbackCountry?: string | null
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
    metadata: { userId },
  });
  return customer.id;
};
const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};


export async function POST(req: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawDiscountCode =
    typeof body?.discountCode === "string" ? body.discountCode.trim() : "";
  if (rawDiscountCode && rawDiscountCode.length > 64) {
    return NextResponse.json(
      { error: "Rabattcode ungueltig." },
      { status: 400 }
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: authSession.user.id },
    select: {
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
    },
  });
  const country = getSafeCountry(body?.country);
  const customerId = user
    ? await createStripeCustomer(stripe, user, authSession.user.id, country)
    : null;

  const items = await readCartItems();
  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((item) => item.variantId) } },
    include: {
      product: { include: { images: { orderBy: { position: "asc" } } } },
    },
  });
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let itemCount = 0;
  let subtotalCents = 0;
  const variantCounts = new Map<string, number>();

  for (const item of items) {
    const variant = variantMap.get(item.variantId);
    if (!variant) continue;
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
    const image = variant.product.images[0]?.url;
    lineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: CURRENCY_CODE,
        unit_amount: variant.priceCents,
        product_data: {
          name,
          images: image && image.startsWith("http") ? [image] : undefined,
          metadata: {
            variantId: variant.id,
            productId: variant.product.id,
          },
        },
      },
    });
    itemCount += item.quantity;
    subtotalCents += variant.priceCents * item.quantity;
    variantCounts.set(
      variant.id,
      (variantCounts.get(variant.id) ?? 0) + item.quantity
    );
  }

  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: "No valid items in cart." },
      { status: 400 }
    );
  }

  const minOrderCents = toCents(MIN_ORDER_TOTAL_EUR);
  if (subtotalCents < minOrderCents) {
    return NextResponse.json(
      {
        error: `Mindestbestellwert ${MIN_ORDER_TOTAL_EUR.toFixed(2)} EUR.`,
      },
      { status: 400 }
    );
  }

  const inventoryRows = await prisma.variantInventory.findMany({
    where: { variantId: { in: Array.from(variantCounts.keys()) } },
  });
  const inventoryByVariant = new Map(
    inventoryRows.map((row) => [row.variantId, row])
  );
  for (const [variantId, quantity] of variantCounts) {
    const inventory = inventoryByVariant.get(variantId);
    const available = Math.max(
      0,
      (inventory?.quantityOnHand ?? 0) - (inventory?.reserved ?? 0)
    );
    if (available < quantity) {
      return NextResponse.json(
        { error: "Nicht genug Bestand." },
        { status: 409 }
      );
    }
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  const shippingAmount = getShippingEstimate(country, itemCount);
  const freeShippingCents = toCents(FREE_SHIPPING_THRESHOLD_EUR);
  const shippingCents =
    subtotalCents >= freeShippingCents
      ? 0
      : Math.max(0, Math.round(shippingAmount * 100));

  let promotionCodeId: string | undefined;
  let appliedDiscountCode: string | undefined;
  if (rawDiscountCode) {
    const promotionCodes = await stripe.promotionCodes.list({
      code: rawDiscountCode,
      active: true,
      limit: 1,
    });
    const promotionCode = promotionCodes.data[0];
    if (!promotionCode || !promotionCode.active || !promotionCode.coupon?.valid) {
      return NextResponse.json(
        { error: "Rabattcode ungueltig." },
        { status: 400 }
      );
    }
    promotionCodeId = promotionCode.id;
    appliedDiscountCode = promotionCode.code ?? rawDiscountCode;
  }

  const metadata: Record<string, string> = { country };
  if (appliedDiscountCode) {
    metadata.discountCode = appliedDiscountCode;
  }

  let checkoutSession: Stripe.Checkout.Session;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      discounts: promotionCodeId
        ? [{ promotion_code: promotionCodeId }]
        : undefined,
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user?.email ?? undefined,
      customer_update: customerId
        ? { address: "auto", name: "auto", shipping: "auto" }
        : undefined,
      client_reference_id: authSession.user.id,
      shipping_address_collection: {
        allowed_countries: Array.from(ALLOWED_COUNTRIES),
      },
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
      success_url: `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?checkout=cancel`,
      metadata,
    });
  } catch (error) {
    throw error;
  }

  return NextResponse.json({ url: checkoutSession.url });
}
