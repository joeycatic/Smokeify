import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyInvoiceToken } from "@/lib/invoiceLink";

export const runtime = "nodejs";

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const buildInvoiceHtml = (order: {
  id: string;
  orderNumber: number;
  createdAt: Date;
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
  items: { name: string; quantity: number; totalAmount: number; currency: string }[];
}) => {
  const discountLabel = order.discountCode
    ? `Rabatt (${order.discountCode})`
    : "Rabatt";
  const discountLine =
    order.amountDiscount > 0
      ? `<tr><td>${discountLabel}</td><td style="text-align:right;">-${formatPrice(
          order.amountDiscount,
          order.currency
        )}</td></tr>`
      : "";
  const invoiceNumber = `RE-${order.createdAt.getFullYear()}-${order.orderNumber
    .toString()
    .padStart(6, "0")}`;
  const orderDate = order.createdAt.toLocaleDateString("de-DE");

  return `
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <title>Rechnung ${invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
          h1 { margin: 0 0 8px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          th { text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .section { margin-top: 20px; }
          .muted { color: #6b7280; font-size: 12px; }
          .totals td { border: none; }
        </style>
      </head>
      <body>
        <h1>Rechnung</h1>
        <div class="muted">Rechnungsnummer ${invoiceNumber}</div>
        <div class="muted">Bestellnummer ${order.id.slice(0, 8).toUpperCase()}</div>
        <div class="muted">Rechnungsdatum ${orderDate}</div>
        <div class="muted">Lieferdatum ${orderDate}</div>

        <div class="section">
          <strong>Verkäufer</strong>
          <div>Somkeify</div>
          <div>Brinkeweg 106a</div>
          <div>33758 Schloß Holte Stukenbrock</div>
          <div>Deutschland</div>
          <div>contact@smokeify.de</div>
        </div>

        <div class="section">
          <strong>Kontakt</strong>
          <div>${order.customerEmail ?? "-"}</div>
        </div>

        <div class="section">
          <strong>Versandadresse</strong>
          <div>${order.shippingName ?? "-"}</div>
          <div>${order.shippingLine1 ?? ""}</div>
          <div>${order.shippingLine2 ?? ""}</div>
          <div>${order.shippingPostalCode ?? ""} ${order.shippingCity ?? ""}</div>
          <div>${order.shippingCountry ?? ""}</div>
        </div>

        <div class="section">
          <table>
            <thead>
              <tr>
                <th>Artikel</th>
                <th>Menge</th>
                <th style="text-align:right;">Summe</th>
              </tr>
            </thead>
            <tbody>
              ${order.items
                .map(
                  (item) => `
                    <tr>
                      <td>${item.name}</td>
                      <td>${item.quantity}</td>
                      <td style="text-align:right;">${formatPrice(
                        item.totalAmount,
                        item.currency
                      )}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="section">
          <table class="totals">
            <tr><td>Zwischensumme</td><td style="text-align:right;">${formatPrice(
              order.amountSubtotal,
              order.currency
            )}</td></tr>
            ${discountLine}
            <tr><td>Versand</td><td style="text-align:right;">${formatPrice(
              order.amountShipping,
              order.currency
            )}</td></tr>
            <tr><td>Steuern</td><td style="text-align:right;">${formatPrice(
              order.amountTax,
              order.currency
            )}</td></tr>
            <tr><td><strong>Gesamt</strong></td><td style="text-align:right;"><strong>${formatPrice(
              order.amountTotal,
              order.currency
            )}</strong></td></tr>
          </table>
        </div>
        <div class="section muted">
          Gemäß §19 UStG wird keine Umsatzsteuer berechnet.
        </div>
      </body>
    </html>
  `;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get("token");
  const expiresRaw = request.nextUrl.searchParams.get("expires");
  const expiresAt = expiresRaw ? Number(expiresRaw) : NaN;
  const hasValidToken =
    token && Number.isFinite(expiresAt)
      ? verifyInvoiceToken(id, expiresAt, token)
      : false;

  const session = hasValidToken ? null : await getServerSession(authOptions);
  if (!hasValidToken && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!hasValidToken) {
    const isAdmin = session?.user?.role === "ADMIN";
    if (!isAdmin && order.userId !== session?.user?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const productIds = Array.from(
    new Set(order.items.map((item) => item.productId).filter(Boolean))
  ) as string[];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, manufacturer: true },
      })
    : [];
  const manufacturerByProductId = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null])
  );
  const defaultSuffix = / - Default( Title)?$/i;
  const formatItemName = (name: string, manufacturer?: string | null) => {
    if (!defaultSuffix.test(name)) return name;
    const trimmed = manufacturer?.trim();
    if (trimmed) return name.replace(defaultSuffix, ` - ${trimmed}`);
    return name.replace(defaultSuffix, "");
  };
  const items = order.items.map((item) => ({
    ...item,
    name: formatItemName(
      item.name,
      item.productId ? manufacturerByProductId.get(item.productId) : null
    ),
  }));
  const html = buildInvoiceHtml({ ...order, items });
  const invoiceNumber = `RE-${order.createdAt.getFullYear()}-${order.orderNumber
    .toString()
    .padStart(6, "0")}`;
  const filename = `rechnung-${invoiceNumber}.html`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
