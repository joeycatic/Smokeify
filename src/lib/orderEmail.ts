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

const renderItemsHtml = (items: OrderItem[]) =>
  items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:12px 0;font-size:14px;font-weight:600;color:#1a2a22;border-top:${i === 0 ? "none" : "1px solid #f3f4f6"};">${normalizeItemName(item.name)}</td>
        <td style="padding:12px 0;font-size:14px;color:#6b7280;text-align:center;width:40px;border-top:${i === 0 ? "none" : "1px solid #f3f4f6"};">×${item.quantity}</td>
        <td style="padding:12px 0;font-size:14px;font-weight:600;color:#1a2a22;text-align:right;width:110px;border-top:${i === 0 ? "none" : "1px solid #f3f4f6"};">${formatPrice(item.totalAmount, item.currency)}</td>
      </tr>`,
    )
    .join("");

// ─── Shared layout primitives ──────────────────────────────────────────────

const emailOuter = (cardRows: string) => `
<div style="background:#f6f5f2;padding:32px 0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1a2a22;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          ${cardRows}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
          <tr>
            <td style="padding:20px 0;border-top:1px solid #e5e7eb;text-align:center;">
              <div style="font-size:12px;color:#9ca3af;line-height:1.8;">
                © ${new Date().getFullYear()} Smokeify &nbsp;·&nbsp; Alle Rechte vorbehalten
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
  headerBg: string,
) => `
  <tr>
    <td height="4" style="background-color:#E4C56C;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td style="background-color:${headerBg};padding:32px 32px 28px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E4C56C;margin-bottom:16px;">Smokeify</div>
      <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;margin-bottom:8px;">${title}</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.65);">${subtitle}</div>
    </td>
  </tr>`;

const sectionLabel = (text: string) =>
  `<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;">${text}</div>`;

const divider = () =>
  `<div style="height:1px;background:#f3f4f6;margin:24px 0;"></div>`;

const primaryBtn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:13px 28px;background:#2f3e36;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;margin:4px;">${label}</a>`;

const secondaryBtn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:13px 28px;background:#f3f4f6;color:#1a2a22;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;margin:4px;">${label}</a>`;

// ─── Main builder ──────────────────────────────────────────────────────────

