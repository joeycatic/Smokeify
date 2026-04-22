import type { NextRequest } from "next/server";
import { ADMIN_NO_STORE_HEADERS, adminJson } from "@/lib/adminApi";
import { getVatPageData } from "@/lib/adminAddonData";
import { buildUstvaPreparation } from "@/lib/adminUstva";
import { withAdminRoute } from "@/lib/adminRoute";

const formatEuro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export const GET = withAdminRoute(
  async ({ request }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    const monthKey = url.searchParams.get("month");
    const data = await getVatPageData(12);
    const row =
      (monthKey
        ? data.monthly.find((entry) => entry.monthKey === monthKey)
        : data.current) ?? null;

    if (!row) {
      return adminJson({ error: "Kein UStVA-Zeitraum gefunden." }, { status: 404 });
    }

    const ustva = buildUstvaPreparation({
      monthKey: row.monthKey,
      monthLabel: row.monthLabel,
      outputVatCents: row.outputVatCents,
      refundedVatEstimateCents: row.refundedVatEstimateCents,
      inputVatCents: row.inputVatCents,
      estimatedLiabilityCents: row.estimatedLiabilityCents,
      ordersMissingTaxCount: row.ordersMissingTaxCount,
      status: row.status,
      blockers: row.blockers,
      notes: row.notes,
      missingExpenseDocumentCount: row.missingExpenseDocumentCount,
      missingExpenseVatCount: row.missingExpenseVatCount,
      missingExpenseSupplierCount: row.missingExpenseSupplierCount,
      reviewRequiredExpenseCount: row.reviewRequiredExpenseCount,
      blockedExpenseCount: row.blockedExpenseCount,
      reverseChargeExpenseCount: row.reverseChargeExpenseCount,
    });

    if (format === "json") {
      return adminJson({ ustva });
    }

    const lines = [
      ["kennzahl", "bezeichnung", "wert_eur", "status", "hinweis"].join(","),
      ...ustva.fields.map((field) =>
        [
          field.code ?? "",
          `"${field.label.replaceAll('"', '""')}"`,
          formatEuro(field.valueCents),
          field.status,
          `"${field.note.replaceAll('"', '""')}"`,
        ].join(","),
      ),
      ...ustva.manualReview.map((field) =>
        [
          field.code ?? "",
          `"${field.label.replaceAll('"', '""')}"`,
          formatEuro(field.valueCents),
          field.status,
          `"${field.note.replaceAll('"', '""')}"`,
        ].join(","),
      ),
    ];

    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        ...ADMIN_NO_STORE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ustva-vorbereitung-${ustva.monthKey}.csv"`,
      },
    });
  },
  {
    sameOrigin: false,
    action: "tax.review",
  },
);
