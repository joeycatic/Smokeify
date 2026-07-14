import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { cancelPendingCheckoutPaymentDraft } from "@/lib/paymentCheckoutReservations";

export const runtime = "nodejs";

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

const loadDraft = (paymentOrderCode: string) =>
  prisma.checkoutPaymentDraft.findUnique({
    where: { paymentOrderCode },
    select: {
      id: true,
      amountDiscount: true,
      amountShipping: true,
      amountSubtotal: true,
      amountTotal: true,
      currency: true,
      editTokenHash: true,
      items: true,
      paymentOrderCode: true,
      paymentStatus: true,
      status: true,
    },
  });

const verifyDraft = async (paymentOrderCode: string, editToken: string) => {
  const draft = await loadDraft(paymentOrderCode);
  if (!draft?.editTokenHash) return null;
  if (draft.editTokenHash !== hashCheckoutEditorToken(editToken)) return null;
  return draft;
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

  const url = new URL(req.url);
  const paymentOrderCode = url.searchParams.get("sessionId")?.trim();
  const editToken = url.searchParams.get("editToken")?.trim();

  if (!paymentOrderCode || !editToken) {
    return jsonNoStore({ error: "Sessiondaten fehlen." }, { status: 400 });
  }

  const draft = await verifyDraft(paymentOrderCode, editToken);
  if (!draft) {
    return jsonNoStore({ error: "Ungültige Session." }, 403);
  }

  return jsonNoStore({
    paymentStatus: draft.paymentStatus,
    status: draft.status,
    summary: {
      currency: draft.currency,
      discountCents: draft.amountDiscount,
      items: Array.isArray(draft.items) ? draft.items : [],
      shippingCents: draft.amountShipping,
      subtotalCents: draft.amountSubtotal,
      totalCents: draft.amountTotal,
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

  const body = (await req.json().catch(() => null)) as
    | { editToken?: string; sessionId?: string }
    | null;
  const paymentOrderCode = body?.sessionId?.trim();
  const editToken = body?.editToken?.trim();

  if (!paymentOrderCode || !editToken) {
    return jsonNoStore({ error: "Sessiondaten fehlen." }, { status: 400 });
  }

  const draft = await loadDraft(paymentOrderCode);
  if (!draft) {
    return jsonNoStore({ ok: true });
  }
  if (draft.editTokenHash !== hashCheckoutEditorToken(editToken)) {
    return jsonNoStore({ error: "Ungültige Session." }, 403);
  }

  await cancelPendingCheckoutPaymentDraft(draft);

  return jsonNoStore({ ok: true });
}