export function buildOrderEmail(
  type: EmailType,
  order: OrderEmailInput,
  orderUrl?: string,
  invoiceUrl?: string,
) {
  const orderNumber = order.id.slice(0, 8).toUpperCase();
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
      ? "Danke für deine Bestellung bei Smokeify."
      : type === "shipping"
        ? "Wir haben dein Paket auf den Weg gebracht."
        : type === "refund"
          ? "Der Betrag wird in Kürze gutgeschrieben."
          : type === "return_confirmation"
            ? "Wir haben deine Rücksendung erhalten."
            : "Deine Bestellung wurde storniert.";

  const headerBg =
    type === "cancellation" ? "#374151" : "#2f3e36";

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
        ? `Danke für deine Bestellung ${orderNumber}.`
        : type === "return_confirmation"
          ? `Wir haben deine Rücksendung für Bestellung ${orderNumber} erhalten.`
          : `Deine Bestellung ${orderNumber} wurde storniert.`;

    const statusNote =
      type !== "confirmation"
        ? `<div style="margin-bottom:24px;padding:14px 16px;background:#f0fdf4;border-left:3px solid #2f3e36;border-radius:0 8px 8px 0;font-size:14px;color:#1a2a22;">${introLine}</div>`
        : "";

    return {
      subject,
      text: [
        introLine,
        "",
        renderItemsText(order.items),
        "",
        totalsText,
        orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
        invoiceUrl ? `Rechnung herunterladen: ${invoiceUrl}` : "",
      ].join("\n"),
      html: emailOuter(`
        ${emailHeader(headerTitle, headerSubtitle, headerBg)}
        <tr>
          <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">

            ${statusNote}

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:top;">
                  ${sectionLabel("Bestellnummer")}
                  <div style="font-size:22px;font-weight:700;color:#1a2a22;font-family:monospace;">${orderNumber}</div>
                  <div style="font-size:13px;color:#9ca3af;margin-top:4px;">${orderDate}</div>
                </td>
                <td style="vertical-align:top;text-align:right;">
                  ${sectionLabel("Gesamt")}
                  <div style="font-size:22px;font-weight:700;color:#2f3e36;">${formatPrice(order.amountTotal, order.currency)}</div>
                </td>
              </tr>
            </table>

            ${divider()}

            ${sectionLabel("Artikel")}
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              ${renderItemsHtml(order.items)}
            </table>

            ${divider()}

            ${sectionLabel("Zahlungsübersicht")}
            <div style="background:#f9fafb;border-radius:10px;padding:20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size:14px;color:#6b7280;padding:4px 0;">Zwischensumme</td>
                  <td style="font-size:14px;color:#1a2a22;text-align:right;padding:4px 0;">${formatPrice(order.amountSubtotal, order.currency)}</td>
                </tr>
                ${
                  order.amountDiscount > 0
                    ? `<tr>
                  <td style="font-size:14px;color:#6b7280;padding:4px 0;">${discountLabel}</td>
                  <td style="font-size:14px;color:#059669;text-align:right;padding:4px 0;">−${formatPrice(order.amountDiscount, order.currency)}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="font-size:14px;color:#6b7280;padding:4px 0;">Steuern</td>
                  <td style="font-size:14px;color:#1a2a22;text-align:right;padding:4px 0;">${formatPrice(order.amountTax, order.currency)}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#6b7280;padding:4px 0 8px;">Versand</td>
                  <td style="font-size:14px;color:#1a2a22;text-align:right;padding:4px 0 8px;">${formatPrice(order.amountShipping, order.currency)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="height:1px;background:#e5e7eb;padding:0;font-size:0;"></td>
                </tr>
                <tr>
                  <td style="font-size:15px;font-weight:700;color:#1a2a22;padding:12px 0 2px;">Gesamt</td>
                  <td style="font-size:15px;font-weight:700;color:#2f3e36;text-align:right;padding:12px 0 2px;">${formatPrice(order.amountTotal, order.currency)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size:12px;color:#9ca3af;padding-bottom:2px;">inkl. MwSt.</td>
                </tr>
              </table>
            </div>

            ${
              orderUrl || invoiceUrl
                ? `<div style="margin-top:28px;text-align:center;">
                ${orderUrl ? primaryBtn(orderUrl, "Bestellung ansehen") : ""}
                ${invoiceUrl ? secondaryBtn(invoiceUrl, "Rechnung herunterladen") : ""}
              </div>`
                : ""
            }

          </td>
        </tr>`),
    };
  }

  // ── Shipping ─────────────────────────────────────────────────────────────
  if (type === "shipping") {
    const trackingRows = [
      order.trackingCarrier
        ? `<tr>
            <td style="font-size:13px;color:#6b7280;padding:8px 0;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;padding-right:24px;">Versanddienst</td>
            <td style="font-size:14px;color:#1a2a22;text-align:right;padding:8px 0;font-weight:600;">${order.trackingCarrier}</td>
          </tr>`
        : null,
      order.trackingNumber
        ? `<tr>
            <td style="font-size:13px;color:#6b7280;padding:8px 0;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;padding-right:24px;">Trackingnummer</td>
            <td style="font-size:14px;color:#1a2a22;text-align:right;padding:8px 0;font-family:monospace;font-weight:600;">${order.trackingNumber}</td>
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
        ${emailHeader(headerTitle, headerSubtitle, headerBg)}
        <tr>
          <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:top;">
                  ${sectionLabel("Bestellnummer")}
                  <div style="font-size:22px;font-weight:700;color:#1a2a22;font-family:monospace;">${orderNumber}</div>
                  <div style="font-size:13px;color:#9ca3af;margin-top:4px;">${orderDate}</div>
                </td>
              </tr>
            </table>

            ${divider()}

            ${sectionLabel("Versandinformationen")}
            ${
              trackingRows
                ? `<div style="background:#f9fafb;border-radius:10px;padding:20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  ${trackingRows}
                </table>
                ${
                  order.trackingUrl
                    ? `<div style="margin-top:18px;">
                    <a href="${order.trackingUrl}" style="display:inline-block;padding:12px 24px;background:#2f3e36;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">Paket verfolgen &rarr;</a>
                  </div>`
                    : ""
                }
              </div>`
                : `<p style="font-size:14px;color:#6b7280;margin:0;">Trackingdaten folgen in Kürze.</p>`
            }

            ${
              orderUrl
                ? `<div style="margin-top:28px;text-align:center;">
                ${primaryBtn(orderUrl, "Bestellung ansehen")}
              </div>`
                : ""
            }

          </td>
        </tr>`),
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
      ${emailHeader(headerTitle, headerSubtitle, headerBg)}
      <tr>
        <td style="background:#ffffff;padding:32px;border:1px solid #e8eaed;border-top:none;border-radius:0 0 14px 14px;">

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align:top;">
                ${sectionLabel("Bestellnummer")}
                <div style="font-size:22px;font-weight:700;color:#1a2a22;font-family:monospace;">${orderNumber}</div>
                <div style="font-size:13px;color:#9ca3af;margin-top:4px;">${orderDate}</div>
              </td>
            </tr>
          </table>

          ${divider()}

          ${sectionLabel("Rückerstattungsbetrag")}
          <div style="background:#f0fdf4;border-radius:12px;padding:28px;text-align:center;border:1px solid #d1fae5;">
            <div style="font-size:38px;font-weight:700;color:#2f3e36;">${formatPrice(refundedAmount, order.currency)}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:8px;">wird innerhalb von 5–10 Werktagen gutgeschrieben</div>
          </div>

          ${
            orderUrl
              ? `<div style="margin-top:28px;text-align:center;">
              ${primaryBtn(orderUrl, "Bestellung ansehen")}
            </div>`
              : ""
          }

        </td>
      </tr>`),
  };
}
