import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMobileToken } from "@/lib/mobileToken";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

type Plan = "monthly" | "yearly";

const PREMIUM_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

const getPriceIdForPlan = (plan: Plan, bodyPriceId?: string) => {
  const configured =
    plan === "monthly"
      ? process.env.MOBILE_PREMIUM_PRICE_MONTHLY_ID
      : process.env.MOBILE_PREMIUM_PRICE_YEARLY_ID;
  return (bodyPriceId?.trim() || configured || "").trim();
};

const getOrCreateCustomer = async (stripe: Stripe, user: { id: string; email: string; name?: string | null }) => {
  const existing = await stripe.customers.list({
    email: user.email,
    limit: 1,
  });
  if (existing.data[0]) {
    return existing.data[0];
  }

  return stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: {
      mobileUserId: user.id,
    },
  });
};

export async function POST(request: Request) {
  const payload = parseMobileToken(request.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-subscription-intent:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    plan?: Plan;
    priceId?: string;
  };
  const plan: Plan = body.plan === "yearly" ? "yearly" : "monthly";
  const priceId = getPriceIdForPlan(plan, body.priceId);
  if (!priceId) {
    return NextResponse.json(
      { error: "Premium price id not configured." },
      { status: 500 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.name ||
    user.email;

  const customer = await getOrCreateCustomer(stripe, {
    id: user.id,
    email: user.email,
    name: displayName,
  });

  const activeSubs = await stripe.subscriptions.list({
    customer: customer.id,
    status: "all",
    limit: 20,
  });
  const hasPremiumAlready = activeSubs.data.some((sub) =>
    PREMIUM_STATUSES.has(sub.status),
  );
  if (hasPremiumAlready) {
    return NextResponse.json(
      { error: "Premium already active." },
      { status: 409 },
    );
  }

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    collection_method: "charge_automatically",
    metadata: {
      mobileUserId: user.id,
      mobilePlan: plan,
    },
    expand: ["latest_invoice.payment_intent"],
  });

  const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
  const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;
  const clientSecret = paymentIntent?.client_secret ?? null;

  if (!clientSecret) {
    return NextResponse.json(
      { error: "No payment intent client secret available." },
      { status: 500 },
    );
  }

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: "2024-06-20" },
  );

  return NextResponse.json({
    clientSecret,
    customerId: customer.id,
    ephemeralKey: ephemeralKey.secret,
    merchantDisplayName: "Smokeify Premium",
    returnUrl: process.env.MOBILE_STRIPE_RETURN_URL ?? "smokeify://premium-return",
  });
}
