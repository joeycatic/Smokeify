import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  getNewsletterAudienceSummary,
  getStorefrontNewsletterAudience,
} from "@/lib/adminNewsletter";
import {
  buildNewsletterCampaignEmail,
} from "@/lib/newsletterEmail";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sendResendEmail } from "@/lib/resend";
import { isSameOrigin } from "@/lib/requestSecurity";
import { getStorefrontOrigin } from "@/lib/storefrontEmailBrand";
import { parseStorefront, STOREFRONT_LABELS, type StorefrontCode } from "@/lib/storefronts";

export const runtime = "nodejs";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const toSafeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

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
  if (!server || !from) {
    throw new Error("No email transport configured (RESEND_API_KEY or EMAIL_SERVER required)");
  }

  const transporter = nodemailer.createTransport(server);
  await transporter.sendMail({ ...opts, from });
};

const sendCampaignBatch = async ({
  recipients,
  storefront,
  subject,
  body,
}: {
  recipients: string[];
  storefront: StorefrontCode;
  subject: string;
  body: string;
}) => {
  let sentCount = 0;
  const failedRecipients: string[] = [];
  const fallbackOrigin = getStorefrontOrigin(storefront);

  for (let index = 0; index < recipients.length; index += 20) {
    const batch = recipients.slice(index, index + 20);
    const results = await Promise.allSettled(
      batch.map(async (recipient) => {
        const email = buildNewsletterCampaignEmail({
          storefront,
          recipientEmail: recipient,
          subject,
          body,
          fallbackOrigin,
        });
        await sendEmail({
          to: recipient,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
      }),
    );

    results.forEach((result, batchIndex) => {
      if (result.status === "fulfilled") {
        sentCount += 1;
        return;
      }

      failedRecipients.push(batch[batchIndex] ?? "unknown");
    });
  }

  return {
    sentCount,
    failedRecipients,
  };
};

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getNewsletterAudienceSummary();
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin-newsletters:${session.user.id}:${ip}`,
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Newsletter-Aktionen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "test" | "campaign";
    storefront?: string;
    recipient?: string;
    subject?: string;
    body?: string;
  };

  const mode = body.mode;
  const storefront = parseStorefront(body.storefront) ?? "MAIN";
  const recipient = toSafeString(body.recipient).toLowerCase();
  const subject = toSafeString(body.subject);
  const message = toSafeString(body.body);

  if (mode !== "test" && mode !== "campaign") {
    return NextResponse.json({ error: "Invalid newsletter mode" }, { status: 400 });
  }

  if (!subject || !message) {
    return NextResponse.json(
      { error: "Newsletter subject and body are required" },
      { status: 400 },
    );
  }

  if (mode === "test") {
    if (!recipient || !isValidEmail(recipient)) {
      return NextResponse.json(
        { error: "Enter a valid test recipient email." },
        { status: 400 },
      );
    }

    const email = buildNewsletterCampaignEmail({
      storefront,
      recipientEmail: recipient,
      subject,
      body: message,
      fallbackOrigin: getStorefrontOrigin(storefront),
    });

    try {
      await sendEmail({
        to: recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Newsletter send failed." },
        { status: 500 },
      );
    }

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "newsletter.test.send",
      targetType: "newsletter",
      targetId: recipient,
      summary: `Sent ${STOREFRONT_LABELS[storefront]} newsletter test to ${recipient}`,
      metadata: {
        storefront,
        recipient,
        subject,
      },
    });

    return NextResponse.json({ ok: true, mode, recipient });
  }

  const audience = await getStorefrontNewsletterAudience(storefront);
  if (audience.recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          audience.unresolvedRecipientCount > 0
            ? `No active recipients have exact ${STOREFRONT_LABELS[storefront]} attribution yet. ${audience.unresolvedRecipientCount} recipient(s) remain unresolved and are excluded from storefront-specific sends.`
            : "There are no active newsletter recipients to send to for this storefront.",
      },
      { status: 409 },
    );
  }

  const result = await sendCampaignBatch({
    recipients: audience.recipients,
    storefront,
    subject,
    body: message,
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "newsletter.campaign.send",
    targetType: "newsletter",
    targetId: storefront,
    summary: `Sent ${STOREFRONT_LABELS[storefront]} newsletter campaign`,
    metadata: {
      storefront,
      subject,
      attemptedRecipientCount: audience.recipients.length,
      sentCount: result.sentCount,
      failedCount: result.failedRecipients.length,
      unresolvedRecipientCount: audience.unresolvedRecipientCount,
      failedRecipients: result.failedRecipients.slice(0, 25),
    },
  });

  return NextResponse.json({
    ok: true,
    mode,
    storefront,
    audienceCount: audience.recipients.length,
    sentCount: result.sentCount,
    failedCount: result.failedRecipients.length,
    unresolvedCount: audience.unresolvedRecipientCount,
    failedRecipients: result.failedRecipients.slice(0, 10),
  });
}
