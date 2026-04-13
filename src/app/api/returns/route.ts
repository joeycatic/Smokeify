import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import {
  ReturnRequestSubmissionError,
  createReturnRequestForOrder,
} from "@/lib/returnRequestSubmission";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `returns:ip:${ip}`,
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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    reason?: string;
    items?: Array<{ id: string; quantity?: number }>;
    requestedResolution?: "REFUND" | "STORE_CREDIT" | "EXCHANGE";
    exchangePreference?: string;
  };

  const orderId = body.orderId?.trim();
  const reason = body.reason?.trim();
  if (!orderId || !reason) {
    return NextResponse.json(
      { error: "Missing order or reason" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const requestedResolution =
    body.requestedResolution === "STORE_CREDIT" || body.requestedResolution === "EXCHANGE"
      ? body.requestedResolution
      : "REFUND";
  const exchangePreference =
    requestedResolution === "EXCHANGE" && typeof body.exchangePreference === "string"
      ? body.exchangePreference.trim() || null
      : null;

  try {
    const created = await createReturnRequestForOrder({
      order: {
        id: order.id,
        userId: order.userId,
        customerEmail: order.customerEmail,
        shippingName: order.shippingName,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
        })),
      },
      reason,
      items: Array.isArray(body.items) ? body.items : [],
      requestedResolution,
      exchangePreference,
      requesterName: order.shippingName,
      requesterEmail: order.customerEmail,
      submissionSource: "account",
    });

    return NextResponse.json({ request: created });
  } catch (error) {
    if (error instanceof ReturnRequestSubmissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
