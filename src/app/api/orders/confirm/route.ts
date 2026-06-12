import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyGuestCheckoutAccess } from "@/lib/checkoutAccess";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { buildReceiptUrl } from "@/lib/receiptLink";
import { isSameOrigin } from "@/lib/requestSecurity";
import { getAppOrigin } from "@/lib/appOrigin";
import { createOrderFromVivaDraft } from "@/lib/vivaOrderFulfillment";
import { normalizeVivaStatus, retrieveVivaTransaction } from "@/lib/viva";

export const runtime = "nodejs";

type OrderWithItems = NonNullable<
  Awaited<ReturnType<typeof prisma.order.findFirst>>
> & {
  items: Array<{
    currency: string;
    id: string;
    imageUrl: string | null;
    name: string;
    options: unknown;
    productId: string | null;
    quantity: number;
    totalAmount: number;
    unitAmount: number;
    variantId: string | null;
  }>;
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

const enrichItemsWithManufacturer = async <
  T extends { options?: unknown; productId?: string | null }
>(
  items: T[],
): Promise<Array<T & { manufacturer: string | null; options: Array<{ name: string; value: string }> }>> => {
  const productIds = Array.from(
    new Set(items.map((item) => item.productId).filter(Boolean)),
  ) as string[];
  const products = await prisma.product.findMany({
    where: productIds.length ? { id: { in: productIds } } : { id: "__none__" },
    select: { id: true, manufacturer: true },
  });
  const manufacturerMap = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null]),
  );

  return items.map((item) => ({
    ...item,
    manufacturer: item.productId ? manufacturerMap.get(item.productId) ?? null : null,
    options: normalizeOptions(item.options),
  }));
};

const serializeOrder = async (order: OrderWithItems | null, request: Request) => {
  if (!order) return null;
  const origin = getAppOrigin(request);
  const items = await enrichItemsWithManufacturer(
    order.items.map((item) => ({
      ...item,
      options: normalizeOptions(item.options),
    })),
  );
  return {
    id: order.id,
    createdAt: order.createdAt,
    amountSubtotal: order.amountSubtotal,
    amountTax: order.amountTax,
    amountShipping: order.amountShipping,
    amountDiscount: order.amountDiscount,
    amountTotal: order.amountTotal,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    status: order.status,
    discountCode: order.discountCode,
    customerEmail: order.customerEmail,
    shippingName: order.shippingName,
    shippingLine1: order.shippingLine1,
    shippingLine2: order.shippingLine2,
    shippingPostalCode: order.shippingPostalCode,
    shippingCity: order.shippingCity,
    shippingCountry: order.shippingCountry,
    invoiceUrl: buildInvoiceUrl(origin, order.id),
    receiptUrl: order.stripePaymentIntent ? buildReceiptUrl(origin, order.id) : null,
    items,
  };
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "Forbidden" }, 403);
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `order-confirm:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return jsonNoStore(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const session = await getServerSession(authOptions);
  const body = (await request.json().catch(() => ({}))) as {
    guestExpires?: number | string;
    guestToken?: string;
    orderCode?: string;
    sessionId?: string;
    transactionId?: string;
  };
  const paymentOrderCode = (body.orderCode ?? body.sessionId ?? "").trim();
  const transactionId = body.transactionId?.trim();
  const guestToken = body.guestToken?.trim() ?? "";
  const guestExpiresRaw =
    typeof body.guestExpires === "number" || typeof body.guestExpires === "string"
      ? Number(body.guestExpires)
      : NaN;
  if (!paymentOrderCode) {
    return jsonNoStore({ error: "Missing order code." }, 400);
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const userId = session?.user?.id ?? null;

  const existing = await prisma.order.findFirst({
    where: {
      OR: [
        { paymentOrderCode },
        { stripeSessionId: paymentOrderCode },
      ],
    },
    include: { items: true },
  });
  if (existing) {
    if (existing.userId && !isAdmin && existing.userId !== userId) {
      return jsonNoStore({ error: "Forbidden." }, 403);
    }
    return jsonNoStore({ ok: true, order: await serializeOrder(existing, request) });
  }

  const draft = await prisma.checkoutPaymentDraft.findUnique({
    where: { paymentOrderCode },
  });
  if (!draft) {
    return jsonNoStore({ error: "Checkout not found." }, 404);
  }
  if (draft.userId && !isAdmin && draft.userId !== userId) {
    return jsonNoStore({ error: "Forbidden." }, 403);
  }
  if (!draft.userId && !isAdmin && !userId) {
    const expectedExpires = Number(draft.guestCheckoutAccessExpiresAt ?? NaN);
    const authorized = verifyGuestCheckoutAccess({
      expectedHash: draft.guestCheckoutAccessHash,
      expiresAt: guestExpiresRaw,
      token: guestToken,
    });
    if (!authorized || expectedExpires !== guestExpiresRaw) {
      return jsonNoStore({ error: "Unauthorized" }, 401);
    }
  }

  if (!transactionId && draft.paymentStatus !== "paid") {
    return jsonNoStore(
      { ok: true, paymentStatus: draft.paymentStatus, pending: true },
      { status: 202 },
    );
  }

  const transaction = transactionId
    ? await retrieveVivaTransaction(transactionId).catch(() => null)
    : null;
  if (transaction && normalizeVivaStatus(transaction.statusId) === "paid") {
    const order = await createOrderFromVivaDraft({ draft, request, transaction });
    if (order) {
      const reloaded = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
      return jsonNoStore({ ok: true, order: await serializeOrder(reloaded, request) });
    }
  }

  return jsonNoStore(
    { ok: true, paymentStatus: draft.paymentStatus, pending: true },
    { status: 202 },
  );
}
