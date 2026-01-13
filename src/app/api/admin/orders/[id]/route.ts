import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

  const trackingUpdated =
    (updates.trackingCarrier || updates.trackingNumber || updates.trackingUrl) &&
    (!existing.trackingCarrier &&
      !existing.trackingNumber &&
      !existing.trackingUrl);

  if (trackingUpdated && updated.customerEmail) {
    try {
      const origin =
        request.headers.get("origin") ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";
      const orderUrl = `${origin}/account/orders/${updated.id}`;
      const email = buildOrderEmail("shipping", updated, orderUrl);
      await sendResendEmail({
        to: updated.customerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch {
      // Ignore email errors for admin updates.
    }
  }

  return NextResponse.json({ order: updated });
}
