import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
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

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      return NextResponse.json(
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
      "title",
      "category",
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
      expense.title,
      expense.category,
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

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="smokeify-expenses-${fileMonth}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
