import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-returns:ip:${ip}`,
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
    status?: "APPROVED" | "REJECTED";
    adminNote?: string;
  };

  if (!body.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const requestRow = await prisma.returnRequest.findUnique({
    where: { id },
  });
  if (!requestRow) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: {
      status: body.status,
      adminNote: body.adminNote?.trim() || null,
    },
  });

  await prisma.order.update({
    where: { id: requestRow.orderId },
    data: {
      status:
        body.status === "APPROVED" ? "return_approved" : "return_rejected",
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "return.update",
    targetType: "return",
    targetId: id,
    summary: `Set return status to ${body.status}`,
    metadata: { orderId: requestRow.orderId, status: body.status },
  });

  return NextResponse.json({ request: updated });
}
