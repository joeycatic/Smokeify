import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { verifyRefundRequestToken } from "@/lib/refundRequestLink";
import {
  ReturnRequestSubmissionError,
  createReturnRequestForOrder,
} from "@/lib/returnRequestSubmission";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `returns-request-link:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    expires?: number | string;
    customerName?: string;
    customerEmail?: string;
    reason?: string;
    items?: Array<{ id: string; quantity?: number }>;
  };

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const expiresAt =
    typeof body.expires === "number"
      ? body.expires
      : typeof body.expires === "string"
        ? Number(body.expires)
        : NaN;
  const hasValidToken =
    typeof body.token === "string" &&
    Number.isFinite(expiresAt) &&
    verifyRefundRequestToken(id, expiresAt, body.token);

  if (!hasValidToken) {
    const session = await getServerSession(authOptions);
    const isAdmin = session?.user?.role === "ADMIN";
    if (!session?.user?.id || (!isAdmin && order.userId !== session.user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const customerName = body.customerName?.trim() || order.shippingName?.trim() || "";
  if (!customerName) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }

  const customerEmail = body.customerEmail?.trim() || order.customerEmail?.trim() || "";
  if (!customerEmail || !EMAIL_PATTERN.test(customerEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const reason = body.reason?.trim();
  if (!reason) {
    return NextResponse.json(
      { error: "Please describe why you are requesting a refund." },
      { status: 400 },
    );
  }

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
      requestedResolution: "REFUND",
      requesterName: customerName,
      requesterEmail: customerEmail,
      submissionSource: "refund_link",
    });

    return NextResponse.json({ request: created });
  } catch (error) {
    if (error instanceof ReturnRequestSubmissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Refund request failed." }, { status: 500 });
  }
}
