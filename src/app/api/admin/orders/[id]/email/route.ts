import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const orderUrl = `${origin}/account/orders/${order.id}`;
  const email = buildOrderEmail(type, {
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
  }, orderUrl);

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
