import { NextResponse } from "next/server";
import {
  exportAdminReportOrdersCsv,
  parseAdminReportFilters,
} from "@/lib/adminReports";
import { withAdminRoute } from "@/lib/adminRoute";

const escapeCsv = (value: string | number | null) => {
  if (value === null) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const GET = withAdminRoute(async ({ request }) => {
  const url = new URL(request.url);
  const filters = parseAdminReportFilters({
    reportType: url.searchParams.get("reportType") ?? undefined,
    days: url.searchParams.get("days") ?? undefined,
    sourceStorefront: url.searchParams.get("sourceStorefront") ?? undefined,
    paymentState: url.searchParams.get("paymentState") ?? undefined,
  });
  const orders = await exportAdminReportOrdersCsv(filters);

  const rows = [
    [
      "order_number",
      "created_at",
      "customer_email",
      "source_storefront",
      "source_host",
      "payment_status",
      "status",
      "amount_total_cents",
      "amount_refunded_cents",
      "currency",
      "shipping_country",
    ],
    ...orders.map((order) => [
      order.orderNumber,
      order.createdAt.toISOString(),
      order.customerEmail ?? "",
      order.sourceStorefront ?? "",
      order.sourceHost ?? "",
      order.paymentStatus,
      order.status,
      order.amountTotal,
      order.amountRefunded,
      order.currency,
      order.shippingCountry ?? "",
    ]),
  ];

  const csv = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="smokeify-report-${filters.reportType}-${filters.days}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
