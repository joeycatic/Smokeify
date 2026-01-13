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
          <td style="padding: 6px 0; font-weight: 600;">${item.name}</td>
          <td style="padding: 6px 0; text-align: center;">x${item.quantity}</td>
          <td style="padding: 6px 0; text-align: right;">${formatPrice(
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

  if (type === "confirmation") {
    return {
      subject: `Bestellbestaetigung ${orderNumber}`,
      text: [
        `Danke fuer deine Bestellung ${orderNumber}.`,
        "",
        renderItemsText(order.items),
        "",
        totalsText,
        orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Danke fuer deine Bestellung ${orderNumber}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${renderItemsHtml(order.items)}
          </table>
          <p style="margin-top: 12px;">
            <strong>Zwischensumme:</strong> ${formatPrice(
              order.amountSubtotal,
              order.currency
            )}<br />
            ${
              order.amountDiscount > 0
                ? `<strong>${discountLabel}:</strong> -${formatPrice(
                    order.amountDiscount,
                    order.currency
                  )}<br />`
                : ""
            }
            <strong>Steuern:</strong> ${formatPrice(
              order.amountTax,
              order.currency
            )}<br />
            <strong>Versand:</strong> ${formatPrice(
              order.amountShipping,
              order.currency
            )}<br />
            <strong>Gesamt:</strong> ${formatPrice(order.amountTotal, order.currency)}
          </p>
          ${
            orderUrl
              ? `<p><a href="${orderUrl}">Bestellung ansehen</a></p>`
              : ""
          }
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
        trackingLines || "Trackingdaten folgen in Kuerze.",
        orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Deine Bestellung ${orderNumber} wurde versendet</h2>
          <p>${trackingLines || "Trackingdaten folgen in Kuerze."}</p>
          ${
            orderUrl
              ? `<p><a href="${orderUrl}">Bestellung ansehen</a></p>`
              : ""
          }
        </div>
      `,
    };
  }

  const refundedAmount =
    typeof order.amountRefunded === "number" ? order.amountRefunded : 0;
  return {
    subject: `Rueckerstattung ${orderNumber}`,
    text: [
      `Deine Rueckerstattung fuer Bestellung ${orderNumber} wurde verarbeitet.`,
      `Rueckerstattet: ${formatPrice(refundedAmount, order.currency)}`,
      orderUrl ? `\nBestellung ansehen: ${orderUrl}` : "",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Rueckerstattung ${orderNumber}</h2>
        <p>Rueckerstattet: ${formatPrice(refundedAmount, order.currency)}</p>
        ${
          orderUrl ? `<p><a href="${orderUrl}">Bestellung ansehen</a></p>` : ""
        }
      </div>
    `,
  };
}
