import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  parseRecurringExpensePayload,
  serializeRecurringExpenseRecord,
} from "@/lib/adminExpenseApi";
import {
  EXPENSE_STORAGE_UNAVAILABLE_MESSAGE,
  isMissingExpenseTableError,
} from "@/lib/expenseTableGuard";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-recurring-expense-update:ip:${ip}`,
    limit: 60,
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

  const { id } = await context.params;
  const parsed = parseRecurringExpensePayload(await request.json());
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
    const expense = await prisma.recurringExpense.update({
      where: { id },
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
      action: "recurring-expense.update",
      targetType: "recurring-expense",
      targetId: expense.id,
      summary: `Updated recurring expense ${expense.title}`,
      metadata: {
        category: expense.category,
        grossAmount: expense.grossAmount,
        interval: expense.interval,
        nextDueDate: expense.nextDueDate.toISOString(),
        isActive: expense.isActive,
        supplierId: expense.supplierId,
      },
    });

    return NextResponse.json({ expense: serializeRecurringExpenseRecord(expense) });
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
