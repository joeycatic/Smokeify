import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { getAppOrigin } from "@/lib/appOrigin";
import {
  buildNewsletterCampaignEmail,
  buildNewsletterConfirmationEmail,
} from "@/lib/newsletterEmail";
import {
  getStorefrontOrigin,
} from "@/lib/storefrontEmailBrand";
import {
  buildBackInStockEmail,
  buildCheckoutRecoveryEmail,
} from "@/lib/storefrontNotificationEmail";
import { parseStorefront } from "@/lib/storefronts";

const sendEmail = async (opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => {
  if (process.env.RESEND_API_KEY) {
    await sendResendEmail(opts);
    return;
  }
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) throw new Error("No email transport configured (RESEND_API_KEY or EMAIL_SERVER required)");
  const transporter = nodemailer.createTransport(server);
  await transporter.sendMail({ ...opts, from });
};

type EmailType =
  | "confirmation"
  | "shipping"
  | "refund"
  | "return_confirmation"
  | "cancellation"
  | "newsletter"
  | "newsletter_confirmation"
  | "back_in_stock"
  | "checkout_recovery";

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
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-email-testing:ip:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logEmailTestingAction = async (
    type: EmailType,
    recipient: string,
    metadata?: Record<string, unknown>,
  ) => {
    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "email.test.send",
      targetType: "email",
      targetId: recipient,
      summary: `Sent ${type} test email to ${recipient}`,
      metadata: { emailType: type, recipient, ...metadata },
    });
  };

  const body = (await request.json().catch(() => ({}))) as {
    type?: EmailType;
    to?: string;
    order?: OrderInput;
    newsletter?: NewsletterInput;
    subject?: string;
    body?: string;
    storefront?: string;
    productTitle?: string;
    variantTitle?: string;
    sessionId?: string;
  };

  const type = body.type;
  const recipient = toSafeString(body.to);
  if (!type) {
    return NextResponse.json({ error: "Missing email type" }, { status: 400 });
  }
  if (!recipient) {
    return NextResponse.json({ error: "Missing recipient email" }, { status: 400 });
  }

  const storefront = parseStorefront(body.storefront) ?? "MAIN";
  const appOrigin = getAppOrigin(request);
  const emailOrigin = getStorefrontOrigin(storefront, appOrigin);

  if (type === "newsletter") {
    const subject = toSafeString(body.newsletter?.subject ?? body.subject);
    const message = toSafeString(body.newsletter?.body ?? body.body);
    if (!subject || !message) {
      return NextResponse.json(
        { error: "Newsletter subject and body are required" },
        { status: 400 }
      );
    }

    const email = buildNewsletterCampaignEmail({
      storefront,
      recipientEmail: recipient,
      subject,
      body: message,
      fallbackOrigin: emailOrigin,
    });

    try { await sendEmail({ to: recipient, subject: email.subject, html: email.html, text: email.text }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
    await logEmailTestingAction(type, recipient, { subject, storefront });
    return NextResponse.json({ ok: true });
  }

  if (type === "newsletter_confirmation") {
    const email = buildNewsletterConfirmationEmail({
      storefront,
      recipientEmail: recipient,
      fallbackOrigin: emailOrigin,
    });
    try { await sendEmail({ to: recipient, subject: email.subject, html: email.html, text: email.text }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
    await logEmailTestingAction(type, recipient, { storefront });
    return NextResponse.json({ ok: true });
  }

  if (type === "back_in_stock") {
    const productTitle = toSafeString(body.productTitle) || "Beispiel-Produkt";
    const variantTitle = toSafeString(body.variantTitle);
    const email = buildBackInStockEmail({
      storefront,
      recipientEmail: recipient,
      productTitle,
      variantTitle,
      fallbackOrigin: emailOrigin,
    });
    try { await sendEmail({ to: recipient, subject: email.subject, html: email.html, text: email.text }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
    await logEmailTestingAction(type, recipient, { productTitle, variantTitle, storefront });
    return NextResponse.json({ ok: true });
  }

  if (type === "checkout_recovery") {
    const sessionId = toSafeString(body.sessionId) || "cs_test_XXXXXXXXXXXXXXXX";
    const email = buildCheckoutRecoveryEmail({
      storefront,
      recipientEmail: recipient,
      sessionId,
      fallbackOrigin: emailOrigin,
    });
    try { await sendEmail({ to: recipient, subject: email.subject, html: email.html, text: email.text }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
    await logEmailTestingAction(type, recipient, { sessionId, storefront });
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

  const origin = emailOrigin;
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
    invoiceUrl ?? undefined,
    { storefront, fallbackOrigin: origin }
  );

  try {
    await sendEmail({
      to: recipient,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await logEmailTestingAction(type, recipient, {
    orderId: order.id,
    itemCount: order.items.length,
    storefront,
  });
  return NextResponse.json({ ok: true });
}
