import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import { getExpensesPageData } from "@/lib/adminAddonData";
import { parseExpensePayload, serializeExpenseRecord, serializeRecurringExpenseRecord } from "@/lib/adminExpenseApi";
import { canAdminPerformAction } from "@/lib/adminPermissions";
import {
  EXPENSE_STORAGE_UNAVAILABLE_MESSAGE,
  isMissingExpenseTableError,
} from "@/lib/expenseTableGuard";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAdminPerformAction(session.user.role, "tax.review")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days") ?? "120");
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 120;
  const data = await getExpensesPageData(days);

  return NextResponse.json({
    suppliers: data.suppliers,
    summary: data.summary,
    recurringSummary: data.recurringSummary,
    currentMonthSummary: data.currentMonthSummary,
    expenseByCategory: data.expenseByCategory,
    migrationRequired: data.expenseMigrationRequired,
    deadline: {
      dueDate: data.deadline.dueDate.toISOString(),
      daysUntilDue: data.deadline.daysUntilDue,
      statusLabel: data.deadline.statusLabel,
    },
    expenses: data.expenses.map((expense) => serializeExpenseRecord(expense)),
    recurringExpenses: data.recurringExpenses.map((expense) =>
      serializeRecurringExpenseRecord(expense),
    ),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-expenses:ip:${ip}`,
    limit: 50,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAdminPerformAction(session.user.role, "tax.review")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = parseExpensePayload(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.data.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: parsed.data.supplierId },
      select: { id: true },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 400 });
    }
  }

  try {
    const expense = await prisma.expense.create({
      data: parsed.data,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "expense.create",
      targetType: "expense",
      targetId: expense.id,
      summary: `Created expense ${expense.title}`,
      metadata: {
        category: expense.category,
        grossAmount: expense.grossAmount,
        vatAmount: expense.vatAmount,
        supplierId: expense.supplierId,
      },
    });

    return NextResponse.json({ expense: serializeExpenseRecord(expense) });
  } catch (error) {
    if (isMissingExpenseTableError(error)) {
      return NextResponse.json(
        { error: EXPENSE_STORAGE_UNAVAILABLE_MESSAGE, migrationRequired: true },
        { status: 503 },
      );
    }
    throw error;
  }
}
