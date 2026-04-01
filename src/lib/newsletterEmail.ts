import "server-only";

import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import {
  getStorefrontEmailBrand,
  getStorefrontLinks,
} from "@/lib/storefrontEmailBrand";
import { type StorefrontCode } from "@/lib/storefronts";

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const toParagraphHtml = (body: string) =>
  body
    .split("\n")
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 14px;font-size:15px;color:#4b5563;line-height:1.7;">${escapeHtml(line)}</p>`
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
  const bodyHtml = toParagraphHtml(body);
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
<div style="background:${meta.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:${meta.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:${meta.headerColor};padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${meta.accentColor};margin-bottom:16px;">${meta.brandName}</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;">${escapeHtml(subject)}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              ${bodyHtml}
              <div style="text-align:center;margin:24px 0 0;">
                <a href="${links.shopUrl}" style="display:inline-block;padding:13px 30px;background:${meta.headerColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">${meta.ctaLabel} &rarr;</a>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
                © ${new Date().getFullYear()} ${meta.brandName} &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${links.shopUrl}" style="color:#9ca3af;text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${links.privacyUrl}" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${links.termsUrl}" style="color:#9ca3af;text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:#d1d5db;margin-top:10px;line-height:1.6;">
                ${escapeHtml(meta.footerDescription)}<br />
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
<div style="background:${meta.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#1a2a22;line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:${meta.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:${meta.headerColor};padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${meta.accentColor};margin-bottom:16px;">${meta.brandName}</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">Willkommen!</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.65);">Du bist jetzt Teil unseres Newsletters.</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">
              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Vielen Dank für deine Anmeldung! Du erhältst ab sofort exklusive Angebote, Neuheiten und Aktionen direkt in dein Postfach.</p>
              <div style="text-align:center;margin:28px 0;">
                <a href="${links.shopUrl}" style="display:inline-block;padding:14px 32px;background:${meta.headerColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:8px;">${meta.ctaLabel} &rarr;</a>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
                © ${new Date().getFullYear()} ${meta.brandName} &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${links.shopUrl}" style="color:#9ca3af;text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${links.privacyUrl}" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${links.termsUrl}" style="color:#9ca3af;text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:#d1d5db;margin-top:10px;line-height:1.6;">
                ${escapeHtml(meta.footerDescription)}<br />
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
