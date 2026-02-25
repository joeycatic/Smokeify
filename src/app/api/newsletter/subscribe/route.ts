import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { sendResendEmail } from "@/lib/resend";
import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import { getAppOrigin } from "@/lib/appOrigin";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const buildConfirmationEmail = (
  email: string,
  unsubscribeUrl: string,
  shopUrl: string
) => {
  const subject = "Willkommen im Smokeify Newsletter";
  const text = [
    "Vielen Dank für deine Anmeldung zum Smokeify Newsletter!",
    "",
    "Du erhältst ab sofort exklusive Angebote, Neuheiten und Aktionen direkt in dein Postfach.",
    "",
    `Zum Shop: ${shopUrl}`,
    "",
    "──────────────────────",
    "Falls du dich abmelden möchtest:",
    unsubscribeUrl,
    "",
    "Du erhältst diese E-Mail, weil du dich für den Smokeify Newsletter angemeldet hast.",
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

              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">
                Vielen Dank für deine Anmeldung! Du erhältst ab sofort exklusive Angebote, Neuheiten und Aktionen direkt in dein Postfach.
              </p>

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
                <a href="${shopUrl}/pages/privacy" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${shopUrl}/pages/agb" style="color:#9ca3af;text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:#d1d5db;margin-top:10px;line-height:1.6;">
                Du erhältst diese E-Mail, weil du dich für den Smokeify Newsletter angemeldet hast.<br />
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Vom Newsletter abmelden</a>
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</div>`;

  return { subject, text, html };
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `newsletter:ip:${ip}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
  };
  const email = body.email?.trim() ?? "";
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Bitte eine gültige E-Mail angeben." },
      { status: 400 }
    );
  }

  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  const adminTo = process.env.CONTACT_EMAIL?.trim() || "joey@smokeify.de";

  const normalizedEmail = email.toLowerCase();
  const emailLimit = await checkRateLimit({
    key: `newsletter:email:${normalizedEmail}`,
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Diese E-Mail wurde kürzlich angemeldet." },
      { status: 429 }
    );
  }
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { newsletterOptIn: true, newsletterOptInAt: new Date() },
      });
    }

    await tx.newsletterSubscriber.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        userId: existingUser?.id ?? null,
        subscribedAt: new Date(),
      },
      update: {
        userId: existingUser?.id ?? null,
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
    });
  });

  // DB subscription already committed — email failures must not fail the user response.
  const appOrigin = getAppOrigin(request);
  const shopUrl = `${appOrigin}/products`;
  const unsubscribeUrl = buildUnsubscribeUrl(appOrigin, normalizedEmail);

  // Send subscriber confirmation email
  try {
    const confirmation = buildConfirmationEmail(normalizedEmail, unsubscribeUrl, shopUrl);
    if (process.env.RESEND_API_KEY) {
      await sendResendEmail({
        to: normalizedEmail,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
      });
    } else if (server && from) {
      const transporter = nodemailer.createTransport(server);
      await transporter.sendMail({
        to: normalizedEmail,
        from,
        subject: confirmation.subject,
        text: confirmation.text,
        html: confirmation.html,
      });
    }
  } catch (err) {
    console.error("[newsletter] subscriber confirmation email failed:", err);
  }

  // Send admin notification email
  try {
    if (server && from) {
      const transporter = nodemailer.createTransport(server);
      await transporter.sendMail({
        to: adminTo,
        from,
        subject: "Neue Newsletter-Anmeldung",
        text: `Neue Newsletter-Anmeldung: ${normalizedEmail}`,
        html: `
<div style="background:#f6f5f2;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr><td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background-color:#2f3e36;padding:24px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:10px;">Smokeify</div>
              <div style="font-size:20px;font-weight:700;color:#ffffff;">Neue Newsletter-Anmeldung</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:28px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">E-Mail-Adresse</div>
              <div style="font-size:15px;font-weight:600;color:#2f3e36;">${escapeHtml(normalizedEmail)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`,
      });
    }
  } catch (err) {
    console.error("[newsletter] admin notification email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
