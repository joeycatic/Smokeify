import { prisma } from "@/lib/prisma";
import { adminAttachmentHeaders, adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  EXPENSE_STORAGE_UNAVAILABLE_MESSAGE,
  isMissingExpenseTableError,
} from "@/lib/expenseTableGuard";

const escapeCsv = (value: string | number | boolean | null) => {
  if (value === null) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const GET = withAdminRoute(
  async ({ request, session }) => {
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");
    const now = new Date();
    const monthStart = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? new Date(`${monthParam}-01T00:00:00.000Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
    );

    let expenses;
    try {
      expenses = await prisma.expense.findMany({
        where: {
          documentDate: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        orderBy: [{ documentDate: "asc" }, { createdAt: "asc" }],
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
      });
    } catch (error) {
      if (isMissingExpenseTableError(error)) {
        return adminJson(
          { error: EXPENSE_STORAGE_UNAVAILABLE_MESSAGE, migrationRequired: true },
          { status: 503 },
        );
      }
      throw error;
    }

    const rows = [
      [
        "document_date",
        "paid_at",
        "supplier",
        "rechnungsaussteller",
        "rechnungsnummer",
        "title",
        "category",
        "tax_review_status",
        "invoice_validation_status",
        "input_vat_eligibility",
        "manual_review_reason",
        "gross_amount_cents",
        "net_amount_cents",
        "vat_amount_cents",
        "vat_rate_basis_points",
        "deductible",
        "document_status",
        "currency",
        "notes",
      ],
      ...expenses.map((expense) => [
        expense.documentDate.toISOString(),
        expense.paidAt ? expense.paidAt.toISOString() : "",
        expense.supplier?.name ?? "",
        expense.invoiceIssuerName ?? "",
        expense.invoiceNumber ?? "",
        expense.title,
        expense.category,
        expense.taxReviewStatus,
        expense.invoiceValidationStatus,
        expense.inputVatEligibility,
        expense.manualReviewReason ?? "",
        expense.grossAmount,
        expense.netAmount,
        expense.vatAmount,
        expense.vatRateBasisPoints ?? "",
        expense.isDeductible,
        expense.documentStatus,
        expense.currency,
        expense.notes ?? "",
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
    const fileMonth = `${monthStart.getUTCFullYear()}-${String(
      monthStart.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "admin.ust.exportiert",
      targetType: "expense_export",
      targetId: fileMonth,
      summary: `USt-Ausgabeexport für ${fileMonth} erstellt`,
      metadata: {
        expenseCount: expenses.length,
        month: fileMonth,
      },
    });

    return new Response(csv, {
      headers: adminAttachmentHeaders(
        `smokeify-expenses-${fileMonth}.csv`,
        "text/csv; charset=utf-8",
      ),
    });
  },
  { action: "tax.review" },
);
