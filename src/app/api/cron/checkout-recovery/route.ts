import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { getAppOrigin } from "@/lib/appOrigin";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import {
  getCheckoutRecoveryEventId,
  isRecoverableCheckoutSession,
  parseCheckoutRecoveryBatchSize,
  parseCheckoutRecoveryDelayMinutes,
} from "@/lib/checkoutRecovery";
import { resolveOrderSourceFromMetadata } from "@/lib/orderSource";
import { buildCheckoutRecoveryEmail } from "@/lib/storefrontNotificationEmail";
import { parseStorefront } from "@/lib/storefronts";

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
      const orderSource = resolveOrderSourceFromMetadata(session.metadata ?? {});
      const storefront = parseStorefront(orderSource.sourceStorefront ?? null) ?? "MAIN";
      const email = buildCheckoutRecoveryEmail({
        storefront,
        recipientEmail: consentUser.email,
        sessionId: session.id,
        fallbackOrigin: orderSource.sourceOrigin ?? appOrigin,
      });
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
