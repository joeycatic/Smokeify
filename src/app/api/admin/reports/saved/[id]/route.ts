import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  computeNextAdminReportDelivery,
  parseAdminReportDeliveryFrequency,
  parseAdminReportDeliveryHour,
  parseAdminReportDeliveryWeekday,
} from "@/lib/adminReportDelivery";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.adminSavedReport.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    deliveryEnabled?: unknown;
    deliveryEmail?: unknown;
    deliveryFrequency?: unknown;
    deliveryWeekday?: unknown;
    deliveryHour?: unknown;
  };

  const deliveryEnabled = body.deliveryEnabled === true;
  if (!deliveryEnabled) {
    const updated = await prisma.adminSavedReport.update({
      where: { id },
      data: {
        deliveryEnabled: false,
        deliveryEmail: null,
        deliveryFrequency: null,
        deliveryWeekday: null,
        deliveryHour: null,
        nextDeliveryAt: null,
      },
    });

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "admin_report.schedule_disabled",
      targetType: "admin_saved_report",
      targetId: id,
      summary: `Disabled scheduled delivery for ${updated.name}`,
    });

    return NextResponse.json({ report: updated });
  }

  const deliveryEmail =
    typeof body.deliveryEmail === "string" ? body.deliveryEmail.trim().toLowerCase() : "";
  if (!deliveryEmail) {
    return NextResponse.json({ error: "Delivery email is required." }, { status: 400 });
  }

  const deliveryFrequency = parseAdminReportDeliveryFrequency(
    typeof body.deliveryFrequency === "string" ? body.deliveryFrequency : null
  );
  if (!deliveryFrequency) {
    return NextResponse.json({ error: "Delivery frequency is invalid." }, { status: 400 });
  }

  const deliveryHour = parseAdminReportDeliveryHour(body.deliveryHour);
  if (deliveryHour === null) {
    return NextResponse.json({ error: "Delivery hour must be between 0 and 23." }, { status: 400 });
  }

  const deliveryWeekday =
    deliveryFrequency === "WEEKLY"
      ? parseAdminReportDeliveryWeekday(body.deliveryWeekday)
      : null;
  if (deliveryFrequency === "WEEKLY" && deliveryWeekday === null) {
    return NextResponse.json({ error: "Select a weekday for weekly delivery." }, { status: 400 });
  }

  const nextDeliveryAt = computeNextAdminReportDelivery({
    frequency: deliveryFrequency,
    hour: deliveryHour,
    weekday: deliveryWeekday,
  });

  const updated = await prisma.adminSavedReport.update({
    where: { id },
    data: {
      deliveryEnabled: true,
      deliveryEmail,
      deliveryFrequency,
      deliveryWeekday,
      deliveryHour,
      nextDeliveryAt,
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "admin_report.schedule_updated",
    targetType: "admin_saved_report",
    targetId: id,
    summary: `Scheduled delivery for ${updated.name}`,
    metadata: {
      deliveryEmail,
      deliveryFrequency,
      deliveryWeekday,
      deliveryHour,
      nextDeliveryAt: nextDeliveryAt.toISOString(),
    },
  });

  return NextResponse.json({ report: updated });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.adminSavedReport.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  await prisma.adminSavedReport.delete({ where: { id } });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "admin_report.delete",
    targetType: "admin_saved_report",
    targetId: id,
    summary: `Deleted report ${existing.name}`,
  });

  return NextResponse.json({ ok: true });
}
