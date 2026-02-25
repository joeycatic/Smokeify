import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import { getAppOrigin } from "@/lib/appOrigin";

type BackInStockPayload = {
  email?: string;
  productId?: string;
  productTitle?: string;
  variantId?: string;
  variantTitle?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `back-in-stock:ip:${ip}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const body = (await request.json()) as BackInStockPayload;
  const email = body.email?.trim() || "";
  const productId = body.productId?.trim() || "";
  const productTitle = body.productTitle?.trim() || "";
  const variantId = body.variantId?.trim() || "";
  const variantTitle = body.variantTitle?.trim() || "";

  if (!email || !productId || !variantId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const emailLimit = await checkRateLimit({
    key: `back-in-stock:email:${email.toLowerCase()}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Diese E-Mail wurde kürzlich angemeldet." },
      { status: 429 }
    );
  }

  await prisma.backInStockRequest.upsert({
    where: { email_variantId: { email, variantId } },
    update: {
      productId,
      productTitle,
      variantTitle,
      ...(userId ? { userId } : {}),
    },
    create: {
      email,
      productId,
      productTitle,
      variantId,
      variantTitle,
      ...(userId ? { userId } : {}),
    },
  });

  const appOrigin = getAppOrigin(request);
  const shopUrl = `${appOrigin}/products`;
  const unsubscribeUrl = buildUnsubscribeUrl(appOrigin, email.toLowerCase());

  const subject = "Benachrichtigung eingerichtet – Smokeify";
  const lineTitle = productTitle || "Dein Artikel";
  const variantLine = variantTitle ? ` (${variantTitle})` : "";
  const displayTitle = `${lineTitle}${variantLine}`;
  const text = [
    `Wir benachrichtigen dich, sobald "${displayTitle}" wieder verfügbar ist.`,
    "",
    "Du erhältst eine E-Mail, sobald der Artikel wieder auf Lager ist.",
    "",
    `Zum Shop: ${shopUrl}`,
    "",
    "──────────────────────",
    "Du erhältst diese E-Mail, weil du eine Benachrichtigung für diesen Artikel angefordert hast.",
    `Abmelden: ${unsubscribeUrl}`,
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
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">E-Mail-Benachrichtigungen abmelden</a>
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</div>`;

  await sendResendEmail({ to: email, subject, html, text });

  return NextResponse.json({ ok: true });
}
