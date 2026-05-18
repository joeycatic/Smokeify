import { Prisma } from "@prisma/client";
import {
  businessDetails,
  documentSellerLines,
  supportCompanyLines,
} from "@/lib/businessDetails";
import { prisma } from "@/lib/prisma";

const SELLER_LINES = documentSellerLines;

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

type PdfTextEntry = {
  font: "F1" | "F2";
  size: number;
  x: number;
  y: number;
  text: string;
};

type PdfRectEntry = {
  x: number;
  y: number;
  width: number;
  height: number;
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
) => `LS-${order.createdAt.getFullYear()}-${order.orderNumber.toString().padStart(6, "0")}`;

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
    title: `Lieferschein ${slipNumber}`,
    documentTitle: "Lieferschein",
    documentNumber: `Lieferscheinnummer ${slipNumber}`,
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
      "Interner Packbeleg. Preise für den Versandprozess nicht erneut berechnen und vor dem Versand die Vollständigkeit prüfen.",
  });
}

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN = 48;
const PDF_ITEM_ROW_HEIGHT = 20;

const sanitizePdfText = (value: string) =>
  Array.from(value)
    .map((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      if (codePoint === 10 || codePoint === 13 || codePoint === 9) return " ";
      if (codePoint >= 32 && codePoint <= 255) return char;
      if (char === "€") return "EUR";
      if (char === "–" || char === "—") return "-";
      if (char === "…" ) return "...";
      return "?";
    })
    .join("");

