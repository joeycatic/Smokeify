import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-discount-update:ip:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
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

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    active?: boolean;
  };

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Active flag is required." }, { status: 400 });
  }

  const updated = await stripe.promotionCodes.update(id, {
    active: body.active,
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "discount.update",
    targetType: "discount",
    targetId: id,
    summary: `Set discount ${updated.code} active=${updated.active}`,
    metadata: { active: updated.active },
  });

  return NextResponse.json({ discount: mapPromotionCode(updated) });
}
