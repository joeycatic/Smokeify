import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { logOrderTimelineEvent } from "@/lib/orderTimeline";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

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
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    paymentStatus?: string;
    trackingCarrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  };

  const updates: {
    status?: string;
    paymentStatus?: string;
    trackingCarrier?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
  } = {};

  if (body.status) updates.status = body.status.trim();
  if (body.paymentStatus) updates.paymentStatus = body.paymentStatus.trim();
  if (typeof body.trackingCarrier !== "undefined") {
    updates.trackingCarrier = body.trackingCarrier?.trim() || null;
  }
  if (typeof body.trackingNumber !== "undefined") {
    updates.trackingNumber = body.trackingNumber?.trim() || null;
  }
  if (typeof body.trackingUrl !== "undefined") {
    updates.trackingUrl = body.trackingUrl?.trim() || null;
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
    summary: `Updated order fields: ${Object.keys(updates).join(", ")}`,
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
  if (
    typeof updates.paymentStatus === "string" &&
    updates.paymentStatus !== existing.paymentStatus
  ) {
    await logOrderTimelineEvent({
      actor: { id: session.user.id, email: session.user.email ?? null },
      orderId: id,
      action: "order.lifecycle.payment_status_changed",
      summary: `Payment status changed: ${existing.paymentStatus} -> ${updates.paymentStatus}`,
      metadata: {
        previousPaymentStatus: existing.paymentStatus,
        nextPaymentStatus: updates.paymentStatus,
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
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
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
