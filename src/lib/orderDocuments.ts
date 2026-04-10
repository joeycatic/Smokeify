import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SELLER_LINES = [
  "Smokeify",
  "Brinkeweg 106a",
  "33758 Schloß Holte-Stukenbrock",
  "Deutschland",
  "contact@smokeify.de",
] as const;

const DEFAULT_ITEM_SUFFIX = / - Default( Title)?(?=\s*\(|$)/i;

export type OrderDocumentItem = {
  id: string;
  name: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  taxAmount: number;
  currency: string;
  sku: string | null;
};

export type OrderDocumentData = {
  id: string;
  orderNumber: number;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  paymentStatus: string;
  currency: string;
  amountSubtotal: number;
  amountTax: number;
  amountShipping: number;
  amountDiscount: number;
  amountTotal: number;
  discountCode: string | null;
  customerEmail: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  items: OrderDocumentItem[];
};

type OrderDocumentOrder = Prisma.OrderGetPayload<{
  include: { items: true };
}>;

export const formatOrderDocumentPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

export const buildInvoiceNumber = (order: Pick<OrderDocumentData, "createdAt" | "orderNumber">) =>
  `RE-${order.createdAt.getFullYear()}-${order.orderNumber.toString().padStart(6, "0")}`;

export const buildPackingSlipNumber = (
  order: Pick<OrderDocumentData, "createdAt" | "orderNumber">,
) => `BS-${order.createdAt.getFullYear()}-${order.orderNumber.toString().padStart(6, "0")}`;

export const escapeHtml = (value: string | null | undefined) =>
  (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatOrderItemName = (name: string, manufacturer?: string | null) => {
  if (!DEFAULT_ITEM_SUFFIX.test(name)) return name;
  const trimmedManufacturer = manufacturer?.trim();
  if (trimmedManufacturer) {
    return name.replace(DEFAULT_ITEM_SUFFIX, ` - ${trimmedManufacturer}`);
  }
  return name.replace(DEFAULT_ITEM_SUFFIX, "");
};

const buildAddressLines = (order: Pick<
  OrderDocumentData,
  "shippingName" | "shippingLine1" | "shippingLine2" | "shippingPostalCode" | "shippingCity" | "shippingCountry"
>) =>
  [
    order.shippingName,
    order.shippingLine1,
    order.shippingLine2,
    [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" "),
    order.shippingCountry,
  ].filter((line): line is string => Boolean(line?.trim()));

const buildInfoLines = (lines: string[]) =>
  lines.length
    ? lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")
    : '<div class="placeholder">Keine Daten vorhanden.</div>';

const buildDocumentLayout = ({
  lang,
  title,
  documentTitle,
  documentNumber,
  documentMetaLines,
  leftPanelTitle,
  leftPanelLines,
  rightPanelTitle,
  rightPanelLines,
  tableHead,
  tableBody,
  summaryCards,
  footerNote,
}: {
  lang: string;
  title: string;
  documentTitle: string;
  documentNumber: string;
  documentMetaLines: string[];
  leftPanelTitle: string;
  leftPanelLines: string[];
  rightPanelTitle: string;
  rightPanelLines: string[];
  tableHead: string;
  tableBody: string;
  summaryCards?: Array<{ label: string; value: string }>;
  footerNote?: string;
}) => `
  <!doctype html>
  <html lang="${lang}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          font-family: Arial, sans-serif;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #f3f4f6;
          color: #111827;
          padding: 28px;
        }
        main {
          max-width: 980px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 24px;
          padding: 28px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
        }
        .brand {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #6b7280;
        }
        h1 {
          margin: 8px 0 10px;
          font-size: 34px;
          line-height: 1.05;
        }
        .muted {
          color: #6b7280;
          font-size: 13px;
          line-height: 1.6;
        }
        .meta-card {
          min-width: 220px;
          border: 1px solid #d1d5db;
          border-radius: 18px;
          padding: 16px 18px;
          background: #f9fafb;
        }
        .meta-card .label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b7280;
        }
        .meta-card .value {
          margin-top: 10px;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.35;
        }
        .grid {
          display: grid;
          gap: 18px;
          margin-top: 22px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .panel {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 18px;
          background: #ffffff;
        }
        .panel h2 {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #6b7280;
        }
        .panel div {
          line-height: 1.65;
        }
        .placeholder {
          color: #9ca3af;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 24px;
        }
        th, td {
          border-bottom: 1px solid #e5e7eb;
          padding: 12px 0;
          vertical-align: top;
        }
        th {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-align: left;
          color: #6b7280;
        }
        td.right, th.right {
          text-align: right;
        }
        .summary {
          display: grid;
          gap: 14px;
          margin-top: 22px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
        .summary-card {
          border: 1px solid #dbeafe;
          border-radius: 18px;
          background: #eff6ff;
          padding: 16px;
        }
        .summary-card .label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #1d4ed8;
        }
        .summary-card .value {
          margin-top: 8px;
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }
        .footer-note {
          margin-top: 22px;
          font-size: 12px;
          line-height: 1.6;
          color: #6b7280;
        }
        @media print {
          body {
            background: #ffffff;
            padding: 0;
          }
          main {
            border: none;
            border-radius: 0;
            padding: 0;
            max-width: none;
          }
        }
        @media (max-width: 720px) {
          body { padding: 12px; }
          main { padding: 18px; }
          .header, .grid {
            grid-template-columns: 1fr;
            display: grid;
          }
          .meta-card {
            min-width: 0;
          }
        }
      </style>
    </head>
    <body>
      <main>
        <section class="header">
          <div>
            <div class="brand">${escapeHtml(SELLER_LINES[0])}</div>
            <h1>${escapeHtml(documentTitle)}</h1>
            <div class="muted">
              <div>${escapeHtml(documentNumber)}</div>
              ${documentMetaLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
            </div>
          </div>
          <div class="meta-card">
            <div class="label">Verkäufer</div>
            <div class="value">${escapeHtml(SELLER_LINES[0])}</div>
            <div class="muted">${SELLER_LINES.slice(1).map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>
          </div>
        </section>

        <section class="grid">
          <div class="panel">
            <h2>${escapeHtml(leftPanelTitle)}</h2>
            ${buildInfoLines(leftPanelLines)}
          </div>
          <div class="panel">
            <h2>${escapeHtml(rightPanelTitle)}</h2>
            ${buildInfoLines(rightPanelLines)}
          </div>
        </section>

        <table>
          <thead>${tableHead}</thead>
          <tbody>${tableBody}</tbody>
        </table>

        ${
          summaryCards?.length
            ? `<section class="summary">${summaryCards
                .map(
                  (card) => `
                    <div class="summary-card">
                      <div class="label">${escapeHtml(card.label)}</div>
                      <div class="value">${escapeHtml(card.value)}</div>
                    </div>
                  `,
                )
                .join("")}</section>`
            : ""
        }

        ${
          footerNote
            ? `<div class="footer-note">${escapeHtml(footerNote)}</div>`
            : ""
        }
      </main>
    </body>
  </html>
`;

export async function loadOrderDocumentData(orderId: string): Promise<OrderDocumentData | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return null;

  return enrichOrderDocument(order);
}

async function enrichOrderDocument(order: OrderDocumentOrder): Promise<OrderDocumentData> {
  const productIds = Array.from(
    new Set(order.items.map((item) => item.productId).filter(Boolean)),
  ) as string[];
  const variantIds = Array.from(
    new Set(order.items.map((item) => item.variantId).filter(Boolean)),
  ) as string[];

  const [products, variants] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, manufacturer: true },
        })
      : Promise.resolve([]),
    variantIds.length
      ? prisma.variant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, sku: true },
        })
      : Promise.resolve([]),
  ]);

  const manufacturerByProductId = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null]),
  );
  const skuByVariantId = new Map(variants.map((variant) => [variant.id, variant.sku ?? null]));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    amountSubtotal: order.amountSubtotal,
    amountTax: order.amountTax,
    amountShipping: order.amountShipping,
    amountDiscount: order.amountDiscount,
    amountTotal: order.amountTotal,
    discountCode: order.discountCode,
    customerEmail: order.customerEmail,
    shippingName: order.shippingName,
    shippingLine1: order.shippingLine1,
    shippingLine2: order.shippingLine2,
    shippingPostalCode: order.shippingPostalCode,
    shippingCity: order.shippingCity,
    shippingCountry: order.shippingCountry,
    items: order.items.map((item) => ({
      id: item.id,
      name: formatOrderItemName(
        item.name,
        item.productId ? manufacturerByProductId.get(item.productId) : null,
      ),
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      totalAmount: item.totalAmount,
      taxAmount: item.taxAmount,
      currency: item.currency,
      sku: item.variantId ? skuByVariantId.get(item.variantId) ?? null : null,
    })),
  };
}

