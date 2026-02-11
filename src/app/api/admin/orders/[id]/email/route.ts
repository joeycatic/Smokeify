import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { getAppOrigin } from "@/lib/appOrigin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-order-email:ip:${ip}`,
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
    type?: "confirmation" | "shipping" | "refund";
  };
  const type = body.type;
  if (!type) {
    return NextResponse.json({ error: "Missing email type" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const recipient = order.customerEmail;
  if (!recipient) {
    return NextResponse.json(
      { error: "Order has no customer email" },
      { status: 400 }
    );
  }

  const origin = getAppOrigin(request);
  const orderUrl = order.userId ? `${origin}/account/orders/${order.id}` : undefined;
  const invoiceUrl =
    type === "confirmation" ? buildInvoiceUrl(origin, order.id) : null;
  const email = buildOrderEmail(
    type,
    {
      id: order.id,
      createdAt: order.createdAt,
      currency: order.currency,
      amountSubtotal: order.amountSubtotal,
      amountTax: order.amountTax,
      amountShipping: order.amountShipping,
      amountDiscount: order.amountDiscount,
      amountTotal: order.amountTotal,
      amountRefunded: order.amountRefunded,
      discountCode: order.discountCode,
      customerEmail: order.customerEmail,
      trackingCarrier: order.trackingCarrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      items: order.items,
    },
    orderUrl,
    invoiceUrl ?? undefined
  );

  await sendResendEmail({
    to: recipient,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  const sentAtUpdate =
    type === "confirmation"
      ? { confirmationEmailSentAt: new Date() }
      : type === "shipping"
      ? { shippingEmailSentAt: new Date() }
      : { refundEmailSentAt: new Date() };

  await prisma.order.update({
    where: { id },
    data: sentAtUpdate,
  });

  return NextResponse.json({ ok: true });
}
