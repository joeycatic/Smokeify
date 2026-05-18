import "server-only";

import {
  getStorefrontEmailBrand,
  getStorefrontLinks,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import type { StorefrontCode } from "@/lib/storefronts";

type RefundRequestEmailInput = {
  orderId: string;
  customerName?: string | null;
};

type RefundRequestEmailOptions = {
  storefront?: StorefrontCode | null;
  fallbackOrigin?: string | null;
  refundRequestUrl: string;
};

export function buildRefundRequestEmail(
  input: RefundRequestEmailInput,
  options: RefundRequestEmailOptions,
) {
  const storefront = resolveStorefrontEmailBrand(options.storefront, [
    options.fallbackOrigin,
    options.refundRequestUrl,
  ]);
  const brand = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, options.fallbackOrigin);
  const orderNumber = input.orderId.slice(0, 8).toUpperCase();
  const greetingName = input.customerName?.trim() || "there";
  const subject = `${brand.brandName} Rückerstattungsformular für ${orderNumber}`;

  const text = [
    `Hallo ${greetingName},`,
    "",
    `für deine Bestellung ${orderNumber} haben wir ein Rückerstattungsformular vorbereitet.`,
    "Öffne den sicheren Link unten und teile uns mit, welche Artikel betroffen sind und warum du die Erstattung anfragen möchtest.",
    "",
    `Formular öffnen: ${options.refundRequestUrl}`,
    "",
    `Wenn du Fragen hast, antworte einfach auf diese E-Mail oder besuche ${links.shopUrl}.`,
  ].join("\n");

  const html = `
<div style="background:${brand.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:${brand.textColor};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td height="4" style="background-color:${brand.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:${brand.heroBackground};padding:32px 32px 28px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${brand.heroLabelColor};margin-bottom:16px;">
                ${brand.brandName}
              </div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">
                Rückerstattungsformular
              </div>
              <div style="font-size:14px;color:${brand.heroMutedTextColor};">
                Teile uns über einen sicheren Link mit, welche Positionen deiner Bestellung erstattet werden sollen.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:${brand.cardBackgroundColor};padding:32px;border:1px solid ${brand.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">
              <div style="font-size:15px;color:${brand.textColor};">Hallo ${greetingName},</div>
              <div style="margin-top:16px;font-size:14px;color:${brand.mutedTextColor};">
                für deine Bestellung <strong style="color:${brand.textColor};">${orderNumber}</strong> haben wir ein Rückerstattungsformular vorbereitet.
                Nutze den sicheren Link unten, damit wir deine Angaben direkt der richtigen Bestellung auf ${brand.brandName} zuordnen können.
              </div>

              <div style="margin-top:24px;border:1px solid ${brand.panelBorderColor};border-radius:14px;background:${brand.panelBackgroundColor};padding:20px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${brand.subtleTextColor};margin-bottom:10px;">
                  Was du im Formular angibst
                </div>
                <div style="font-size:14px;color:${brand.mutedTextColor};">
                  Kontaktdaten, betroffene Artikel und den Grund deiner Erstattungsanfrage.
                </div>
              </div>

              <div style="margin-top:28px;text-align:center;">
                <a href="${options.refundRequestUrl}" style="display:inline-block;padding:13px 28px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;">
                  Formular auf ${brand.brandName} öffnen
                </a>
              </div>

              <div style="margin-top:18px;font-size:12px;color:${brand.subtleTextColor};text-align:center;">
                Der Link ist nur für diese Bestellung gedacht und funktioniert direkt auf der passenden Website.
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid ${brand.cardBorderColor};text-align:center;">
              <div style="font-size:12px;color:${brand.footerTextColor};line-height:1.8;">
                © ${new Date().getFullYear()} ${brand.brandName}<br />
                <a href="${links.shopUrl}" style="color:${brand.footerTextColor};text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${links.privacyUrl}" style="color:${brand.footerTextColor};text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${links.termsUrl}" style="color:${brand.footerTextColor};text-decoration:none;">AGB</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;

  return { subject, text, html };
}
