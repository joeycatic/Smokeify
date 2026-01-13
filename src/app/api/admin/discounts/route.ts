import Stripe from "stripe";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeCurrency = (value: unknown) => {
  if (typeof value !== "string") return "EUR";
  const trimmed = value.trim().toUpperCase();
  return trimmed.length === 3 ? trimmed : "EUR";
};

const mapPromotionCode = (promotion: Stripe.PromotionCode) => ({
  id: promotion.id,
  code: promotion.code,
  active: promotion.active,
  maxRedemptions: promotion.max_redemptions ?? null,
  timesRedeemed: promotion.times_redeemed ?? 0,
  expiresAt: promotion.expires_at ?? null,
  createdAt: promotion.created
    ? new Date(promotion.created * 1000).toISOString()
    : null,
  coupon: {
    id: promotion.coupon?.id ?? null,
    percentOff: promotion.coupon?.percent_off ?? null,
    amountOff: promotion.coupon?.amount_off ?? null,
    currency: promotion.coupon?.currency ?? null,
    duration: promotion.coupon?.duration ?? null,
    durationInMonths: promotion.coupon?.duration_in_months ?? null,
    valid: promotion.coupon?.valid ?? null,
  },
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const promotionCodes = await stripe.promotionCodes.list({
    limit: 100,
    expand: ["data.coupon"],
  });

  return NextResponse.json({
    discounts: promotionCodes.data.map(mapPromotionCode),
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    percentOff?: number | string;
    amountOffCents?: number | string;
    currency?: string;
    maxRedemptions?: number | string;
    expiresAt?: number | string;
  };

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const percentOff = toNumber(body.percentOff);
  const amountOffCents = toNumber(body.amountOffCents);
  if (!percentOff && !amountOffCents) {
    return NextResponse.json(
      { error: "Either percentOff or amountOffCents is required." },
      { status: 400 }
    );
  }
  if (percentOff && (percentOff <= 0 || percentOff > 100)) {
    return NextResponse.json(
      { error: "percentOff must be between 1 and 100." },
      { status: 400 }
    );
  }
  if (amountOffCents && amountOffCents <= 0) {
    return NextResponse.json(
      { error: "amountOffCents must be greater than 0." },
      { status: 400 }
    );
  }

  const currency = normalizeCurrency(body.currency);
  const maxRedemptions = toNumber(body.maxRedemptions);
  const expiresAt = toNumber(body.expiresAt);

  const coupon = await stripe.coupons.create({
    percent_off: percentOff ?? undefined,
    amount_off: amountOffCents ?? undefined,
    currency: amountOffCents ? currency.toLowerCase() : undefined,
    duration: "once",
  });

  const promotionCode = await stripe.promotionCodes.create({
    code,
    coupon: coupon.id,
    max_redemptions: maxRedemptions ? Math.floor(maxRedemptions) : undefined,
    expires_at: expiresAt ? Math.floor(expiresAt) : undefined,
    active: true,
  });

  return NextResponse.json({ discount: mapPromotionCode(promotionCode) });
}
