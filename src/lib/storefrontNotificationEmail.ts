import "server-only";

import { buildUnsubscribeUrl } from "@/lib/newsletterToken";
import {
  getStorefrontEmailBrand,
  getStorefrontLinks,
} from "@/lib/storefrontEmailBrand";
import type { CheckoutRecoveryCartSummary } from "@/lib/checkoutRecovery";
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
  step = 1,
  recoveryUrl,
  cartSummary,
  promoCode,
  promoMessage,
  fallbackOrigin,
}: {
  storefront: StorefrontCode;
  recipientEmail: string;
  sessionId: string;
  step?: number;
  recoveryUrl?: string;
  cartSummary?: CheckoutRecoveryCartSummary;
  promoCode?: string | null;
  promoMessage?: string | null;
  fallbackOrigin?: string | null;
}) => {
  const brand = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, fallbackOrigin);
  const resolvedRecoveryUrl = recoveryUrl || `${links.origin}/cart`;
  const resolvedCartSummary =
    cartSummary ?? {
      currency: "EUR",
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 0,
      items: [],
    };
  const formatMoney = (cents: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: resolvedCartSummary.currency || "EUR",
    }).format(cents / 100);
  const stepLabel =
    step === 1 ? "Dein Warenkorb wartet" : step === 2 ? "Fast geschafft" : "Letzte Erinnerung";
  const subject =
    step === 1
      ? `Dein Warenkorb wartet noch bei ${brand.brandName}`
      : step === 2
        ? `Schließe deinen Einkauf bei ${brand.brandName} ab`
        : `Letzte Erinnerung zu deinem Warenkorb bei ${brand.brandName}`;
  const intro =
    step === 1
      ? "Du hast einen Checkout gestartet, aber noch nicht abgeschlossen."
      : step === 2
        ? "Dein Warenkorb ist noch verfügbar. Wenn du weitermachen möchtest, kannst du direkt dort fortsetzen."
        : "Falls du noch bestellen möchtest, kannst du deinen Warenkorb jetzt mit einem Klick wiederherstellen.";
  const itemMarkup = resolvedCartSummary.items
    .slice(0, 4)
    .map(
      (item) => `
      <div style="display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid ${brand.panelBorderColor};">
        <div style="font-size:14px;color:${brand.textColor};">${escapeHtml(item.name)} × ${item.quantity}</div>
        <div style="font-size:14px;font-weight:600;color:${brand.textColor};white-space:nowrap;">${escapeHtml(formatMoney(item.lineTotalCents))}</div>
      </div>`,
    )
    .join("");
  const promoBlock =
    promoCode || promoMessage
      ? `
      <div style="margin-top:20px;border:1px solid ${brand.noticeBorderColor};background:${brand.noticeBackgroundColor};border-radius:14px;padding:16px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${brand.subtleTextColor};margin-bottom:8px;">Angebot</div>
        ${promoMessage ? `<div style="font-size:14px;color:${brand.textColor};margin-bottom:${promoCode ? "10px" : "0"};">${escapeHtml(promoMessage)}</div>` : ""}
        ${promoCode ? `<div style="font-size:15px;font-weight:700;color:${brand.textColor};">Code: ${escapeHtml(promoCode)}</div>` : ""}
      </div>`
      : "";
  const text = [
    intro,
    "",
    "Wenn du weitermachen möchtest, kannst du deinen Warenkorb hier wiederherstellen:",
    resolvedRecoveryUrl,
    "",
    `Warenkorbwert: ${formatMoney(resolvedCartSummary.totalCents)}`,
    ...resolvedCartSummary.items
      .slice(0, 4)
      .map((item) => `- ${item.name} × ${item.quantity}`),
    ...(promoCode ? ["", `Code: ${promoCode}`] : []),
    ...(promoMessage ? [promoMessage] : []),
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
    title: stepLabel,
    subtitle: "Du kannst deinen Warenkorb mit einem Klick wiederherstellen.",
    footerReason: `Du erhältst diese E-Mail, weil du einen Checkout bei ${brand.brandName} begonnen und dem Erhalt von Erinnerungs-E-Mails zugestimmt hast.`,
    bodyHtml: `
      <p style="margin:0 0 18px;font-size:15px;color:${brand.mutedTextColor};">${escapeHtml(intro)}</p>
      <div style="border:1px solid ${brand.panelBorderColor};border-radius:16px;padding:18px 20px;background:${brand.panelBackgroundColor};">
        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:${resolvedCartSummary.items.length > 0 ? "10px" : "0"};">
          <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${brand.subtleTextColor};">Warenkorb</div>
          <div style="font-size:14px;font-weight:700;color:${brand.textColor};">${escapeHtml(formatMoney(resolvedCartSummary.totalCents))}</div>
        </div>
        ${itemMarkup || `<div style="font-size:14px;color:${brand.mutedTextColor};">Dein gespeicherter Warenkorb ist bereit.</div>`}
      </div>
      ${promoBlock}
      <div style="text-align:center;margin:28px 0;">
        <a href="${resolvedRecoveryUrl}" style="display:inline-block;padding:14px 32px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">Warenkorb wiederherstellen &rarr;</a>
      </div>
      <div style="height:1px;background:${brand.panelBorderColor};margin:24px 0;"></div>
      <div style="font-size:12px;color:${brand.subtleTextColor};text-align:center;">Referenz: ${escapeHtml(sessionId)}</div>`,
  });

  return { subject, text, html };
};
