import { createHash } from "crypto";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import {
  releaseLoyaltyHoldForSession,
  releaseReservedInventory,
} from "@/lib/stripeCheckoutReservations";

export const runtime = "nodejs";

const STRIPE_CUSTOM_CHECKOUT_API_VERSION = "2025-03-31.basil";

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

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, {
    apiVersion:
      STRIPE_CUSTOM_CHECKOUT_API_VERSION as unknown as Stripe.LatestApiVersion,
  });
};

const hashCheckoutEditorToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const readLineImage = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const maybeProduct = value as { images?: unknown };
  if (!Array.isArray(maybeProduct.images)) return null;
  const first = maybeProduct.images[0];
  return typeof first === "string" && first.trim() ? first : null;
};

const verifyCustomCheckoutSession = async (
  stripe: Stripe,
  sessionId: string,
  editToken: string,
) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge"],
  });
  const expectedHash = session.metadata?.checkoutEditorHash ?? "";
  if (!expectedHash || expectedHash !== hashCheckoutEditorToken(editToken)) {
    return null;
  }
  return session;
};

export async function GET(req: Request) {
  if (!isSameOrigin(req)) {
    return jsonNoStore({ error: "Forbidden" }, 403);
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit({
    key: `checkout-session-read:ip:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return jsonNoStore(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return jsonNoStore(
      { error: "Stripe secret key not configured." },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();
  const editToken = url.searchParams.get("editToken")?.trim();

  if (!sessionId || !editToken) {
    return jsonNoStore({ error: "Sessiondaten fehlen." }, { status: 400 });
  }

  const session = await verifyCustomCheckoutSession(stripe, sessionId, editToken);
  if (!session) {
    return jsonNoStore({ error: "Ungültige Session." }, 403);
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    expand: ["data.price.product"],
    limit: 100,
  });

  return jsonNoStore({
    paymentStatus: session.payment_status ?? null,
    paymentIntentStatus:
      typeof session.payment_intent === "object" && session.payment_intent
        ? session.payment_intent.status ?? null
        : null,
    status: session.status,
    summary: {
      currency: (session.currency ?? "eur").toUpperCase(),
      discountCents: session.total_details?.amount_discount ?? 0,
      items: lineItems.data.map((item) => ({
        imageUrl: readLineImage(item.price?.product),
        lineTotalCents: item.amount_total ?? 0,
        name: item.description ?? "Artikel",
        quantity: item.quantity ?? 0,
        variantId: typeof item.price?.id === "string" ? item.price.id : item.id,
      })),
      shippingCents: session.shipping_cost?.amount_total ?? 0,
      subtotalCents: session.amount_subtotal ?? 0,
      totalCents: session.amount_total ?? 0,
    },
  });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) {
    return jsonNoStore({ error: "Forbidden" }, 403);
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit({
    key: `checkout-session-expire:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return jsonNoStore(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return jsonNoStore(
      { error: "Stripe secret key not configured." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { editToken?: string; sessionId?: string }
    | null;
  const sessionId = body?.sessionId?.trim();
  const editToken = body?.editToken?.trim();

  if (!sessionId || !editToken) {
    return jsonNoStore({ error: "Sessiondaten fehlen." }, { status: 400 });
  }

  const session = await verifyCustomCheckoutSession(stripe, sessionId, editToken);
  if (!session) {
    return jsonNoStore({ error: "Ungültige Session." }, 403);
  }

  if (session.status === "complete") {
    return jsonNoStore({ ok: true });
  }

  if (session.status !== "expired") {
    try {
      await stripe.checkout.sessions.expire(sessionId);
    } catch (error) {
      return jsonNoStore(
        {
          error:
            error instanceof Error
              ? error.message
              : "Session konnte nicht beendet werden.",
        },
        { status: 400 },
      );
    }
  }

  await releaseReservedInventory(stripe, sessionId, {
    logMissingReservation: false,
  });
  await releaseLoyaltyHoldForSession(sessionId);

  return jsonNoStore({ ok: true });
}
