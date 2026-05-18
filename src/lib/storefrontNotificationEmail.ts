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

const buildEmailShell = ({
  storefront,
  title,
  subtitle,
  bodyHtml,
  footerReason,
  recipientEmail,
  fallbackOrigin,
}: {
  storefront: StorefrontCode;
  title: string;
  subtitle: string;
  bodyHtml: string;
  footerReason: string;
  recipientEmail: string;
  fallbackOrigin?: string | null;
}) => {
  const brand = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, fallbackOrigin);
  const unsubscribeUrl = buildUnsubscribeUrl(links.origin, recipientEmail);

  return `
<div style="background:${brand.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:${brand.textColor};line-height:1.6;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:${brand.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:${brand.heroBackground};background-color:${brand.headerColor};padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${brand.heroLabelColor};margin-bottom:16px;">${brand.brandName}</div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">${escapeHtml(title)}</div>
              <div style="font-size:14px;color:${brand.heroMutedTextColor};">${escapeHtml(subtitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="background:${brand.cardBackgroundColor};padding:32px;border:1px solid ${brand.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid ${brand.cardBorderColor};text-align:center;">
              <div style="font-size:12px;color:${brand.footerTextColor};line-height:1.8;">
                © ${new Date().getFullYear()} ${brand.brandName} &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${links.shopUrl}" style="color:${brand.footerTextColor};text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${links.privacyUrl}" style="color:${brand.footerTextColor};text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${links.termsUrl}" style="color:${brand.footerTextColor};text-decoration:none;">AGB</a>
              </div>
              <div style="font-size:11px;color:${brand.footerMutedTextColor};margin-top:10px;line-height:1.6;">
                ${escapeHtml(footerReason)}<br />
                <a href="${unsubscribeUrl}" style="color:${brand.footerTextColor};text-decoration:underline;">E-Mail-Benachrichtigungen abmelden</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
};

export const buildBackInStockEmail = ({
  storefront,
  recipientEmail,
  productTitle,
  variantTitle,
  fallbackOrigin,
}: {
  storefront: StorefrontCode;
  recipientEmail: string;
  productTitle: string;
  variantTitle?: string | null;
  fallbackOrigin?: string | null;
}) => {
  const brand = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, fallbackOrigin);
  const lineTitle = productTitle.trim() || "Dein Artikel";
  const trimmedVariant = variantTitle?.trim();
  const displayTitle = trimmedVariant
    ? `${lineTitle} (${trimmedVariant})`
    : lineTitle;
  const subject = `Benachrichtigung eingerichtet – ${brand.brandName}`;
  const text = [
    `Wir benachrichtigen dich, sobald "${displayTitle}" wieder verfügbar ist.`,
    "",
    "Du erhältst eine E-Mail, sobald der Artikel wieder auf Lager ist.",
    "",
    `Zum Shop: ${links.shopUrl}`,
    "",
    "Du erhältst diese E-Mail, weil du eine Benachrichtigung für diesen Artikel angefordert hast.",
    `Abmelden: ${buildUnsubscribeUrl(links.origin, recipientEmail)}`,
  ].join("\n");

  const html = buildEmailShell({
    storefront,
    recipientEmail,
    fallbackOrigin,
    title: "Benachrichtigung eingerichtet",
    subtitle: "Wir geben dir Bescheid, sobald der Artikel wieder verfügbar ist.",
    footerReason:
      "Du erhältst diese E-Mail, weil du eine Benachrichtigung für diesen Artikel angefordert hast.",
    bodyHtml: `
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${brand.subtleTextColor};margin-bottom:10px;">Artikel</div>
      <div style="background:${brand.panelBackgroundColor};border-radius:12px;padding:18px 20px;font-size:15px;font-weight:600;color:${brand.textColor};border:1px solid ${brand.panelBorderColor};">${escapeHtml(displayTitle)}</div>
      <div style="height:1px;background:${brand.panelBorderColor};margin:24px 0;"></div>
      <p style="margin:0;font-size:14px;color:${brand.mutedTextColor};">Wir senden dir eine E-Mail, sobald dieser Artikel wieder auf Lager ist. Du musst nichts weiter tun.</p>
      <div style="text-align:center;margin:24px 0 0;">
        <a href="${links.shopUrl}" style="display:inline-block;padding:12px 28px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;">Zum Shop &rarr;</a>
      </div>`,
  });

  return { subject, text, html };
};

export const buildCheckoutRecoveryEmail = ({
  storefront,
  recipientEmail,
  sessionId,
  fallbackOrigin,
}: {
  storefront: StorefrontCode;
  recipientEmail: string;
  sessionId: string;
  fallbackOrigin?: string | null;
}) => {
  const brand = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, fallbackOrigin);
  const cartUrl = `${links.origin}/cart`;
  const subject = `Dein Warenkorb wartet noch bei ${brand.brandName}`;
  const text = [
    "Du hast einen Checkout gestartet, aber noch nicht abgeschlossen.",
    "",
    "Wenn du weitermachen möchtest, findest du deinen Warenkorb hier:",
    cartUrl,
    "",
    `Referenz: ${sessionId}`,
    "",
    `Du erhältst diese E-Mail, weil du einen Checkout bei ${brand.brandName} begonnen und dem Erhalt von Erinnerungs-E-Mails zugestimmt hast.`,
    `Abmelden: ${buildUnsubscribeUrl(links.origin, recipientEmail)}`,
  ].join("\n");

  const html = buildEmailShell({
    storefront,
    recipientEmail,
    fallbackOrigin,
    title: "Dein Warenkorb wartet",
    subtitle: "Du kannst deinen Checkout jederzeit fortsetzen.",
    footerReason: `Du erhältst diese E-Mail, weil du einen Checkout bei ${brand.brandName} begonnen und dem Erhalt von Erinnerungs-E-Mails zugestimmt hast.`,
    bodyHtml: `
      <p style="margin:0 0 20px;font-size:15px;color:${brand.mutedTextColor};">Du hast einen Checkout gestartet, aber noch nicht abgeschlossen. Dein Warenkorb ist noch für dich reserviert.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${cartUrl}" style="display:inline-block;padding:14px 32px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">Checkout fortsetzen &rarr;</a>
      </div>
      <div style="height:1px;background:${brand.panelBorderColor};margin:24px 0;"></div>
      <div style="font-size:12px;color:${brand.subtleTextColor};text-align:center;">Referenz: ${escapeHtml(sessionId)}</div>`,
  });

  return { subject, text, html };
};
