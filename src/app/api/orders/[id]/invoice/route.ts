import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const buildInvoiceHtml = (order: {
  id: string;
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

  return `
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <title>Invoice ${order.id.slice(0, 8).toUpperCase()}</title>
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
        <h1>Invoice</h1>
        <div class="muted">Bestellnummer ${order.id.slice(0, 8).toUpperCase()}</div>
        <div class="muted">Datum ${order.createdAt.toLocaleDateString("de-DE")}</div>

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
      </body>
    </html>
  `;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const html = buildInvoiceHtml(order);
  const filename = `invoice-${order.id.slice(0, 8).toUpperCase()}.html`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
