import nodemailer from "nodemailer";
import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  getNewsletterAudienceSummary,
  getStorefrontNewsletterAudience,
} from "@/lib/adminNewsletter";
import { buildNewsletterCampaignEmail } from "@/lib/newsletterEmail";
import { sendResendEmail } from "@/lib/resend";
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

export const GET = withAdminRoute(async () => {
  const summary = await getNewsletterAudienceSummary();
  return adminJson(summary);
});

export const POST = withAdminRoute(
  async ({ request, session }) => {
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
      return adminJson({ error: "Invalid newsletter mode" }, { status: 400 });
    }

    if (!subject || !message) {
      return adminJson(
        { error: "Newsletter subject and body are required" },
        { status: 400 },
      );
    }

    if (mode === "test") {
      if (!recipient || !isValidEmail(recipient)) {
        return adminJson(
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
        return adminJson(
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

      return adminJson({ ok: true, mode, recipient });
    }

    const audience = await getStorefrontNewsletterAudience(storefront);
    if (audience.recipients.length === 0) {
      return adminJson(
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

    return adminJson({
      ok: true,
      mode,
      storefront,
      audienceCount: audience.recipients.length,
      sentCount: result.sentCount,
      failedCount: result.failedRecipients.length,
      unresolvedCount: audience.unresolvedRecipientCount,
      failedRecipients: result.failedRecipients.slice(0, 10),
    });
  },
  {
    rateLimit: {
      keyPrefix: "admin-newsletters",
      limit: 6,
      windowMs: 10 * 60 * 1000,
      message: "Zu viele Newsletter-Aktionen. Bitte später erneut versuchen.",
    },
  },
);
