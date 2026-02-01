import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";

type EmailType =
  | "confirmation"
  | "shipping"
  | "refund"
  | "return_confirmation"
  | "cancellation"
  | "newsletter";

type OrderItemInput = {
  name: string;
  quantity: number;
  totalAmount: number;
  currency: string;
};

type OrderInput = {
  id: string;
  currency: string;
  amountSubtotal: number;
  amountTax: number;
  amountShipping: number;
  amountDiscount: number;
  amountTotal: number;
  amountRefunded?: number;
  discountCode?: string | null;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  items: OrderItemInput[];
};

type NewsletterInput = {
  subject: string;
  body: string;
};

const toSafeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toSafeNumber = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const sanitizeOrder = (input: OrderInput): OrderInput => ({
  id: toSafeString(input.id) || "TEST-ORDER-0001",
  currency: toSafeString(input.currency).toUpperCase() || "EUR",
  amountSubtotal: Math.max(0, toSafeNumber(input.amountSubtotal)),
  amountTax: Math.max(0, toSafeNumber(input.amountTax)),
  amountShipping: Math.max(0, toSafeNumber(input.amountShipping)),
  amountDiscount: Math.max(0, toSafeNumber(input.amountDiscount)),
  amountTotal: Math.max(0, toSafeNumber(input.amountTotal)),
  amountRefunded: Math.max(0, toSafeNumber(input.amountRefunded ?? 0)),
  discountCode: toSafeString(input.discountCode ?? "") || null,
  trackingCarrier: toSafeString(input.trackingCarrier ?? "") || null,
  trackingNumber: toSafeString(input.trackingNumber ?? "") || null,
  trackingUrl: toSafeString(input.trackingUrl ?? "") || null,
  items: Array.isArray(input.items)
    ? input.items
        .filter((item) => toSafeString(item.name))
        .map((item) => ({
          name: toSafeString(item.name),
          quantity: Math.max(1, Math.floor(toSafeNumber(item.quantity))),
          totalAmount: Math.max(0, toSafeNumber(item.totalAmount)),
          currency: toSafeString(item.currency).toUpperCase() || "EUR",
        }))
    : [],
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: EmailType;
    to?: string;
    order?: OrderInput;
    newsletter?: NewsletterInput;
  };

  const type = body.type;
  const recipient = toSafeString(body.to);
  if (!type) {
    return NextResponse.json({ error: "Missing email type" }, { status: 400 });
  }
  if (!recipient) {
    return NextResponse.json({ error: "Missing recipient email" }, { status: 400 });
  }

  if (type === "newsletter") {
    const subject = toSafeString(body.newsletter?.subject);
    const message = toSafeString(body.newsletter?.body);
    if (!subject || !message) {
      return NextResponse.json(
        { error: "Newsletter subject and body are required" },
        { status: 400 }
      );
    }

    const html = message
      .split("\n")
      .map((line) => `<p style="margin: 0 0 12px;">${line}</p>`)
      .join("");

    await sendResendEmail({
      to: recipient,
      subject,
      html: `<div style="font-family: Arial, sans-serif; color: #1f2937;">${html}</div>`,
      text: message,
    });

    return NextResponse.json({ ok: true });
  }

  if (!body.order) {
    return NextResponse.json({ error: "Missing order payload" }, { status: 400 });
  }

  const order = sanitizeOrder(body.order);
  if (order.items.length === 0) {
    return NextResponse.json(
      { error: "At least one order item is required" },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const invoiceUrl =
    type === "confirmation" ? buildInvoiceUrl(origin, order.id) : null;
  const email = buildOrderEmail(
    type,
    {
      id: order.id,
      createdAt: new Date(),
      currency: order.currency,
      amountSubtotal: order.amountSubtotal,
      amountTax: order.amountTax,
      amountShipping: order.amountShipping,
      amountDiscount: order.amountDiscount,
      amountTotal: order.amountTotal,
      amountRefunded: order.amountRefunded,
      discountCode: order.discountCode,
      trackingCarrier: order.trackingCarrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      items: order.items,
    },
    undefined,
    invoiceUrl ?? undefined
  );

  await sendResendEmail({
    to: recipient,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  return NextResponse.json({ ok: true });
}
