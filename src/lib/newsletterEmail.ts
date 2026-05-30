import "server-only";

import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import {
  escapeHtml,
  renderEmailFooter,
  renderPrimaryButtonStyles,
} from "@/lib/emailTemplateUtils";
import {
  getStorefrontEmailBrand,
  getStorefrontLinks,
} from "@/lib/storefrontEmailBrand";
import { type StorefrontCode } from "@/lib/storefronts";

const toParagraphHtml = (body: string) =>
  body
    .split("\n")
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 14px;font-size:15px;color:VAR_MUTED_TEXT;line-height:1.7;">${escapeHtml(line)}</p>`
        : `<div style="height:8px;"></div>`,
    )
    .join("");

export const buildNewsletterCampaignEmail = ({
  storefront,
  recipientEmail,
  subject,
  body,
  fallbackOrigin,
}: {
  storefront: StorefrontCode;
  recipientEmail: string;
  subject: string;
  body: string;
  fallbackOrigin?: string | null;
}) => {
  const meta = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, fallbackOrigin);
  const unsubscribeUrl = buildUnsubscribeUrl(links.origin, recipientEmail);
  const bodyHtml = toParagraphHtml(body).replaceAll(
    "VAR_MUTED_TEXT",
    meta.mutedTextColor,
  );
  const text = [
    subject,
    "",
    body,
    "",
    `${meta.ctaLabel}: ${links.shopUrl}`,
    "",
    "Abmelden:",
    unsubscribeUrl,
    "",
    meta.footerDescription,
  ].join("\n");

  const html = `
<div style="background:${meta.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:${meta.textColor};line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:${meta.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:${meta.heroBackground};background-color:${meta.headerColor};padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${meta.heroLabelColor};margin-bottom:16px;">${meta.brandName}</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;">${escapeHtml(subject)}</div>
            </td>
          </tr>
          <tr>
            <td style="background:${meta.cardBackgroundColor};padding:32px;border:1px solid ${meta.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">
              ${bodyHtml}
              <div style="text-align:center;margin:24px 0 0;">
                <a href="${escapeHtml(links.shopUrl)}" style="${renderPrimaryButtonStyles(meta)}">${meta.ctaLabel} &rarr;</a>
              </div>
            </td>
          </tr>
        </table>
        ${renderEmailFooter({
          brand: meta,
          links,
          footerReason: meta.footerDescription,
          unsubscribeUrl,
        })}
      </td>
    </tr>
  </table>
</div>`;

  return { subject, text, html };
};

export const buildNewsletterConfirmationEmail = ({
  storefront,
  recipientEmail,
  fallbackOrigin,
}: {
  storefront: StorefrontCode;
  recipientEmail: string;
  fallbackOrigin?: string | null;
}) => {
  const meta = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, fallbackOrigin);
  const unsubscribeUrl = buildUnsubscribeUrl(links.origin, recipientEmail);
  const subject = `Willkommen im ${meta.brandName} Newsletter`;
  const text = [
    `Vielen Dank für deine Anmeldung zum ${meta.brandName} Newsletter!`,
    "",
    "Du erhältst ab sofort exklusive Angebote, Neuheiten und Aktionen direkt in dein Postfach.",
    "",
    `${meta.ctaLabel}: ${links.shopUrl}`,
    "",
    "Abmelden:",
    unsubscribeUrl,
    "",
    meta.footerDescription,
  ].join("\n");

  const html = `
<div style="background:${meta.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:${meta.textColor};line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:${meta.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:${meta.heroBackground};background-color:${meta.headerColor};padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${meta.heroLabelColor};margin-bottom:16px;">${meta.brandName}</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">Willkommen!</div>
              <div style="font-size:14px;color:${meta.heroMutedTextColor};">Du bist jetzt Teil unseres Newsletters.</div>
            </td>
          </tr>
          <tr>
            <td style="background:${meta.cardBackgroundColor};padding:32px;border:1px solid ${meta.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">
              <p style="margin:0 0 20px;font-size:15px;color:${meta.mutedTextColor};">Vielen Dank für deine Anmeldung! Du erhältst ab sofort exklusive Angebote, Neuheiten und Aktionen direkt in dein Postfach.</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${escapeHtml(links.shopUrl)}" style="${renderPrimaryButtonStyles(meta)}">${meta.ctaLabel} &rarr;</a>
              </div>
            </td>
          </tr>
        </table>
        ${renderEmailFooter({
          brand: meta,
          links,
          footerReason: meta.footerDescription,
          unsubscribeUrl,
        })}
      </td>
    </tr>
  </table>
</div>`;

  return { subject, text, html };
};
