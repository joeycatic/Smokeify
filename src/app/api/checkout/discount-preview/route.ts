import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { FREE_SHIPPING_THRESHOLD_EUR, toCents } from "@/lib/checkoutPolicy";
import { getShippingAmount, SHIPPING_BASE, type ShippingCountry } from "@/lib/shippingPolicy";
import { resolveCartItemsForRequest } from "@/lib/serverCartStorage";
import { findRedeemableDiscountCode, normalizeDiscountCode } from "@/lib/discountCodes";

export const runtime = "nodejs";

const CURRENCY_CODE = "EUR";
const MAX_DISCOUNT_CODE_LENGTH = 64;

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
};

const jsonNoStore = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: noStoreHeaders });

const getSafeCountry = (value: unknown): ShippingCountry => {
  const raw = String(value ?? "").toUpperCase();
  return raw in SHIPPING_BASE ? (raw as ShippingCountry) : "DE";
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "Forbidden" }, 403);
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `checkout-discount-preview:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return jsonNoStore(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      429,
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    country?: unknown;
    discountCode?: unknown;
  };
  const rawDiscountCode =
    typeof body.discountCode === "string" ? body.discountCode.trim() : "";
  const code = normalizeDiscountCode(rawDiscountCode);
  const country = getSafeCountry(body.country);

  if (!code || code.length > MAX_DISCOUNT_CODE_LENGTH) {
    return jsonNoStore({
      valid: false,
      code,
      discountCents: 0,
      message: "Rabattcode ungültig.",
      currency: CURRENCY_CODE,
    });
  }

  const authSession = await getServerSession(authOptions);
  const userId = authSession?.user?.id ?? null;
  const items = await resolveCartItemsForRequest(userId);
  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((item) => item.variantId) } },
    select: { id: true, priceCents: true },
  });
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const subtotalCents = items.reduce((sum, item) => {
    const variant = variantMap.get(item.variantId);
    return variant ? sum + variant.priceCents * item.quantity : sum;
  }, 0);
  const shippingCents =
    subtotalCents >= toCents(FREE_SHIPPING_THRESHOLD_EUR)
      ? 0
      : Math.max(0, Math.round(getShippingAmount(country) * 100));

  if (subtotalCents <= 0) {
    return jsonNoStore({
      valid: false,
      code,
      discountCents: 0,
      subtotalCents,
      shippingCents,
      totalCents: subtotalCents + shippingCents,
      message: "Dein Warenkorb ist leer.",
      currency: CURRENCY_CODE,
    });
  }

  const promotionCode = await findRedeemableDiscountCode({
    code,
    customerEmail: authSession?.user?.email,
    currency: CURRENCY_CODE,
    subtotalCents,
  });
  const discountCents = promotionCode?.discountCents ?? 0;

  return jsonNoStore({
    valid: Boolean(promotionCode),
    code: promotionCode?.discount.code ?? code,
    discountCents,
    subtotalCents,
    shippingCents,
    totalCents: Math.max(0, subtotalCents + shippingCents - discountCents),
    message: promotionCode
      ? "Rabattcode wurde geprüft und angewendet."
      : "Rabattcode ungültig oder abgelaufen.",
    currency: CURRENCY_CODE,
  });
}