export function buildInvoiceHtml(order: OrderDocumentData) {
  const discountLabel = order.discountCode ? `Rabatt (${order.discountCode})` : "Rabatt";
  const discountLine =
    order.amountDiscount > 0
      ? `
        <tr>
          <td>${escapeHtml(discountLabel)}</td>
          <td class="right">-${escapeHtml(formatOrderDocumentPrice(order.amountDiscount, order.currency))}</td>
        </tr>
      `
      : "";

  const invoiceNumber = buildInvoiceNumber(order);
  const orderDate = order.createdAt.toLocaleDateString("de-DE");

  return buildDocumentLayout({
    lang: "de",
    title: `Rechnung ${invoiceNumber}`,
    documentTitle: "Rechnung",
    documentNumber: `Rechnungsnummer ${invoiceNumber}`,
    documentMetaLines: [
      `Bestellnummer ${order.id.slice(0, 8).toUpperCase()}`,
      `Rechnungsdatum ${orderDate}`,
      `Lieferdatum ${orderDate}`,
    ],
    leftPanelTitle: "Versandadresse",
    leftPanelLines: buildAddressLines(order),
    rightPanelTitle: "Kontakt",
    rightPanelLines: [order.customerEmail ?? "Keine E-Mail hinterlegt."],
    tableHead: `
      <tr>
        <th>Artikel</th>
        <th class="right">Menge</th>
        <th class="right">Summe</th>
      </tr>
    `,
    tableBody: `
      ${order.items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td class="right">${escapeHtml(String(item.quantity))}</td>
              <td class="right">${escapeHtml(
                formatOrderDocumentPrice(item.totalAmount, item.currency),
              )}</td>
            </tr>
          `,
        )
        .join("")}
      <tr>
        <td>Zwischensumme</td>
        <td></td>
        <td class="right">${escapeHtml(
          formatOrderDocumentPrice(order.amountSubtotal, order.currency),
        )}</td>
      </tr>
      ${discountLine}
      <tr>
        <td>Versand</td>
        <td></td>
        <td class="right">${escapeHtml(
          formatOrderDocumentPrice(order.amountShipping, order.currency),
        )}</td>
      </tr>
      <tr>
        <td>Steuern</td>
        <td></td>
        <td class="right">${escapeHtml(
          formatOrderDocumentPrice(order.amountTax, order.currency),
        )}</td>
      </tr>
      <tr>
        <td><strong>Gesamt</strong></td>
        <td></td>
        <td class="right"><strong>${escapeHtml(
          formatOrderDocumentPrice(order.amountTotal, order.currency),
        )}</strong></td>
      </tr>
    `,
    footerNote: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet.",
  });
}

export function buildPackingSlipHtml(order: OrderDocumentData) {
  const slipNumber = buildPackingSlipNumber(order);
  const orderDate = order.createdAt.toLocaleDateString("de-DE");
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return buildDocumentLayout({
    lang: "de",
    title: `Beilegschein ${slipNumber}`,
    documentTitle: "Beilegschein",
    documentNumber: `Beilegscheinnummer ${slipNumber}`,
    documentMetaLines: [
      `Bestellnummer ${order.id.slice(0, 8).toUpperCase()}`,
      `Bestelldatum ${orderDate}`,
      `Status ${order.status}`,
    ],
    leftPanelTitle: "Versandadresse",
    leftPanelLines: buildAddressLines(order),
    rightPanelTitle: "Auftragsdaten",
    rightPanelLines: [
      `Kontakt: ${order.customerEmail ?? "Keine E-Mail hinterlegt."}`,
      `Zahlungsstatus: ${order.paymentStatus}`,
      `Zuletzt aktualisiert: ${order.updatedAt.toLocaleDateString("de-DE")}`,
    ],
    tableHead: `
      <tr>
        <th>Artikel</th>
        <th>SKU</th>
        <th class="right">Menge</th>
      </tr>
    `,
    tableBody: order.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.sku ?? "—")}</td>
            <td class="right">${escapeHtml(String(item.quantity))}</td>
          </tr>
        `,
      )
      .join(""),
    summaryCards: [
      { label: "Positionen", value: String(order.items.length) },
      { label: "Gesamtmenge", value: String(totalUnits) },
      { label: "Bestellwert", value: formatOrderDocumentPrice(order.amountTotal, order.currency) },
    ],
    footerNote:
      "Interner Packbeleg. Preise fuer den Versandprozess nicht erneut berechnen und vor dem Versand die Vollstaendigkeit pruefen.",
  });
}
