import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import { buildAdminOrderPatch } from "@/lib/adminOrderUpdate";
import { adminJson } from "@/lib/adminApi";
import { loadAdminOrderDetail } from "@/lib/adminOrders";
import {
  buildOrderEmailSentAtUpdate,
  sendAdminOrderEmailForOrder,
} from "@/lib/adminOrderEmail";
import { getAppOrigin } from "@/lib/appOrigin";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(async ({ params }) => {
  const detail = await loadAdminOrderDetail(params.id);
  if (!detail) {
    return adminJson({ error: "Order not found" }, { status: 404 });
  }

  return adminJson(detail);
});

export const PATCH = withAdminRoute(
  async ({ request, params, session }) => {
    const { id } = params;
    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      paymentStatus?: string;
      trackingCarrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      expectedUpdatedAt?: string;
    };

  let updates: ReturnType<typeof buildAdminOrderPatch>["updates"];
  let changedFields: string[];

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) {
    return adminJson({ error: "Order not found" }, { status: 404 });
  }

  try {
    const patch = buildAdminOrderPatch(body, { currentStatus: existing.status });
    updates = patch.updates;
    changedFields = patch.changedFields;
  } catch (error) {
    return adminJson(
      {
        error:
          error instanceof Error ? error.message : "Invalid order update payload.",
      },
      { status: 400 },
    );
  }

  if (!Object.keys(updates).length) {
    return adminJson({ error: "No updates provided" }, { status: 400 });
  }

  if (
    body.expectedUpdatedAt &&
    existing.updatedAt.toISOString() !== body.expectedUpdatedAt
  ) {
    return adminJson(
      {
        error:
          "This order was updated by another admin. Refresh the latest order before saving again.",
        currentUpdatedAt: existing.updatedAt.toISOString(),
      },
      { status: 409 }
    );
  }

  const nextTrackingNumber =
    typeof updates.trackingNumber !== "undefined"
      ? updates.trackingNumber
      : existing.trackingNumber;
  const nextTrackingUrl =
    typeof updates.trackingUrl !== "undefined"
      ? updates.trackingUrl
      : existing.trackingUrl;
  const hasTrackingAfterUpdate = Boolean(
    nextTrackingNumber?.trim() || nextTrackingUrl?.trim(),
  );
  const normalizedExistingStatus = existing.status.trim().toLowerCase();
  const normalizedNextStatus = (updates.status ?? existing.status).trim().toLowerCase();

  const shouldAutoMarkShipped =
    !updates.status &&
    hasTrackingAfterUpdate &&
    !["shipped", "fulfilled", "refunded", "canceled", "cancelled", "failed"].includes(
      normalizedExistingStatus,
    );

  if (shouldAutoMarkShipped) {
    updates.status = "shipped";
    changedFields.push("status");
  }

  const updated = await prisma.order.update({
    where: { id },
    data: updates,
    include: { items: true },
  });

  let warning: string | undefined;
  const shouldSendShippingEmail =
    !existing.shippingEmailSentAt &&
    hasTrackingAfterUpdate &&
    (updates.status === "shipped" || normalizedNextStatus === "shipped");

  if (shouldSendShippingEmail) {
    try {
      const emailResult = await sendAdminOrderEmailForOrder({
        order: updated,
        type: "shipping",
        requestOrigin: getAppOrigin(request),
      });
      await prisma.order.update({
        where: { id },
        data: buildOrderEmailSentAtUpdate("shipping"),
      });
      updated.shippingEmailSentAt = new Date();
      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "order.email.send",
        targetType: "order",
        targetId: id,
        summary: `Sent shipping email for order #${updated.orderNumber}`,
        metadata: {
          emailType: "shipping",
          recipient: emailResult.recipient,
          orderNumber: updated.orderNumber,
          source: "admin.orders.patch",
        },
      });
    } catch (error) {
      warning =
        error instanceof Error
          ? `Order saved, but the shipping email could not be sent: ${error.message}`
          : "Order saved, but the shipping email could not be sent.";
    }
  }

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "order.update",
    targetType: "order",
    targetId: id,
    summary: `Updated order fields: ${changedFields.join(", ")}`,
    metadata: { updates },
  });
  if (typeof updates.status === "string" && updates.status !== existing.status) {
    await logOrderTimelineEvent({
      actor: { id: session.user.id, email: session.user.email ?? null },
      orderId: id,
      action: "order.lifecycle.status_changed",
      summary: `Status changed: ${existing.status} -> ${updates.status}`,
      metadata: {
        previousStatus: existing.status,
        nextStatus: updates.status,
        source: "admin.orders.patch",
      },
    });
  }
    return adminJson({ order: updated, warning });
  },
  {
    action: "order.fulfillment.update",
    rateLimit: {
      keyPrefix: "admin-order-update",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);

export const DELETE = withAdminRoute(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      confirmation?: string;
    };
    if (body.confirmation !== "DELETE") {
      return adminJson({ error: 'Bestätigung fehlt. Bitte "DELETE" eingeben.' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true, orderNumber: true },
    });
    if (!existing) {
      return adminJson({ error: "Order not found" }, { status: 404 });
    }

    await prisma.order.delete({ where: { id: params.id } });

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "order.delete",
      targetType: "order",
      targetId: params.id,
      summary: `Deleted order #${existing.orderNumber}`,
      metadata: { orderNumber: existing.orderNumber },
    });

    return adminJson({ ok: true });
  },
  {
    rateLimit: {
      keyPrefix: "admin-order-delete",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    },
  },
);
