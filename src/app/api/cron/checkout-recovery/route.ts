import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { getAppOrigin } from "@/lib/appOrigin";
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

const buildRecoveryEmail = (sessionId: string, appOrigin: string) => {
  const cartUrl = `${appOrigin}/cart`;
  const subject = "Dein Warenkorb wartet noch bei Smokeify";
  const text = [
    "Du hast einen Checkout gestartet, aber noch nicht abgeschlossen.",
    "",
    "Wenn du weitermachen möchtest, findest du deinen Warenkorb hier:",
    cartUrl,
    "",
    `Referenz: ${sessionId}`,
  ].join("\n");
  const html = `
    <div style="background:#f6f5f2;padding:24px 0;font-family:Arial,sans-serif;color:#1f2937;line-height:1.5;">
      <table style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;">
        <tr>
          <td>
            <div style="background:#2f3e36;color:#fff;padding:20px 24px;border-radius:16px 16px 0 0;">
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.8;">Smokeify</div>
              <div style="font-size:22px;font-weight:700;margin-top:6px;">Dein Warenkorb wartet</div>
              <div style="font-size:14px;margin-top:4px;opacity:.85;">Du kannst deinen Checkout jederzeit fortsetzen.</div>
            </div>
            <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 14px;">Du hast einen Checkout gestartet, aber noch nicht abgeschlossen.</p>
              <div style="text-align:center;margin-top:18px;">
                <a href="${cartUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#2f3e36;color:#fff;text-decoration:none;font-weight:600;">Zum Warenkorb</a>
              </div>
              <p style="margin-top:18px;font-size:12px;color:#6b7280;">Referenz: ${sessionId}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
  return { subject, text, html };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const requiresAuth = Boolean(secret) && !isVercelCron;
  if (
    requiresAuth &&
    authHeader !== `Bearer ${secret}` &&
    searchParams.get("secret") !== secret &&
    headerSecret !== secret
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
      const email = buildRecoveryEmail(session.id, appOrigin);
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
