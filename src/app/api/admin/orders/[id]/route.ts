import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { buildAdminOrderPatch } from "@/lib/adminOrderUpdate";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-order-update:ip:${ip}`,
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

  const { id } = await context.params;
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
  try {
    const patch = buildAdminOrderPatch(body);
    updates = patch.updates;
    changedFields = patch.changedFields;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid order update payload.",
      },
      { status: 400 },
    );
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (
    body.expectedUpdatedAt &&
    existing.updatedAt.toISOString() !== body.expectedUpdatedAt
  ) {
    return NextResponse.json(
      {
        error:
          "This order was updated by another admin. Refresh the latest order before saving again.",
        currentUpdatedAt: existing.updatedAt.toISOString(),
      },
      { status: 409 }
    );
  }

  const updated = await prisma.order.update({
    where: { id },
    data: updates,
    include: { items: true },
  });

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
  return NextResponse.json({ order: updated });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-order-delete:ip:${ip}`,
    limit: 20,
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

  const body = (await request.json().catch(() => ({}))) as {
    confirmation?: string;
  };
  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: 'Bestätigung fehlt. Bitte "DELETE" eingeben.' },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await prisma.order.delete({ where: { id } });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "order.delete",
    targetType: "order",
    targetId: id,
    summary: `Deleted order #${existing.orderNumber}`,
    metadata: { orderNumber: existing.orderNumber },
  });

  return NextResponse.json({ ok: true });
}
