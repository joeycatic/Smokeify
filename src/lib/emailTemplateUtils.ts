import "server-only";

import { businessDetails } from "@/lib/businessDetails";
import type { StorefrontEmailBrandMeta } from "@/lib/storefrontEmailBrand";

type StorefrontEmailLinks = {
  origin: string;
  shopUrl: string;
  aboutUrl: string;
  contactUrl: string;
  privacyUrl: string;
  termsUrl: string;
  refundUrl: string;
};

export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderPrimaryButtonStyles = (brand: StorefrontEmailBrandMeta) =>
  [
    "display:inline-block",
    "padding:13px 28px",
    `background:${brand.buttonBackgroundColor}`,
    `background-color:${brand.accentColor}`,
    `border:1px solid ${brand.noticeBorderColor}`,
    `color:${brand.buttonTextColor}`,
    "text-decoration:none",
    "font-size:14px",
    "font-weight:700",
    "border-radius:999px",
  ].join(";");

export const renderSecondaryButtonStyles = (brand: StorefrontEmailBrandMeta) =>
  [
    "display:inline-block",
    "padding:13px 28px",
    `background:${brand.secondaryButtonBackgroundColor}`,
    `background-color:${brand.panelBackgroundColor}`,
    `border:1px solid ${brand.panelBorderColor}`,
    `color:${brand.secondaryButtonTextColor}`,
    "text-decoration:none",
    "font-size:14px",
    "font-weight:700",
    "border-radius:999px",
  ].join(";");

export const renderEmailFooter = (options: {
  brand: StorefrontEmailBrandMeta;
  links: StorefrontEmailLinks;
  footerReason?: string | null;
  unsubscribeUrl?: string | null;
}) => {
  const { brand, links, unsubscribeUrl } = options;
  const footerReason = options.footerReason?.trim() || null;
  const contactPhone = businessDetails.contactPhone?.trim() || null;

  return `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:22px 0 0;border-top:1px solid ${brand.cardBorderColor};text-align:center;">
              <div style="font-size:12px;color:${brand.footerTextColor};line-height:1.8;">
                © ${new Date().getFullYear()} ${escapeHtml(brand.brandName)} &nbsp;·&nbsp; Alle Rechte vorbehalten
              </div>
              <div style="margin-top:10px;font-size:11px;color:${brand.footerMutedTextColor};line-height:1.7;">
                Rechtlicher Anbieter: ${escapeHtml(businessDetails.legalName)}<br />
                ${escapeHtml(businessDetails.streetLine)}, ${escapeHtml(businessDetails.cityPostalLine)}, ${escapeHtml(businessDetails.country)}<br />
                <a href="mailto:${escapeHtml(businessDetails.contactEmail)}" style="color:${brand.footerTextColor};text-decoration:underline;">${escapeHtml(businessDetails.contactEmail)}</a>${contactPhone ? ` &nbsp;·&nbsp; ${escapeHtml(contactPhone)}` : ""}
              </div>
              <div style="margin-top:12px;font-size:11px;color:${brand.footerTextColor};line-height:1.9;">
                <a href="${escapeHtml(links.shopUrl)}" style="color:${brand.footerTextColor};text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(links.contactUrl)}" style="color:${brand.footerTextColor};text-decoration:none;">Kontakt</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(links.privacyUrl)}" style="color:${brand.footerTextColor};text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(links.termsUrl)}" style="color:${brand.footerTextColor};text-decoration:none;">AGB</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(links.refundUrl)}" style="color:${brand.footerTextColor};text-decoration:none;">Widerruf</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(links.aboutUrl)}" style="color:${brand.footerTextColor};text-decoration:none;">Über uns</a>
              </div>
              ${
                footerReason || unsubscribeUrl
                  ? `<div style="margin-top:12px;font-size:11px;color:${brand.footerMutedTextColor};line-height:1.7;">
                ${footerReason ? escapeHtml(footerReason) : ""}
                ${
                  unsubscribeUrl
                    ? `${footerReason ? "<br />" : ""}<a href="${escapeHtml(unsubscribeUrl)}" style="color:${brand.footerTextColor};text-decoration:underline;">Benachrichtigungen abbestellen</a>`
                    : ""
                }
              </div>`
                  : ""
              }
            </td>
          </tr>
        </table>`;
};
