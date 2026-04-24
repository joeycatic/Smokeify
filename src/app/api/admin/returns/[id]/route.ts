import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  calculateReturnRequestAmountCents,
  getReturnOrderStatus,
} from "@/lib/adminReturns";
import { verifyAdminPassword } from "@/lib/adminUserGovernance";
import { refundAdminOrder } from "@/lib/adminRefunds";
import { getAppOrigin } from "@/lib/appOrigin";
import { issueAdminStoreCredit } from "@/lib/adminStoreCredit";
import { buildReturnStoreCreditReason } from "@/lib/storeCredit";
import { createAdminExchangeOrder } from "@/lib/adminExchanges";
import {
  ensureReturnRequestSupportCase,
  updateAdminSupportCase,
} from "@/lib/adminSupport";

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
      { error: "Zu viele Anfragen. Bitte spater erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: "APPROVED" | "REJECTED";
    adminNote?: string;
    adminPassword?: string;
  };

  if (!body.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const requestRow = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          amountRefunded: true,
          amountTotal: true,
          currency: true,
        },
      },
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              name: true,
              unitAmount: true,
            },
          },
        },
      },
    },
  });
  if (!requestRow) {
    return NextResponse.json({ error: "Return request not found" }, { status: 404 });
  }
  if (requestRow.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only pending return requests can be resolved." },
      { status: 409 }
    );
  }

  const adminNote = body.adminNote?.trim() || null;
  const returnAmountCents = calculateReturnRequestAmountCents(
    requestRow.items.map((item) => ({
      quantity: item.quantity,
      unitAmount: item.orderItem.unitAmount,
    }))
  );

  if (body.status === "APPROVED") {
    const validPassword = await verifyAdminPassword(
      session.user.id,
      typeof body.adminPassword === "string" ? body.adminPassword : ""
    );
    if (!validPassword) {
      return NextResponse.json({ error: "Passwort ist falsch." }, { status: 401 });
    }

    try {
      if (requestRow.requestedResolution === "REFUND") {
        await refundAdminOrder({
          orderId: requestRow.orderId,
          refundAmount: returnAmountCents,
          reason: adminNote || `Approved return request ${requestRow.id}`,
          actor: { id: session.user.id, email: session.user.email ?? null },
          source: "admin.returns.refund",
          origin: getAppOrigin(request),
        });
      } else if (requestRow.requestedResolution === "STORE_CREDIT") {
        if (!requestRow.userId) {
          return NextResponse.json(
            { error: "Store credit cannot be issued for guest return requests." },
            { status: 400 },
          );
        }
        await issueAdminStoreCredit({
          userId: requestRow.userId,
          amountCents: returnAmountCents,
          reason: buildReturnStoreCreditReason(requestRow.id),
          actor: { id: session.user.id, email: session.user.email ?? null },
          orderId: requestRow.orderId,
          returnRequestId: requestRow.id,
          metadata: {
            note: adminNote,
            resolution: requestRow.requestedResolution,
          },
        });
      } else if (requestRow.requestedResolution === "EXCHANGE") {
        await createAdminExchangeOrder({
          returnRequestId: requestRow.id,
          actor: { id: session.user.id, email: session.user.email ?? null },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Return resolution failed.";
      const status =
        message === "Order not found"
          ? 404
          : message === "Order already refunded"
            || message === "Exchange order already exists"
            ? 409
          : message === "Missing payment intent" ||
                message === "Refund amount must be greater than zero" ||
                message === "Refund amount exceeds remaining balance" ||
                message === "Customer not found." ||
                message === "Return request has no items" ||
                message === "Insufficient inventory for requested exchange items." ||
                message === "Exchange item variant not found." ||
                message.includes("missing a variant")
              ? 400
              : message === "Stripe secret key not configured."
                ? 500
                : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  await prisma.returnRequest.update({
    where: { id },
    data: {
      status: body.status,
      adminNote,
      storeCreditAmount:
        body.status === "APPROVED" && requestRow.requestedResolution === "STORE_CREDIT"
          ? returnAmountCents
          : 0,
      storeCreditIssuedAt:
        body.status === "APPROVED" && requestRow.requestedResolution === "STORE_CREDIT"
          ? new Date()
          : null,
      exchangeApprovedAt:
        body.status === "APPROVED" && requestRow.requestedResolution === "EXCHANGE"
          ? new Date()
          : null,
    },
  });

  await prisma.order.update({
    where: { id: requestRow.orderId },
    data: {
      status: getReturnOrderStatus({
        requestStatus: body.status,
        requestedResolution: requestRow.requestedResolution,
      }),
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "return.update",
    targetType: "return",
    targetId: id,
    summary: `Set return status to ${body.status} (${requestRow.requestedResolution})`,
    metadata: {
      orderId: requestRow.orderId,
      status: body.status,
      requestedResolution: requestRow.requestedResolution,
      returnAmountCents,
    },
  });

  const supportCase = await ensureReturnRequestSupportCase({
    returnRequestId: requestRow.id,
    actor: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
  });
  await updateAdminSupportCase(supportCase.id, {
    status: "RESOLVED",
    resolutionNote: adminNote,
    note: `Return request ${body.status} with ${requestRow.requestedResolution.toLowerCase()} resolution.`,
    actor: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
  });

  const updated = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      exchangeOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json({ request: updated });
}
