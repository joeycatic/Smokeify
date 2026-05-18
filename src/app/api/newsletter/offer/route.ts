import Stripe from "stripe";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { sendResendEmail } from "@/lib/resend";
import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import { getAppOrigin } from "@/lib/appOrigin";
import {
  formatDiscountAmount,
  getNewsletterOfferActiveUntil,
  isNewsletterOfferActive,
  NEWSLETTER_OFFER_DISCOUNT_CENTS,
} from "@/lib/newsletterOffer";

export const runtime = "nodejs";

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isMissingNewsletterOfferColumnError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes(`column "newsletterOfferClaimedAt" does not exist`) ||
    error.message.includes(`column "newsletterOfferClaimedEmail" does not exist`));

const getNewsletterOfferClaimState = async (userId: string) => {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        newsletterOfferClaimedAt: Date | null;
      }>
    >`
      SELECT "newsletterOfferClaimedAt"
      FROM "User"
      WHERE id = ${userId}
      LIMIT 1
    `;
    return rows[0] ?? { newsletterOfferClaimedAt: null };
  } catch (error) {
    if (isMissingNewsletterOfferColumnError(error)) {
      return { newsletterOfferClaimedAt: null };
    }
    throw error;
  }
};

const markNewsletterOfferClaimed = async (userId: string, email: string) => {
  try {
    await prisma.$executeRaw`
      UPDATE "User"
      SET
        "newsletterOfferClaimedAt" = COALESCE("newsletterOfferClaimedAt", NOW()),
        "newsletterOfferClaimedEmail" = CASE
          WHEN "newsletterOfferClaimedEmail" IS NULL THEN ${email}
          ELSE "newsletterOfferClaimedEmail"
        END
      WHERE id = ${userId}
    `;
  } catch (error) {
    if (isMissingNewsletterOfferColumnError(error)) {
      return;
    }
    throw error;
  }
};

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const createOfferCode = (email: string) => {
  const salt =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    "smokeify-newsletter-offer";
  const digest = createHash("sha256")
    .update(`${email}:${salt}:offer-v1`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `SMOKEIFY5-${digest}`;
};

const buildOfferEmail = (
  email: string,
  promotionCode: string,
  unsubscribeUrl: string,
  shopUrl: string,
) => {
  const discountLabel = formatDiscountAmount();
  const subject = `Dein Smokeify ${discountLabel} Willkommensrabatt`;
  const text = [
    "Vielen Dank für deine Anmeldung zum Smokeify Newsletter.",
    "",
    `Dein persönlicher Rabattcode über ${discountLabel}: ${promotionCode}`,
    "",
    "So funktioniert es:",
    "1. Produkte in den Warenkorb legen",
    `2. Rabattcode ${promotionCode} im Warenkorb oder Checkout eingeben`,
    `3. ${discountLabel} Rabatt werden direkt abgezogen`,
    "",
    `Jetzt shoppen: ${shopUrl}`,
    "",
    "Abmelden:",
    unsubscribeUrl,
    "",
    `Du erhältst diese E-Mail, weil du dich für das zeitlich begrenzte Smokeify Angebot über ${discountLabel} angemeldet hast.`,
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
              <div style="font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;margin-bottom:8px;">${discountLabel} Rabatt für deinen nächsten Einkauf</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.72);">Dein persönlicher Willkommenscode ist jetzt aktiv.</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              <p style="margin:0 0 18px;font-size:15px;color:#4b5563;">
                Danke für deine Anmeldung zum Smokeify Newsletter. Verwende den folgenden Code bei deiner nächsten Bestellung:
              </p>
              <div style="margin:24px 0;text-align:center;">
                <div style="display:inline-block;border:1px dashed #2f3e36;border-radius:12px;padding:18px 26px;font-size:24px;font-weight:700;letter-spacing:2px;color:#2f3e36;background:#f8faf8;">
                  ${promotionCode}
                </div>
              </div>
              <p style="margin:0 0 8px;font-size:14px;color:#4b5563;">
                Der Code reduziert deinen Warenkorb einmalig um ${discountLabel}.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;">
                Gib ihn einfach im Warenkorb oder im Checkout als Rabattcode ein.
              </p>
              <div style="text-align:center;margin:28px 0 0;">
                <a href="${shopUrl}" style="display:inline-block;padding:14px 32px;background:#2f3e36;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:8px;">Jetzt shoppen</a>
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
                Diese E-Mail wurde an ${email} gesendet.<br />
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
  if (!isNewsletterOfferActive()) {
    return NextResponse.json(
      { error: "Das zeitlich begrenzte Angebot ist leider bereits beendet." },
      { status: 410 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Das Angebots-System ist gerade nicht verfügbar." },
      { status: 500 },
    );
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `newsletter-offer:ip:${ip}`,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim() ?? "";
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Bitte eine gültige E-Mail-Adresse angeben." },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase();
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id ?? null;

  if (sessionUserId) {
    const sessionUser = await getNewsletterOfferClaimState(sessionUserId);
    if (sessionUser?.newsletterOfferClaimedAt) {
      return NextResponse.json(
        { error: "Dieses Kundenkonto hat das Newsletter-Angebot bereits erhalten." },
        { status: 409 },
      );
    }
  }

  const emailLimit = await checkRateLimit({
    key: `newsletter-offer:email:${normalizedEmail}`,
    limit: 2,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Für diese E-Mail-Adresse wurde das Angebot kürzlich bereits angefordert." },
      { status: 429 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
    },
  });

  if (existingUser?.id) {
    const existingUserClaimState = await getNewsletterOfferClaimState(existingUser.id);
    if (existingUserClaimState.newsletterOfferClaimedAt) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse hat das Newsletter-Angebot bereits erhalten." },
        { status: 409 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          newsletterOptIn: true,
          newsletterOptInAt: new Date(),
        },
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

  const code = createOfferCode(normalizedEmail);
  const existingPromotionCodes = await stripe.promotionCodes.list({
    code,
    limit: 1,
    expand: ["data.coupon"],
  });

  let promotionCode = existingPromotionCodes.data[0] ?? null;
  if (
    promotionCode &&
    ((promotionCode.times_redeemed ?? 0) >= 1 || !promotionCode.coupon?.valid)
  ) {
    return NextResponse.json(
      { error: "Diese E-Mail-Adresse hat das 5,00 EUR Angebot bereits genutzt." },
      { status: 409 },
    );
  }

  if (!promotionCode) {
    const activeUntil = getNewsletterOfferActiveUntil();
    const coupon = await stripe.coupons.create({
      amount_off: NEWSLETTER_OFFER_DISCOUNT_CENTS,
      currency: "eur",
      duration: "once",
      name: "Smokeify Newsletter Angebot 5,00 EUR",
      metadata: {
        campaign: "newsletter-offer-popup",
        email: normalizedEmail,
      },
    });

    promotionCode = await stripe.promotionCodes.create({
      code,
      coupon: coupon.id,
      max_redemptions: 1,
      expires_at: activeUntil
        ? Math.floor(activeUntil.getTime() / 1000)
        : undefined,
      active: true,
      metadata: {
        campaign: "newsletter-offer-popup",
        email: normalizedEmail,
      },
    });
  }

  const appOrigin = getAppOrigin(request);
  const shopUrl = `${appOrigin}/products`;
  const unsubscribeUrl = buildUnsubscribeUrl(appOrigin, normalizedEmail);
  const mail = buildOfferEmail(
    normalizedEmail,
    promotionCode.code ?? code,
    unsubscribeUrl,
    shopUrl,
  );

  try {
    if (process.env.RESEND_API_KEY) {
      await sendResendEmail({
        to: normalizedEmail,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    } else if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
      const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);
      await transporter.sendMail({
        to: normalizedEmail,
        from: process.env.EMAIL_FROM,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } else {
      return NextResponse.json(
        { error: "Der E-Mail-Versand ist aktuell nicht eingerichtet." },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[newsletter-offer] email failed:", error);
    return NextResponse.json(
      { error: "Der Rabattcode konnte gerade nicht per E-Mail versendet werden." },
      { status: 500 },
    );
  }

  if (sessionUserId) {
    await markNewsletterOfferClaimed(sessionUserId, normalizedEmail);
  }

  if (existingUser?.id) {
    await markNewsletterOfferClaimed(existingUser.id, normalizedEmail);
  }

  return NextResponse.json({
    ok: true,
    message:
      "Dein persönlicher 5,00 EUR Rabattcode wurde an deine E-Mail-Adresse gesendet.",
  });
}
