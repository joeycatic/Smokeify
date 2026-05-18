import "server-only";

import {
  getStorefrontEmailBrand,
  getStorefrontLinks,
  resolveStorefrontEmailBrand,
} from "@/lib/storefrontEmailBrand";
import { type StorefrontCode } from "@/lib/storefronts";

type EmailBrand = ReturnType<typeof getStorefrontEmailBrand>;

type OrderItem = {
  name: string;
  quantity: number;
  totalAmount: number;
  currency: string;
};

type OrderEmailInput = {
  id: string;
  createdAt: Date;
  currency: string;
  amountSubtotal: number;
  amountTax: number;
  amountShipping: number;
  amountDiscount: number;
  amountTotal: number;
  amountRefunded?: number;
  discountCode?: string | null;
  customerEmail?: string | null;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  items: OrderItem[];
};

type EmailType =
  | "confirmation"
  | "shipping"
  | "refund"
  | "return_confirmation"
  | "cancellation";

type OrderEmailOptions = {
  storefront?: StorefrontCode | null;
  fallbackOrigin?: string | null;
  receiptUrl?: string;
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const normalizeItemName = (name: string) => {
  const defaultSuffix = /\s*[-—]\s*Default( Title)?(?=\s*\(|$)/i;
  return name.replace(defaultSuffix, "").trim();
};

const renderItemsText = (items: OrderItem[]) =>
  items
    .map(
      (item) =>
        `- ${normalizeItemName(item.name)} (x${item.quantity}) ${formatPrice(item.totalAmount, item.currency)}`,
    )
    .join("\n");

const renderItemsHtml = (items: OrderItem[], brand: EmailBrand) =>
  items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:12px 0;font-size:14px;font-weight:600;color:${brand.textColor};border-top:${i === 0 ? "none" : `1px solid ${brand.panelBorderColor}`};">${normalizeItemName(item.name)}</td>
        <td style="padding:12px 0;font-size:14px;color:${brand.mutedTextColor};text-align:center;width:40px;border-top:${i === 0 ? "none" : `1px solid ${brand.panelBorderColor}`};">×${item.quantity}</td>
        <td style="padding:12px 0;font-size:14px;font-weight:600;color:${brand.textColor};text-align:right;width:110px;border-top:${i === 0 ? "none" : `1px solid ${brand.panelBorderColor}`};">${formatPrice(item.totalAmount, item.currency)}</td>
      </tr>`,
    )
    .join("");

// ─── Shared layout primitives ──────────────────────────────────────────────

const emailOuter = (
  cardRows: string,
  options: {
    brand: EmailBrand;
    shopUrl: string;
    privacyUrl: string;
    termsUrl: string;
  },
) => `
<div style="background:${options.brand.backgroundColor};padding:32px 0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:${options.brand.textColor};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          ${cardRows}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid ${options.brand.cardBorderColor};text-align:center;">
              <div style="font-size:12px;color:${options.brand.footerTextColor};line-height:1.8;">
                © ${new Date().getFullYear()} ${options.brand.brandName} &nbsp;·&nbsp; Alle Rechte vorbehalten<br />
                <a href="${options.shopUrl}" style="color:${options.brand.footerTextColor};text-decoration:none;">Shop</a>
                &nbsp;·&nbsp;
                <a href="${options.privacyUrl}" style="color:${options.brand.footerTextColor};text-decoration:none;">Datenschutz</a>
                &nbsp;·&nbsp;
                <a href="${options.termsUrl}" style="color:${options.brand.footerTextColor};text-decoration:none;">AGB</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;

const emailHeader = (
  title: string,
  subtitle: string,
  options: {
    brand: EmailBrand;
    headerBackground: string;
    headerColor: string;
  },
) => `
  <tr>
    <td height="4" style="background-color:${options.brand.accentColor};border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td style="background:${options.headerBackground};background-color:${options.headerColor};padding:32px 32px 28px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${options.brand.heroLabelColor};margin-bottom:16px;">${options.brand.brandName}</div>
      <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">${title}</div>
      <div style="font-size:14px;color:${options.brand.heroMutedTextColor};">${subtitle}</div>
    </td>
  </tr>`;

const sectionLabel = (text: string, brand: EmailBrand) =>
  `<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${brand.subtleTextColor};margin-bottom:10px;">${text}</div>`;

const divider = (brand: EmailBrand) =>
  `<div style="height:1px;background:${brand.panelBorderColor};margin:24px 0;"></div>`;

const primaryBtn = (href: string, label: string, brand: EmailBrand) =>
  `<a href="${href}" style="display:inline-block;padding:13px 28px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;margin:4px;">${label}</a>`;

const secondaryBtn = (href: string, label: string, brand: EmailBrand) =>
  `<a href="${href}" style="display:inline-block;padding:13px 28px;background:${brand.secondaryButtonBackgroundColor};color:${brand.secondaryButtonTextColor};text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;margin:4px;">${label}</a>`;

// ─── Main builder ──────────────────────────────────────────────────────────

export function buildOrderEmail(
  type: EmailType,
  order: OrderEmailInput,
  orderUrl?: string,
  invoiceUrl?: string,
  options?: OrderEmailOptions,
) {
  const storefront = resolveStorefrontEmailBrand(options?.storefront, [
    options?.fallbackOrigin,
  ]);
  const brand = getStorefrontEmailBrand(storefront);
  const links = getStorefrontLinks(storefront, options?.fallbackOrigin);
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const receiptUrl = storefront === "MAIN" ? options?.receiptUrl : undefined;
  const discountLabel = order.discountCode
    ? `Rabatt (${order.discountCode})`
    : "Rabatt";

  const headerTitle =
    type === "confirmation"
      ? "Bestellung bestätigt"
      : type === "shipping"
        ? "Dein Paket ist unterwegs"
        : type === "refund"
          ? "Rückerstattung verarbeitet"
          : type === "return_confirmation"
            ? "Rücksendung bestätigt"
            : "Bestellung storniert";

  const headerSubtitle =
    type === "confirmation"
      ? `Danke für deine Bestellung bei ${brand.brandName}.`
      : type === "shipping"
      ? "Wir haben dein Paket auf den Weg gebracht."
      : type === "refund"
          ? "Der Betrag wird in Kürze gutgeschrieben."
          : type === "return_confirmation"
            ? "Wir haben deine Rücksendung erhalten."
            : "Deine Bestellung wurde storniert.";

  const headerColor = type === "cancellation" ? "#374151" : brand.headerColor;
  const headerBackground =
    type === "cancellation"
      ? "linear-gradient(135deg,#374151 0%,#4b5563 100%)"
      : brand.heroBackground;

  const orderDate = new Date(order.createdAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const totalsText = [
    `Zwischensumme: ${formatPrice(order.amountSubtotal, order.currency)}`,
    order.amountDiscount > 0
      ? `${discountLabel}: -${formatPrice(order.amountDiscount, order.currency)}`
      : null,
    `Steuern: ${formatPrice(order.amountTax, order.currency)}`,
    `Versand: ${formatPrice(order.amountShipping, order.currency)}`,
    `Gesamt: ${formatPrice(order.amountTotal, order.currency)}`,
  ]
    .filter(Boolean)
    .join("\n");

  // ── Confirmation / Return / Cancellation ────────────────────────────────
  if (
    type === "confirmation" ||
    type === "return_confirmation" ||
    type === "cancellation"
  ) {
    const subject =
      type === "confirmation"
        ? `Bestellbestätigung ${orderNumber}`
        : type === "return_confirmation"
          ? `Rücksendung bestätigt ${orderNumber}`
          : `Bestellung storniert ${orderNumber}`;

    const introLine =
      type === "confirmation"
        ? `Danke für deine Bestellung ${orderNumber} bei ${brand.brandName}.`
        : type === "return_confirmation"
          ? `Wir haben deine Rücksendung für Bestellung ${orderNumber} erhalten.`
          : `Deine Bestellung ${orderNumber} wurde storniert.`;

    const statusNote =
      type !== "confirmation"
        ? `<div style="margin-bottom:24px;padding:14px 16px;background:${brand.noticeBackgroundColor};border-left:3px solid ${brand.noticeBorderColor};border-radius:0 8px 8px 0;font-size:14px;color:${brand.textColor};">${introLine}</div>`
        : "";
    const reviewInviteText =
      type === "confirmation"
        ? "Bewerte deine gekauften Produkte in deinem Konto und sichere dir optional einen Dankes-Gutschein."
        : null;
    const reviewInviteHtml =
      type === "confirmation"
        ? `<div style="margin-top:20px;padding:12px 14px;background:${brand.panelBackgroundColor};border:1px solid ${brand.panelBorderColor};border-radius:10px;font-size:13px;color:${brand.mutedTextColor};">Bewerte deine gekauften Produkte in deinem Konto und sichere dir optional einen Dankes-Gutschein.</div>`
        : "";

    return {
      subject,
      text: [
        introLine,
        "",
        renderItemsText(order.items),
        "",
        totalsText,
        reviewInviteText ? `\n${reviewInviteText}` : "",
        orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
        invoiceUrl ? `Rechnung herunterladen: ${invoiceUrl}` : "",
        receiptUrl ? `Beleg herunterladen: ${receiptUrl}` : "",
      ].join("\n"),
      html: emailOuter(`
        ${emailHeader(headerTitle, headerSubtitle, {
          brand,
          headerBackground,
          headerColor,
        })}
        <tr>
          <td style="background:${brand.cardBackgroundColor};padding:32px;border:1px solid ${brand.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">

            ${statusNote}

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:top;">
                  ${sectionLabel("Bestellnummer", brand)}
                  <div style="font-size:22px;font-weight:700;color:${brand.textColor};font-family:monospace;">${orderNumber}</div>
                  <div style="font-size:13px;color:${brand.subtleTextColor};margin-top:4px;">${orderDate}</div>
                </td>
                <td style="vertical-align:top;text-align:right;">
                  ${sectionLabel("Gesamt", brand)}
                  <div style="font-size:22px;font-weight:700;color:${brand.emphasisColor};">${formatPrice(order.amountTotal, order.currency)}</div>
                </td>
              </tr>
            </table>

            ${divider(brand)}

            ${sectionLabel("Artikel", brand)}
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              ${renderItemsHtml(order.items, brand)}
            </table>

            ${divider(brand)}

            ${sectionLabel("Zahlungsübersicht", brand)}
            <div style="background:${brand.panelBackgroundColor};border:1px solid ${brand.panelBorderColor};border-radius:10px;padding:20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size:14px;color:${brand.mutedTextColor};padding:4px 0;">Zwischensumme</td>
                  <td style="font-size:14px;color:${brand.textColor};text-align:right;padding:4px 0;">${formatPrice(order.amountSubtotal, order.currency)}</td>
                </tr>
                ${
                  order.amountDiscount > 0
                    ? `<tr>
                  <td style="font-size:14px;color:${brand.mutedTextColor};padding:4px 0;">${discountLabel}</td>
                  <td style="font-size:14px;color:#059669;text-align:right;padding:4px 0;">−${formatPrice(order.amountDiscount, order.currency)}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="font-size:14px;color:${brand.mutedTextColor};padding:4px 0;">Steuern</td>
                  <td style="font-size:14px;color:${brand.textColor};text-align:right;padding:4px 0;">${formatPrice(order.amountTax, order.currency)}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:${brand.mutedTextColor};padding:4px 0 8px;">Versand</td>
                  <td style="font-size:14px;color:${brand.textColor};text-align:right;padding:4px 0 8px;">${formatPrice(order.amountShipping, order.currency)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="height:1px;background:${brand.panelBorderColor};padding:0;font-size:0;"></td>
                </tr>
                <tr>
                  <td style="font-size:15px;font-weight:700;color:${brand.textColor};padding:12px 0 2px;">Gesamt</td>
                  <td style="font-size:15px;font-weight:700;color:${brand.emphasisColor};text-align:right;padding:12px 0 2px;">${formatPrice(order.amountTotal, order.currency)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:12px;color:${brand.subtleTextColor};padding-bottom:2px;">inkl. MwSt.</td>
                </tr>
              </table>
            </div>

            ${
              orderUrl || invoiceUrl || receiptUrl
                ? `<div style="margin-top:28px;text-align:center;">
                ${orderUrl ? primaryBtn(orderUrl, "Bestellung ansehen", brand) : ""}
                ${invoiceUrl ? secondaryBtn(invoiceUrl, "Rechnung herunterladen", brand) : ""}
                ${receiptUrl ? secondaryBtn(receiptUrl, "Beleg herunterladen", brand) : ""}
              </div>`
                : ""
            }
            ${reviewInviteHtml}

          </td>
        </tr>`, {
        brand,
        shopUrl: links.shopUrl,
        privacyUrl: links.privacyUrl,
        termsUrl: links.termsUrl,
      }),
    };
  }

  // ── Shipping ─────────────────────────────────────────────────────────────
  if (type === "shipping") {
    const trackingRows = [
      order.trackingCarrier
        ? `<tr>
            <td style="font-size:13px;color:${brand.mutedTextColor};padding:8px 0;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;padding-right:24px;">Versanddienst</td>
            <td style="font-size:14px;color:${brand.textColor};text-align:right;padding:8px 0;font-weight:600;">${order.trackingCarrier}</td>
          </tr>`
        : null,
      order.trackingNumber
        ? `<tr>
            <td style="font-size:13px;color:${brand.mutedTextColor};padding:8px 0;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;padding-right:24px;">Trackingnummer</td>
            <td style="font-size:14px;color:${brand.textColor};text-align:right;padding:8px 0;font-family:monospace;font-weight:600;">${order.trackingNumber}</td>
          </tr>`
        : null,
    ]
      .filter(Boolean)
      .join("");

    const trackingLines = [
      order.trackingCarrier ? `Versanddienst: ${order.trackingCarrier}` : null,
      order.trackingNumber ? `Trackingnummer: ${order.trackingNumber}` : null,
      order.trackingUrl ? `Tracking-URL: ${order.trackingUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      subject: `Versandupdate ${orderNumber}`,
      text: [
        `Deine Bestellung ${orderNumber} wurde versendet.`,
        "",
        trackingLines || "Trackingdaten folgen in Kürze.",
        orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
      ].join("\n"),
      html: emailOuter(`
        ${emailHeader(headerTitle, headerSubtitle, {
          brand,
          headerBackground,
          headerColor,
        })}
        <tr>
          <td style="background:${brand.cardBackgroundColor};padding:32px;border:1px solid ${brand.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:top;">
                  ${sectionLabel("Bestellnummer", brand)}
                  <div style="font-size:22px;font-weight:700;color:${brand.textColor};font-family:monospace;">${orderNumber}</div>
                  <div style="font-size:13px;color:${brand.subtleTextColor};margin-top:4px;">${orderDate}</div>
                </td>
              </tr>
            </table>

            ${divider(brand)}

            ${sectionLabel("Versandinformationen", brand)}
            ${
              trackingRows
                ? `<div style="background:${brand.panelBackgroundColor};border:1px solid ${brand.panelBorderColor};border-radius:10px;padding:20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  ${trackingRows}
                </table>
                ${
                  order.trackingUrl
                    ? `<div style="margin-top:18px;">
                    <a href="${order.trackingUrl}" style="display:inline-block;padding:12px 24px;background:${brand.buttonBackgroundColor};color:${brand.buttonTextColor};text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;">Paket verfolgen &rarr;</a>
                  </div>`
                    : ""
                }
              </div>`
                : `<p style="font-size:14px;color:${brand.mutedTextColor};margin:0;">Trackingdaten folgen in Kürze.</p>`
            }

            ${
              orderUrl
                ? `<div style="margin-top:28px;text-align:center;">
                ${primaryBtn(orderUrl, "Bestellung ansehen", brand)}
              </div>`
                : ""
            }

          </td>
        </tr>`, {
        brand,
        shopUrl: links.shopUrl,
        privacyUrl: links.privacyUrl,
        termsUrl: links.termsUrl,
      }),
    };
  }

  // ── Refund ────────────────────────────────────────────────────────────────
  const refundedAmount =
    typeof order.amountRefunded === "number" ? order.amountRefunded : 0;

  return {
    subject: `Rückerstattung ${orderNumber}`,
    text: [
      `Deine Rückerstattung für Bestellung ${orderNumber} wurde verarbeitet.`,
      `Rückerstattet: ${formatPrice(refundedAmount, order.currency)}`,
      orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
    ].join("\n"),
    html: emailOuter(`
      ${emailHeader(headerTitle, headerSubtitle, {
        brand,
        headerBackground,
        headerColor,
      })}
      <tr>
        <td style="background:${brand.cardBackgroundColor};padding:32px;border:1px solid ${brand.cardBorderColor};border-top:none;border-radius:0 0 14px 14px;">

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align:top;">
                ${sectionLabel("Bestellnummer", brand)}
                <div style="font-size:22px;font-weight:700;color:${brand.textColor};font-family:monospace;">${orderNumber}</div>
                <div style="font-size:13px;color:${brand.subtleTextColor};margin-top:4px;">${orderDate}</div>
              </td>
            </tr>
          </table>

          ${divider(brand)}

          ${sectionLabel("Rückerstattungsbetrag", brand)}
          <div style="background:${brand.noticeBackgroundColor};border-radius:12px;padding:28px;text-align:center;border:1px solid ${brand.noticeBorderColor};">
            <div style="font-size:38px;font-weight:700;color:${brand.emphasisColor};">${formatPrice(refundedAmount, order.currency)}</div>
            <div style="font-size:13px;color:${brand.mutedTextColor};margin-top:8px;">wird innerhalb von 5–10 Werktagen gutgeschrieben</div>
          </div>

          ${
            orderUrl
              ? `<div style="margin-top:28px;text-align:center;">
              ${primaryBtn(orderUrl, "Bestellung ansehen", brand)}
            </div>`
              : ""
          }

        </td>
      </tr>`, {
      brand,
      shopUrl: links.shopUrl,
      privacyUrl: links.privacyUrl,
      termsUrl: links.termsUrl,
    }),
  };
}
