import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { getAppOrigin } from "@/lib/appOrigin";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import {
  getCheckoutRecoveryEventId,
  isRecoverableCheckoutSession,
  parseCheckoutRecoveryBatchSize,
  parseCheckoutRecoveryDelayMinutes,
} from "@/lib/checkoutRecovery";

export const runtime = "nodejs";

const RECOVERY_EVENT_TYPE = "checkout_recovery.reminder";

const getStripe = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret, { apiVersion: "2024-06-20" });
};

const beginRecoveryEvent = async (eventId: string) => {
  try {
    await prisma.processedWebhookEvent.create({
      data: { eventId, type: RECOVERY_EVENT_TYPE, status: "processing" },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.processedWebhookEvent.findUnique({
        where: { eventId },
      });
      if (existing?.status === "failed") {
        await prisma.processedWebhookEvent.update({
          where: { eventId },
          data: { status: "processing" },
        });
        return true;
      }
      return false;
    }
    throw error;
  }
};

const finalizeRecoveryEvent = async (eventId: string) => {
  await prisma.processedWebhookEvent.update({
    where: { eventId },
    data: { status: "processed", processedAt: new Date() },
  });
};

const failRecoveryEvent = async (eventId: string) => {
  await prisma.processedWebhookEvent.update({
    where: { eventId },
    data: { status: "failed" },
  });
};

const buildRecoveryEmail = (
  sessionId: string,
  appOrigin: string,
  userEmail: string
) => {
  const cartUrl = `${appOrigin}/cart`;
  const shopUrl = `${appOrigin}/products`;
  const unsubscribeUrl = buildUnsubscribeUrl(appOrigin, userEmail);
  const subject = "Dein Warenkorb wartet noch bei Smokeify";
  const text = [
    "Du hast einen Checkout gestartet, aber noch nicht abgeschlossen.",
    "",
    "Wenn du weitermachen möchtest, findest du deinen Warenkorb hier:",
    cartUrl,
    "",
    `Referenz: ${sessionId}`,
    "",
    "──────────────────────",
    "Du erhältst diese E-Mail, weil du einen Checkout bei Smokeify begonnen und dem Erhalt von Erinnerungs-E-Mails zugestimmt hast.",
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
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">E-Mail-Benachrichtigungen abmelden</a>
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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is required." },
      { status: 500 }
    );
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  if (
    !isCronRequestAuthorized({
      authorizationHeader: authHeader,
      headerSecret,
      expectedSecret: secret,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe secret key not configured." },
      { status: 500 }
    );
  }

  const delayMinutes = parseCheckoutRecoveryDelayMinutes(
    process.env.CHECKOUT_RECOVERY_DELAY_MINUTES
  );
  const batchSize = parseCheckoutRecoveryBatchSize(
    process.env.CHECKOUT_RECOVERY_BATCH_SIZE
  );
  const cutoffSeconds = Math.floor(Date.now() / 1000) - delayMinutes * 60;
  const appOrigin = getAppOrigin(request);

  const sessions = await stripe.checkout.sessions.list({
    limit: batchSize,
    created: { lte: cutoffSeconds },
  });

  let scanned = 0;
  let reminded = 0;
  let skippedNoConsent = 0;
  let skippedIneligible = 0;

  for (const session of sessions.data ?? []) {
    scanned += 1;
    if (!isRecoverableCheckoutSession(session)) {
      skippedIneligible += 1;
      continue;
    }

    const existingOrder = await prisma.order.findUnique({
      where: { stripeSessionId: session.id },
      select: { id: true },
    });
    if (existingOrder) {
      skippedIneligible += 1;
      continue;
    }

    const customerEmail = session.customer_details?.email?.trim().toLowerCase();
    const linkedUserId = session.client_reference_id ?? null;
    const consentUser = linkedUserId
      ? await prisma.user.findUnique({
          where: { id: linkedUserId },
          select: { id: true, email: true, newsletterOptIn: true },
        })
      : customerEmail
        ? await prisma.user.findUnique({
            where: { email: customerEmail },
            select: { id: true, email: true, newsletterOptIn: true },
          })
        : null;

    if (!consentUser?.newsletterOptIn || !consentUser.email) {
      skippedNoConsent += 1;
      continue;
    }

    const recoveryEventId = getCheckoutRecoveryEventId(session.id);
    const shouldSend = await beginRecoveryEvent(recoveryEventId);
    if (!shouldSend) {
      skippedIneligible += 1;
      continue;
    }

    try {
      const email = buildRecoveryEmail(session.id, appOrigin, consentUser.email);
      await sendResendEmail({
        to: consentUser.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      reminded += 1;
      await finalizeRecoveryEvent(recoveryEventId);
    } catch {
      await failRecoveryEvent(recoveryEventId);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned,
    reminded,
    skippedNoConsent,
    skippedIneligible,
    delayMinutes,
    batchSize,
  });
}
