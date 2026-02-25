import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendResendEmail } from "@/lib/resend";
import { buildOrderEmail } from "@/lib/orderEmail";
import { buildInvoiceUrl } from "@/lib/invoiceLink";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import { getAppOrigin } from "@/lib/appOrigin";

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
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: EmailType;
    to?: string;
    order?: OrderInput;
    newsletter?: NewsletterInput;
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

  const appOrigin = getAppOrigin(request);
  const shopUrl = `${appOrigin}/products`;
  // Only compute unsubscribe URL for marketing email types that need it
  const getUnsubscribeUrl = () => buildUnsubscribeUrl(appOrigin, recipient);

  if (type === "newsletter") {
    const subject = toSafeString(body.newsletter?.subject);
    const message = toSafeString(body.newsletter?.body);
    if (!subject || !message) {
      return NextResponse.json(
        { error: "Newsletter subject and body are required" },
        { status: 400 }
      );
    }

    const bodyHtml = message
      .split("\n")
      .map((line) =>
        line.trim()
          ? `<p style="margin:0 0 14px;font-size:15px;color:#4b5563;line-height:1.7;">${line}</p>`
          : `<div style="height:8px;"></div>`
      )
      .join("");

    const html = `
<div style="background:#f6f5f2;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#2f3e36;padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:16px;">Smokeify</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;">${subject}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              ${bodyHtml}
              <div style="text-align:center;margin:24px 0 0;">
                <a href="${shopUrl}" style="display:inline-block;padding:13px 30px;background:#2f3e36;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">Jetzt shoppen &rarr;</a>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
                © ${new Date().getFullYear()} Smokeify &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${shopUrl}" style="color:#9ca3af;text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/privacy" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/agb" style="color:#9ca3af;text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:#d1d5db;margin-top:10px;line-height:1.6;">
                Du erhältst diese E-Mail als Newsletter-Abonnent von Smokeify.<br />
                <a href="\${getUnsubscribeUrl()}" style="color:#9ca3af;text-decoration:underline;">Vom Newsletter abmelden</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;

    try { await sendEmail({ to: recipient, subject, html, text: message }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  }

  if (type === "newsletter_confirmation") {
    const subject = "Willkommen im Smokeify Newsletter";
    const text = [
      "Vielen Dank für deine Anmeldung zum Smokeify Newsletter!",
      "",
      "Du erhältst ab sofort exklusive Angebote, Neuheiten und Aktionen direkt in dein Postfach.",
      "",
      `Zum Shop: ${shopUrl}`,
    ].join("\n");
    const html = `
<div style="background:#f6f5f2;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#2f3e36;padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:16px;">Smokeify</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">Willkommen!</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.65);">Du bist jetzt Teil unseres Newsletters.</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Vielen Dank für deine Anmeldung! Du erhältst ab sofort exklusive Angebote, Neuheiten und Aktionen direkt in dein Postfach.</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${shopUrl}" style="display:inline-block;padding:14px 32px;background:#2f3e36;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:8px;">Jetzt shoppen &rarr;</a>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
                © ${new Date().getFullYear()} Smokeify &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${shopUrl}" style="color:#9ca3af;text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/privacy" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/agb" style="color:#9ca3af;text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:#d1d5db;margin-top:10px;line-height:1.6;">
                Du erhältst diese E-Mail, weil du dich für den Smokeify Newsletter angemeldet hast.<br />
                <a href="\${getUnsubscribeUrl()}" style="color:#9ca3af;text-decoration:underline;">Vom Newsletter abmelden</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
    try { await sendEmail({ to: recipient, subject, html, text }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  }

  if (type === "back_in_stock") {
    const productTitle = toSafeString(body.productTitle) || "Beispiel-Produkt";
    const variantTitle = toSafeString(body.variantTitle);
    const displayTitle = variantTitle ? `${productTitle} (${variantTitle})` : productTitle;
    const subject = "Benachrichtigung eingerichtet – Smokeify";
    const text = [
      `Wir benachrichtigen dich, sobald "${displayTitle}" wieder verfügbar ist.`,
      "",
      `Zum Shop: ${shopUrl}`,
      "",
      `Abmelden: \${getUnsubscribeUrl()}`,
    ].join("\n");
    const html = `
<div style="background:#f6f5f2;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#2f3e36;padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:16px;">Smokeify</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">Benachrichtigung eingerichtet</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.65);">Wir geben dir Bescheid, sobald der Artikel wieder verfügbar ist.</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;">Artikel</div>
              <div style="background:#f9fafb;border-radius:10px;padding:18px 20px;font-size:15px;font-weight:600;color:#1a2a22;border:1px solid #f3f4f6;">${displayTitle}</div>
              <div style="height:1px;background:#f3f4f6;margin:24px 0;"></div>
              <p style="margin:0;font-size:14px;color:#4b5563;">Wir senden dir eine E-Mail, sobald dieser Artikel wieder auf Lager ist. Du musst nichts weiter tun.</p>
              <div style="text-align:center;margin:24px 0 0;">
                <a href="${shopUrl}" style="display:inline-block;padding:12px 28px;background:#2f3e36;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">Zum Shop &rarr;</a>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
                © ${new Date().getFullYear()} Smokeify &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${shopUrl}" style="color:#9ca3af;text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/privacy" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/agb" style="color:#9ca3af;text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:#d1d5db;margin-top:10px;line-height:1.6;">
                Du erhältst diese E-Mail, weil du eine Benachrichtigung für diesen Artikel angefordert hast.<br />
                <a href="\${getUnsubscribeUrl()}" style="color:#9ca3af;text-decoration:underline;">E-Mail-Benachrichtigungen abmelden</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
    try { await sendEmail({ to: recipient, subject, html, text }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  }

  if (type === "checkout_recovery") {
    const sessionId = toSafeString(body.sessionId) || "cs_test_XXXXXXXXXXXXXXXX";
    const cartUrl = `${appOrigin}/cart`;
    const subject = "Dein Warenkorb wartet noch bei Smokeify";
    const text = [
      "Du hast einen Checkout gestartet, aber noch nicht abgeschlossen.",
      "",
      `Warenkorb fortsetzen: ${cartUrl}`,
      "",
      `Referenz: ${sessionId}`,
      "",
      `Abmelden: \${getUnsubscribeUrl()}`,
    ].join("\n");
    const html = `
<div style="background:#f6f5f2;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#2f3e36;padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:16px;">Smokeify</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">Dein Warenkorb wartet</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.65);">Du kannst deinen Checkout jederzeit fortsetzen.</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Du hast einen Checkout gestartet, aber noch nicht abgeschlossen. Dein Warenkorb ist noch für dich reserviert.</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${cartUrl}" style="display:inline-block;padding:14px 32px;background:#2f3e36;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:8px;">Checkout fortsetzen &rarr;</a>
              </div>
              <div style="height:1px;background:#f3f4f6;margin:24px 0;"></div>
              <div style="font-size:12px;color:#9ca3af;text-align:center;">Referenz: ${sessionId}</div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
                © ${new Date().getFullYear()} Smokeify &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${shopUrl}" style="color:#9ca3af;text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/privacy" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${appOrigin}/pages/agb" style="color:#9ca3af;text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:#d1d5db;margin-top:10px;line-height:1.6;">
                Du erhältst diese E-Mail, weil du einen Checkout bei Smokeify begonnen und dem Erhalt von Erinnerungs-E-Mails zugestimmt hast.<br />
                <a href="\${getUnsubscribeUrl()}" style="color:#9ca3af;text-decoration:underline;">E-Mail-Benachrichtigungen abmelden</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
    try { await sendEmail({ to: recipient, subject, html, text }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 }); }
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

  return NextResponse.json({ ok: true });
}
