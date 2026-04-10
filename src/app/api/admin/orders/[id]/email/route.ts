import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { getAppOrigin } from "@/lib/appOrigin";
import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";
import {
  buildOrderEmailSentAtUpdate,
  sendAdminOrderEmailById,
} from "@/lib/adminOrderEmail";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-order-email:ip:${ip}`,
    limit: 40,
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
    type?: "confirmation" | "shipping" | "refund";
  };
  const type = body.type;
  if (!type) {
    return adminJson({ error: "Missing email type" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    return adminJson({ error: "Order not found" }, { status: 404 });
  }

  let recipient: string;
  try {
    const result = await sendAdminOrderEmailById({
      orderId: id,
      type,
      requestOrigin: getAppOrigin(request),
    });
    recipient = result.recipient;
  } catch (error) {
    return adminJson(
      {
        error:
          error instanceof Error ? error.message : `Failed to send ${type} email.`,
      },
      { status: 400 },
    );
  }

  await prisma.order.update({
    where: { id },
    data: buildOrderEmailSentAtUpdate(type),
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "order.email.send",
    targetType: "order",
    targetId: id,
    summary: `Sent ${type} email for order #${order.orderNumber}`,
    metadata: {
      emailType: type,
      recipient,
      orderNumber: order.orderNumber,
    },
  });

  return adminJson({ ok: true });
}
