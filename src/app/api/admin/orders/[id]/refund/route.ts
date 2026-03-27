import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import bcrypt from "bcryptjs";
import { getAppOrigin } from "@/lib/appOrigin";
import { adminJson } from "@/lib/adminApi";
import { refundAdminOrder } from "@/lib/adminRefunds";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-order-refund:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return adminJson(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const body = (await request.json().catch(() => ({}))) as {
    items?: Array<{ id: string; quantity?: number }>;
    amount?: number;
    includeShipping?: boolean;
    adminPassword?: string;
  };
  const includeShipping = body.includeShipping === true;
  const adminPassword = body.adminPassword?.trim();
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!admin?.passwordHash) {
    return adminJson(
      { error: "Passwort erforderlich." },
      { status: 400 }
    );
  }
  if (!adminPassword) {
    return adminJson(
      { error: "Passwort erforderlich." },
      { status: 400 }
    );
  }
  const validPassword = await bcrypt.compare(adminPassword, admin.passwordHash);
  if (!validPassword) {
    return adminJson({ error: "Passwort ist falsch." }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    return adminJson({ error: "Order not found" }, { status: 404 });
  }
  if (order.paymentStatus === "refunded") {
    return adminJson(
      { error: "Order already refunded" },
      { status: 409 }
    );
  }
  if (!order.stripePaymentIntent) {
    return adminJson(
      { error: "Missing payment intent" },
      { status: 400 }
    );
  }

  let refundAmount = 0;
  let shippingRefundAmount = 0;

  if (Array.isArray(body.items) && body.items.length > 0) {
    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    for (const requestItem of body.items) {
      const item = itemMap.get(requestItem.id);
      if (!item) continue;
      const requestedQty = Math.max(1, Number(requestItem.quantity ?? 1));
      const qty = Math.min(requestedQty, item.quantity);
      refundAmount += item.unitAmount * qty;
    }
  } else if (Number.isFinite(body.amount)) {
    refundAmount = Math.max(0, Math.floor(Number(body.amount)));
  } else {
    refundAmount = order.amountTotal - order.amountRefunded;
  }

  if (includeShipping) {
    const remaining = Math.max(0, order.amountTotal - order.amountRefunded);
    const remainingAfterBase = Math.max(0, remaining - refundAmount);
    shippingRefundAmount = Math.min(order.amountShipping, remainingAfterBase);
    refundAmount += shippingRefundAmount;
  }

  if (refundAmount <= 0) {
    return adminJson(
      { error: "Refund amount must be greater than zero" },
      { status: 400 }
    );
  }

  const remaining = Math.max(0, order.amountTotal - order.amountRefunded);
  if (refundAmount > remaining) {
    return adminJson(
      { error: "Refund amount exceeds remaining balance" },
      { status: 400 }
    );
  }

  try {
    const result = await refundAdminOrder({
      orderId: order.id,
      refundAmount,
      includeShipping,
      shippingRefundAmount,
      actor: { id: session.user.id, email: session.user.email ?? null },
      source: "admin.orders.refund",
      origin: getAppOrigin(request),
    });

    return adminJson({ order: result.updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed";
    const status =
      message === "Stripe secret key not configured."
        ? 500
        : message === "Order not found"
          ? 404
          : message === "Order already refunded"
            ? 409
            : message === "Missing payment intent" ||
                message === "Refund amount must be greater than zero" ||
                message === "Refund amount exceeds remaining balance"
              ? 400
              : 500;
    return adminJson({ error: message }, { status });
  }
}