const escapePdfText = (value: string) =>
  sanitizePdfText(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

const truncatePdfText = (value: string, maxLength: number) => {
  const normalized = sanitizePdfText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const estimatePdfTextWidth = (text: string, fontSize: number) =>
  sanitizePdfText(text).length * fontSize * 0.52;

const wrapPdfText = (value: string, maxWidth: number, fontSize: number) => {
  const normalized = sanitizePdfText(value).trim();
  if (!normalized) return [""];

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  const pushCurrentLine = () => {
    if (currentLine) lines.push(currentLine);
    currentLine = "";
  };

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (estimatePdfTextWidth(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      pushCurrentLine();
    }

    if (estimatePdfTextWidth(word, fontSize) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let chunk = "";
    for (const char of Array.from(word)) {
      const nextChunk = `${chunk}${char}`;
      if (estimatePdfTextWidth(nextChunk, fontSize) <= maxWidth) {
        chunk = nextChunk;
        continue;
      }
      if (chunk) lines.push(chunk);
      chunk = char;
    }
    currentLine = chunk;
  }

  pushCurrentLine();
  return lines.length ? lines : [normalized];
};

const expandWrappedPdfLines = (
  lines: string[],
  maxWidth: number,
  fontSize: number,
) => lines.flatMap((line) => wrapPdfText(line, maxWidth, fontSize));

const createPdfText = (entry: PdfTextEntry) =>
  `BT /${entry.font} ${entry.size} Tf 1 0 0 1 ${entry.x} ${entry.y} Tm (${escapePdfText(entry.text)}) Tj ET`;

const createPdfRect = (entry: PdfRectEntry) => `${entry.x} ${entry.y} ${entry.width} ${entry.height} re S`;

const createPdfLine = (x1: number, y1: number, x2: number, y2: number) =>
  `${x1} ${y1} m ${x2} ${y2} l S`;

const addWrappedPdfText = ({
  commands,
  font,
  size,
  x,
  startY,
  lineHeight,
  maxWidth,
  lines,
}: {
  commands: string[];
  font: "F1" | "F2";
  size: number;
  x: number;
  startY: number;
  lineHeight: number;
  maxWidth: number;
  lines: string[];
}) => {
  let rowIndex = 0;
  for (const line of lines) {
    const wrappedLines = wrapPdfText(line, maxWidth, size);
    for (const wrappedLine of wrappedLines) {
      commands.push(
        createPdfText({
          font,
          size,
          x,
          y: startY - rowIndex * lineHeight,
          text: wrappedLine,
        }),
      );
      rowIndex += 1;
    }
  }
  return rowIndex;
};

const createPdfDocument = (pageStreams: Buffer[]) => {
  const objectCount = 4 + pageStreams.length * 2;
  const buffers: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets: number[] = [0];
  let currentOffset = buffers[0].length;

  const appendObject = (objectNumber: number, content: Buffer | string) => {
    const header = Buffer.from(`${objectNumber} 0 obj\n`, "ascii");
    const body = typeof content === "string" ? Buffer.from(content, "latin1") : content;
    const footer = Buffer.from("\nendobj\n", "ascii");
    offsets[objectNumber] = currentOffset;
    buffers.push(header, body, footer);
    currentOffset += header.length + body.length + footer.length;
  };

  appendObject(1, "<< /Type /Catalog /Pages 2 0 R >>");

  const pageObjectNumbers = pageStreams.map((_, index) => 6 + index * 2);
  appendObject(
    2,
    `<< /Type /Pages /Count ${pageStreams.length} /Kids [${pageObjectNumbers
      .map((pageNumber) => `${pageNumber} 0 R`)
      .join(" ")}] >>`,
  );
  appendObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  appendObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  pageStreams.forEach((streamBuffer, index) => {
    const streamObjectNumber = 5 + index * 2;
    const pageObjectNumber = 6 + index * 2;
    appendObject(
      streamObjectNumber,
      Buffer.concat([
        Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "ascii"),
        streamBuffer,
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
    appendObject(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjectNumber} 0 R >>`,
    );
  });

  const xrefOffset = currentOffset;
  const xrefEntries = Array.from({ length: objectCount + 1 }, (_, index) => {
    if (index === 0) return "0000000000 65535 f ";
    return `${String(offsets[index] ?? 0).padStart(10, "0")} 00000 n `;
  }).join("\n");

  const trailer = `xref\n0 ${objectCount + 1}\n${xrefEntries}\ntrailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  buffers.push(Buffer.from(trailer, "ascii"));

  return Buffer.concat(buffers);
};

const buildPackingSlipPageStream = ({
  order,
  itemChunk,
  pageIndex,
  pageCount,
  totalUnits,
}: {
  order: OrderDocumentData;
  itemChunk: OrderDocumentItem[];
  pageIndex: number;
  pageCount: number;
  totalUnits: number;
}) => {
  const commands: string[] = [
    "0.12 0.18 0.15 RG",
    "0.12 0.18 0.15 rg",
    "1 w",
  ];

  const title = pageIndex === 0 ? "Lieferschein" : "Lieferschein - Fortsetzung";
  const slipNumber = buildPackingSlipNumber(order);
  const orderLabel = order.id.slice(0, 8).toUpperCase();
  const orderDate = order.createdAt.toLocaleDateString("de-DE");
  const updatedDate = order.updatedAt.toLocaleDateString("de-DE");
  const pageLabel = `Seite ${pageIndex + 1} von ${pageCount}`;
  const leftColumnX = PDF_MARGIN;
  const rightColumnX = 320;
  const leftBoxWidth = 232;
  const rightBoxWidth = 227;
  const boxPadding = 12;
  const infoFontSize = 10;
  const infoLineHeight = 14;
  const infoLabelHeight = 26;
  const infoBottomPadding = 14;
  const infoBoxTopY = pageIndex === 0 ? 656 : 744;
  const supportFontSize = 10;
  const supportLineHeight = 14;
  const supportLabelHeight = 26;
  const supportBottomPadding = 16;
  const supportBoxWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const addressLines = expandWrappedPdfLines(
    buildAddressLines(order),
    leftBoxWidth - boxPadding * 2,
    infoFontSize,
  );
  const orderDetailLines = expandWrappedPdfLines(
    [
      `Kontakt: ${order.customerEmail ?? "Keine E-Mail hinterlegt."}`,
      `Zahlungsstatus: ${order.paymentStatus}`,
      `Zuletzt aktualisiert: ${updatedDate}`,
      `Positionen: ${order.items.length}`,
      `Gesamtmenge: ${totalUnits}`,
      `Bestellwert: ${formatOrderDocumentPrice(order.amountTotal, order.currency)}`,
    ],
    rightBoxWidth - boxPadding * 2,
    infoFontSize,
  );
  const leftInfoBoxHeight = Math.max(
    96,
    infoLabelHeight + addressLines.length * infoLineHeight + infoBottomPadding,
  );
  const rightInfoBoxHeight = Math.max(
    96,
    infoLabelHeight + orderDetailLines.length * infoLineHeight + infoBottomPadding,
  );
  const infoBoxesBottomY =
    infoBoxTopY - Math.max(leftInfoBoxHeight, rightInfoBoxHeight);
  const tableHeaderY = infoBoxesBottomY - (pageIndex === 0 ? 34 : 28);
  const tableStartY = tableHeaderY - 28;

  commands.push(
    createPdfText({
      font: "F2",
      size: 11,
      x: leftColumnX,
      y: 804,
      text: businessDetails.companyName,
    }),
  );
  commands.push(createPdfText({ font: "F2", size: 24, x: leftColumnX, y: 778, text: title }));
  commands.push(createPdfText({ font: "F1", size: 11, x: leftColumnX, y: 758, text: `Lieferscheinnummer ${slipNumber}` }));
  commands.push(createPdfText({ font: "F1", size: 11, x: leftColumnX, y: 742, text: `Bestellnummer ${orderLabel}` }));
  commands.push(createPdfText({ font: "F1", size: 11, x: leftColumnX, y: 726, text: `Bestelldatum ${orderDate}` }));
  commands.push(createPdfText({ font: "F1", size: 11, x: leftColumnX, y: 710, text: `Status ${order.status}` }));

  commands.push(createPdfText({ font: "F2", size: 11, x: rightColumnX, y: 804, text: pageLabel }));
  commands.push(createPdfText({ font: "F1", size: 11, x: rightColumnX, y: 786, text: SELLER_LINES[0] }));
  SELLER_LINES.slice(1).forEach((line, index) => {
    commands.push(
      createPdfText({
        font: "F1",
        size: 10,
        x: rightColumnX,
        y: 770 - index * 14,
        text: line,
      }),
    );
  });

  if (pageIndex === 0) {
    commands.push(
      createPdfRect({
        x: leftColumnX,
        y: infoBoxTopY - leftInfoBoxHeight,
        width: leftBoxWidth,
        height: leftInfoBoxHeight,
      }),
    );
    commands.push(
      createPdfRect({
        x: rightColumnX,
        y: infoBoxTopY - rightInfoBoxHeight,
        width: rightBoxWidth,
        height: rightInfoBoxHeight,
      }),
    );
    commands.push(
      createPdfText({
        font: "F2",
        size: 11,
        x: leftColumnX + boxPadding,
        y: infoBoxTopY - 22,
        text: "Versandadresse",
      }),
    );
    addWrappedPdfText({
      commands,
      font: "F1",
      size: infoFontSize,
      x: leftColumnX + boxPadding,
      startY: infoBoxTopY - 48,
      lineHeight: infoLineHeight,
      maxWidth: leftBoxWidth - boxPadding * 2,
      lines: addressLines,
    });

    commands.push(
      createPdfText({
        font: "F2",
        size: 11,
        x: rightColumnX + boxPadding,
        y: infoBoxTopY - 22,
        text: "Auftragsdaten",
      }),
    );
    addWrappedPdfText({
      commands,
      font: "F1",
      size: infoFontSize,
      x: rightColumnX + boxPadding,
      startY: infoBoxTopY - 48,
      lineHeight: infoLineHeight,
      maxWidth: rightBoxWidth - boxPadding * 2,
      lines: orderDetailLines,
    });
  }

  commands.push(createPdfText({ font: "F2", size: 10, x: leftColumnX, y: tableHeaderY, text: "Artikel" }));
  commands.push(createPdfText({ font: "F2", size: 10, x: 390, y: tableHeaderY, text: "SKU" }));
  commands.push(createPdfText({ font: "F2", size: 10, x: 520, y: tableHeaderY, text: "Menge" }));
  commands.push(createPdfLine(leftColumnX, tableHeaderY - 6, PDF_PAGE_WIDTH - PDF_MARGIN, tableHeaderY - 6));

  itemChunk.forEach((item, index) => {
    const rowY = tableStartY - index * PDF_ITEM_ROW_HEIGHT;
    commands.push(
      createPdfText({
        font: "F1",
        size: 10,
        x: leftColumnX,
        y: rowY,
        text: truncatePdfText(item.name, 52),
      }),
    );
    commands.push(
      createPdfText({
        font: "F1",
        size: 10,
        x: 390,
        y: rowY,
        text: truncatePdfText(item.sku ?? "-", 16),
      }),
    );
    commands.push(
      createPdfText({
        font: "F1",
        size: 10,
        x: 530,
        y: rowY,
        text: String(item.quantity),
      }),
    );
    commands.push(createPdfLine(leftColumnX, rowY - 6, PDF_PAGE_WIDTH - PDF_MARGIN, rowY - 6));
  });

  const supportLines = expandWrappedPdfLines(
    supportCompanyLines,
    supportBoxWidth - boxPadding * 2,
    supportFontSize,
  );
  const supportBoxHeight = Math.max(
    108,
    supportLabelHeight + supportLines.length * supportLineHeight + supportBottomPadding,
  );
  const supportBoxTopY = tableStartY - itemChunk.length * PDF_ITEM_ROW_HEIGHT - 42;

  if (pageIndex === pageCount - 1 && supportBoxTopY - supportBoxHeight > 72) {
    commands.push(
      createPdfRect({
        x: leftColumnX,
        y: supportBoxTopY - supportBoxHeight,
        width: supportBoxWidth,
        height: supportBoxHeight,
      }),
    );
    commands.push(
      createPdfText({
        font: "F2",
        size: 11,
        x: leftColumnX + boxPadding,
        y: supportBoxTopY - 22,
        text: "Support / Unternehmensdaten",
      }),
    );
    addWrappedPdfText({
      commands,
      font: "F1",
      size: supportFontSize,
      x: leftColumnX + boxPadding,
      startY: supportBoxTopY - 48,
      lineHeight: supportLineHeight,
      maxWidth: supportBoxWidth - boxPadding * 2,
      lines: supportLines,
    });
  }

  commands.push(
    createPdfText({
      font: "F1",
      size: 9,
      x: leftColumnX,
      y: 42,
      text: "Interner Packbeleg. Preise für den Versandprozess nicht erneut berechnen und vor dem Versand die Vollständigkeit prüfen.",
    }),
  );

  return Buffer.from(commands.join("\n"), "latin1");
};

export function buildPackingSlipPdf(order: OrderDocumentData) {
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const firstPageItems = 18;
  const followingPageItems = 24;
  const pageChunks: OrderDocumentItem[][] = [];

  if (order.items.length <= firstPageItems) {
    pageChunks.push(order.items);
  } else {
    pageChunks.push(order.items.slice(0, firstPageItems));
    for (let index = firstPageItems; index < order.items.length; index += followingPageItems) {
      pageChunks.push(order.items.slice(index, index + followingPageItems));
    }
  }

  const pageStreams = pageChunks.map((itemChunk, pageIndex) =>
    buildPackingSlipPageStream({
      order,
      itemChunk,
      pageIndex,
      pageCount: pageChunks.length,
      totalUnits,
    }),
  );

  return createPdfDocument(pageStreams);
}
