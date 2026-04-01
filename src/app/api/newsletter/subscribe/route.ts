import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { sendResendEmail } from "@/lib/resend";
import { buildNewsletterConfirmationEmail } from "@/lib/newsletterEmail";
import { resolveOrderSourceFromRequest } from "@/lib/orderSource";
import { type StorefrontCode } from "@/lib/storefronts";
import {
  getStorefrontEmailBrand,
  getStorefrontLinks,
} from "@/lib/storefrontEmailBrand";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
  const adminTo = process.env.CONTACT_EMAIL?.trim() || "contact@smokeify.de";

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
  const resolvedStorefront =
    (resolveOrderSourceFromRequest(request).sourceStorefront as StorefrontCode | null) ?? "MAIN";

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
  // Send subscriber confirmation email
  try {
    const confirmation = buildNewsletterConfirmationEmail({
      storefront: resolvedStorefront,
      recipientEmail: normalizedEmail,
      fallbackOrigin: request.url,
    });
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
      const brand = getStorefrontEmailBrand(resolvedStorefront);
      const links = getStorefrontLinks(resolvedStorefront, request.url);
      const transporter = nodemailer.createTransport(server);
      await transporter.sendMail({
        to: adminTo,
        from,
        subject: "Neue Newsletter-Anmeldung",
        text: `Neue Newsletter-Anmeldung: ${normalizedEmail}`,
        html: `
<div style="background:${brand.backgroundColor};padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:${brand.textColor};line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr><td height="4" style="background-color:${brand.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:${brand.heroBackground};background-color:${brand.headerColor};padding:24px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${brand.heroLabelColor};margin-bottom:10px;">${brand.brandName}</div>
              <div style="font-size:20px;font-weight:700;color:#ffffff;">Neue Newsletter-Anmeldung</div>
            </td>
          </tr>
          <tr>
            <td style="background:${brand.cardBackgroundColor};padding:28px;border:1px solid ${brand.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${brand.subtleTextColor};margin-bottom:8px;">E-Mail-Adresse</div>
              <div style="font-size:15px;font-weight:600;color:${brand.emphasisColor};">${escapeHtml(normalizedEmail)}</div>
              <div style="margin-top:16px;font-size:12px;color:${brand.footerTextColor};">
                <a href="${links.shopUrl}" style="color:${brand.footerTextColor};text-decoration:none;">${brand.brandName} Shop</a>
              </div>
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
