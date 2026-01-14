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

type EmailType = "confirmation" | "shipping" | "refund";

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const renderItemsText = (items: OrderItem[]) =>
  items
    .map(
      (item) =>
        `- ${item.name} (x${item.quantity}) ${formatPrice(
          item.totalAmount,
          item.currency
        )}`
    )
    .join("\n");

const renderItemsHtml = (items: OrderItem[]) =>
  items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">${item.name}</td>
          <td style="padding: 8px 0; text-align: center;">x${item.quantity}</td>
          <td style="padding: 8px 0 8px 8px; text-align: left;">${formatPrice(
            item.totalAmount,
            item.currency
          )}</td>
        </tr>
      `
    )
    .join("");

export function buildOrderEmail(
  type: EmailType,
  order: OrderEmailInput,
  orderUrl?: string
) {
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const discountLabel = order.discountCode
    ? `Rabatt (${order.discountCode})`
    : "Rabatt";
  const discountLine =
    order.amountDiscount > 0
      ? `${discountLabel}: -${formatPrice(order.amountDiscount, order.currency)}`
      : null;
  const headerTitle =
    type === "confirmation"
      ? "Bestellung bestätigt"
      : type === "shipping"
        ? "Versandupdate"
        : "Rückerstattung";
  const headerSubtitle =
    type === "confirmation"
      ? "Danke für deine Bestellung."
      : type === "shipping"
        ? "Dein Paket ist unterwegs."
        : "Deine Rückerstattung wurde verarbeitet.";
  const totalsText = [
    `Zwischensumme: ${formatPrice(order.amountSubtotal, order.currency)}`,
    discountLine,
    `Steuern: ${formatPrice(order.amountTax, order.currency)}`,
    `Versand: ${formatPrice(order.amountShipping, order.currency)}`,
    `Gesamt: ${formatPrice(order.amountTotal, order.currency)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const trackingLines = [
    order.trackingCarrier ? `Carrier: ${order.trackingCarrier}` : null,
    order.trackingNumber ? `Tracking-Nr: ${order.trackingNumber}` : null,
    order.trackingUrl ? `Tracking-URL: ${order.trackingUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const trackingHtml = [
    order.trackingCarrier ? `Carrier: ${order.trackingCarrier}` : null,
    order.trackingNumber ? `Tracking-Nr: ${order.trackingNumber}` : null,
    order.trackingUrl
      ? `Tracking-URL: <a href="${order.trackingUrl}" style="color: #1f2937; text-decoration: underline;">${order.trackingUrl}</a>`
      : null,
  ]
    .filter(Boolean)
    .map((line) => `<div style="margin-top: 6px;">${line}</div>`)
    .join("");

  if (type === "confirmation") {
    return {
      subject: `Bestellbestätigung ${orderNumber}`,
      text: [
        `Danke für deine Bestellung ${orderNumber}.`,
        "",
        renderItemsText(order.items),
        "",
        totalsText,
        orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
      ].join("\n"),
      html: `
        <div style="background: #f6f5f2; padding: 24px 0; font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
          <table style="width: 100%; max-width: 640px; margin: 0 auto; border-collapse: collapse;">
            <tr>
              <td>
                <div style="background: #2f3e36; color: #ffffff; padding: 20px 24px; border-radius: 16px 16px 0 0;">
                  <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8;">Smokeify</div>
                  <div style="font-size: 22px; font-weight: 700; margin-top: 6px;">${headerTitle}</div>
                  <div style="font-size: 14px; margin-top: 4px; opacity: 0.85;">${headerSubtitle}</div>
                </div>
                <div style="background: #ffffff; padding: 24px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 0 32px 0 0; vertical-align: top;">
                        <div style="font-size: 12px; text-transform: uppercase; color: #6b7280;">Bestellnummer</div>
                        <div style="font-weight: 700; font-size: 16px;">${orderNumber}</div>
                      </td>
                      <td style="padding: 0 0 0 32px; vertical-align: top; text-align: right;">
                        <div style="font-size: 12px; text-transform: uppercase; color: #6b7280;">Gesamt</div>
                        <div style="font-weight: 700; font-size: 16px;">${formatPrice(
                          order.amountTotal,
                          order.currency
                        )}</div>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top: 20px;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Artikel</div>
                    <table style="width: 100%; border-collapse: collapse;">
                      ${renderItemsHtml(order.items)}
                    </table>
                  </div>

                  <div style="margin-top: 20px; background: #f9fafb; border-radius: 12px; padding: 16px;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="font-size: 14px; padding: 2px 0;">Zwischensumme</td>
                        <td style="font-size: 14px; padding: 2px 0; text-align: left; width: 140px;">${formatPrice(
                          order.amountSubtotal,
                          order.currency
                        )}</td>
                      </tr>
                      ${
                        order.amountDiscount > 0
                          ? `<tr>
                              <td style="font-size: 14px; padding: 2px 0;">${discountLabel}</td>
                              <td style="font-size: 14px; padding: 2px 0; text-align: left; width: 140px;">-${formatPrice(
                                order.amountDiscount,
                                order.currency
                              )}</td>
                            </tr>`
                          : ""
                      }
                      <tr>
                        <td style="font-size: 14px; padding: 2px 0;">Steuern</td>
                        <td style="font-size: 14px; padding: 2px 0; text-align: left; width: 140px;">${formatPrice(
                          order.amountTax,
                          order.currency
                        )}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; padding: 2px 0;">Versand</td>
                        <td style="font-size: 14px; padding: 2px 0; text-align: left; width: 140px;">${formatPrice(
                          order.amountShipping,
                          order.currency
                        )}</td>
                      </tr>
                      <tr>
                        <td style="font-weight: 700; padding: 6px 0 2px;">Gesamt</td>
                        <td style="font-weight: 700; padding: 6px 0 2px; text-align: left; width: 140px;">${formatPrice(
                          order.amountTotal,
                          order.currency
                        )}</td>
                      </tr>
                    </table>
                  </div>

                  ${
                    orderUrl
                      ? `<div style="margin-top: 20px; text-align: center;">
                          <a href="${orderUrl}" style="display: inline-block; padding: 10px 16px; border-radius: 999px; background: #2f3e36; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">Bestellung ansehen</a>
                        </div>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          </table>
        </div>
      `,
    };
  }

  if (type === "shipping") {
    return {
      subject: `Versandupdate ${orderNumber}`,
      text: [
        `Deine Bestellung ${orderNumber} wurde versendet.`,
        "",
        trackingLines || "Trackingdaten folgen in Kürze.",
        orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
      ].join("\n"),
      html: `
        <div style="background: #f6f5f2; padding: 24px 0; font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
          <table style="width: 100%; max-width: 640px; margin: 0 auto; border-collapse: collapse;">
            <tr>
              <td>
                <div style="background: #1f2937; color: #ffffff; padding: 20px 24px; border-radius: 16px 16px 0 0;">
                  <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8;">Smokeify</div>
                  <div style="font-size: 22px; font-weight: 700; margin-top: 6px;">${headerTitle}</div>
                  <div style="font-size: 14px; margin-top: 4px; opacity: 0.85;">${headerSubtitle}</div>
                </div>
                <div style="background: #ffffff; padding: 24px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb;">
                  <div style="font-size: 12px; text-transform: uppercase; color: #6b7280;">Bestellnummer</div>
                  <div style="font-weight: 700; font-size: 16px; margin-bottom: 24px;">${orderNumber}</div>
                  <div style="margin-top: 6px; background: #f9fafb; border-radius: 12px; padding: 16px; font-size: 14px;">
                    ${trackingHtml || '<div>Trackingdaten folgen in Kuerze.</div>'}
                  </div>
                  ${
                    orderUrl
                      ? `<div style="margin-top: 20px; text-align: center;">
                          <a href="${orderUrl}" style="display: inline-block; padding: 10px 16px; border-radius: 999px; background: #1f2937; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">Bestellung ansehen</a>
                        </div>`
                      : ""
                  }
                </div>
              </td>
            </tr>
          </table>
        </div>
      `,
    };
  }

  const refundedAmount =
    typeof order.amountRefunded === "number" ? order.amountRefunded : 0;
  return {
    subject: `Rückerstattung ${orderNumber}`,
    text: [
      `Deine Rückerstattung für Bestellung ${orderNumber} wurde verarbeitet.`,
      `Rückerstattet: ${formatPrice(refundedAmount, order.currency)}`,
      orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
    ].join("\n"),
    html: `
      <div style="background: #f6f5f2; padding: 24px 0; font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <table style="width: 100%; max-width: 640px; margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td>
              <div style="background: #6b7280; color: #ffffff; padding: 20px 24px; border-radius: 16px 16px 0 0;">
                <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8;">Smokeify</div>
                <div style="font-size: 22px; font-weight: 700; margin-top: 6px;">${headerTitle}</div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.85;">${headerSubtitle}</div>
              </div>
              <div style="background: #ffffff; padding: 24px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb;">
                <div style="font-size: 12px; text-transform: uppercase; color: #6b7280;">Bestellnummer</div>
                <div style="font-weight: 700; font-size: 16px; margin-bottom: 16px;">${orderNumber}</div>
                <div style="background: #f9fafb; border-radius: 12px; padding: 16px; font-size: 14px;">
                  Rückerstattet: ${formatPrice(refundedAmount, order.currency)}
                </div>
                ${
                  orderUrl
                    ? `<div style="margin-top: 20px; text-align: center;">
                        <a href="${orderUrl}" style="display: inline-block; padding: 10px 16px; border-radius: 999px; background: #6b7280; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">Bestellung ansehen</a>
                      </div>`
                    : ""
                }
              </div>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
}
