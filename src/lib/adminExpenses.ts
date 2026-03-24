export const EXPENSE_CATEGORIES = [
  "INVENTORY",
  "SHIPPING",
  "MARKETING",
  "SOFTWARE",
  "OPERATIONS",
  "TAXES",
  "OTHER",
] as const;

export const EXPENSE_DOCUMENT_STATUSES = ["MISSING", "RECEIVED", "VERIFIED"] as const;
export const RECURRING_EXPENSE_INTERVALS = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseDocumentStatus = (typeof EXPENSE_DOCUMENT_STATUSES)[number];
export type RecurringExpenseInterval = (typeof RECURRING_EXPENSE_INTERVALS)[number];

export type AdminExpenseInput = {
  id?: string;
  supplierId: string | null;
  title: string;
  category: ExpenseCategory;
  notes: string | null;
  currency: string;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  vatRateBasisPoints: number | null;
  isDeductible: boolean;
  documentDate: Date;
  paidAt: Date | null;
  documentStatus: ExpenseDocumentStatus;
};

export type AdminExpenseSummary = {
  currency: string;
  expenseCount: number;
  deductibleExpenseCount: number;
  totalGrossCents: number;
  totalNetCents: number;
  totalVatCents: number;
  deductibleInputVatCents: number;
  missingSupplierCount: number;
  missingDocumentCount: number;
  missingVatCount: number;
  verifiedCount: number;
  readyCount: number;
};

export type VatDeadlineInfo = {
  dueDate: Date;
  daysUntilDue: number;
  statusLabel: "Due soon" | "Upcoming" | "Overdue";
};

export type AdminRecurringExpenseInput = {
  id?: string;
  supplierId: string | null;
  title: string;
  category: ExpenseCategory;
  notes: string | null;
  currency: string;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  vatRateBasisPoints: number | null;
  isDeductible: boolean;
  interval: RecurringExpenseInterval;
  nextDueDate: Date;
  isActive: boolean;
};

export type AdminRecurringExpenseSummary = {
  currency: string;
  activeCount: number;
  inactiveCount: number;
  dueThisMonthCount: number;
  dueNext30DaysCount: number;
  projectedMonthlyGrossCents: number;
  projectedMonthlyVatCents: number;
};

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function isExpenseDocumentStatus(value: string): value is ExpenseDocumentStatus {
  return (EXPENSE_DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export function isRecurringExpenseInterval(value: string): value is RecurringExpenseInterval {
  return (RECURRING_EXPENSE_INTERVALS as readonly string[]).includes(value);
}

export function formatExpenseCategoryLabel(category: ExpenseCategory) {
  switch (category) {
    case "INVENTORY":
      return "Inventory";
    case "SHIPPING":
      return "Shipping";
    case "MARKETING":
      return "Marketing";
    case "SOFTWARE":
      return "Software";
    case "OPERATIONS":
      return "Operations";
    case "TAXES":
      return "Taxes";
    default:
      return "Other";
  }
}

export function formatExpenseDocumentStatusLabel(status: ExpenseDocumentStatus) {
  switch (status) {
    case "MISSING":
      return "Missing document";
    case "RECEIVED":
      return "Received";
    case "VERIFIED":
      return "Verified";
    default:
      return status;
  }
}

export function formatRecurringExpenseIntervalLabel(interval: RecurringExpenseInterval) {
  switch (interval) {
    case "MONTHLY":
      return "Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "YEARLY":
      return "Yearly";
    default:
      return interval;
  }
}

export function getRecurringExpenseMonthlyAmountCents(
  amountCents: number,
  interval: RecurringExpenseInterval,
) {
  if (interval === "QUARTERLY") return Math.round(amountCents / 3);
  if (interval === "YEARLY") return Math.round(amountCents / 12);
  return amountCents;
}

export function buildExpenseSummary(
  expenses: AdminExpenseInput[],
  currency = expenses[0]?.currency ?? "EUR",
): AdminExpenseSummary {
  return expenses.reduce<AdminExpenseSummary>(
    (summary, expense) => {
      summary.expenseCount += 1;
      summary.totalGrossCents += Math.max(expense.grossAmount, 0);
      summary.totalNetCents += Math.max(expense.netAmount, 0);
      summary.totalVatCents += Math.max(expense.vatAmount, 0);
      if (expense.isDeductible) {
        summary.deductibleExpenseCount += 1;
        summary.deductibleInputVatCents += Math.max(expense.vatAmount, 0);
      }
      if (!expense.supplierId) summary.missingSupplierCount += 1;
      if (expense.documentStatus === "MISSING") summary.missingDocumentCount += 1;
      if (expense.isDeductible && expense.vatAmount <= 0) summary.missingVatCount += 1;
      if (expense.documentStatus === "VERIFIED") summary.verifiedCount += 1;
      if (
        expense.documentStatus !== "MISSING" &&
        (!expense.isDeductible || expense.vatAmount > 0)
      ) {
        summary.readyCount += 1;
      }
      return summary;
    },
    {
      currency,
      expenseCount: 0,
      deductibleExpenseCount: 0,
      totalGrossCents: 0,
      totalNetCents: 0,
      totalVatCents: 0,
      deductibleInputVatCents: 0,
      missingSupplierCount: 0,
      missingDocumentCount: 0,
      missingVatCount: 0,
      verifiedCount: 0,
      readyCount: 0,
    },
  );
}

export function buildRecurringExpenseSummary(
  expenses: AdminRecurringExpenseInput[],
  currency = expenses[0]?.currency ?? "EUR",
  now = new Date(),
): AdminRecurringExpenseSummary {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const next30Days = new Date(now);
  next30Days.setDate(next30Days.getDate() + 30);

  return expenses.reduce<AdminRecurringExpenseSummary>(
    (summary, expense) => {
      if (expense.isActive) {
        summary.activeCount += 1;
        summary.projectedMonthlyGrossCents += getRecurringExpenseMonthlyAmountCents(
          expense.grossAmount,
          expense.interval,
        );
        summary.projectedMonthlyVatCents += getRecurringExpenseMonthlyAmountCents(
          expense.vatAmount,
          expense.interval,
        );

        if (expense.nextDueDate >= monthStart && expense.nextDueDate < nextMonthStart) {
          summary.dueThisMonthCount += 1;
        }
        if (expense.nextDueDate >= now && expense.nextDueDate <= next30Days) {
          summary.dueNext30DaysCount += 1;
        }
      } else {
        summary.inactiveCount += 1;
      }
      return summary;
    },
    {
      currency,
      activeCount: 0,
      inactiveCount: 0,
      dueThisMonthCount: 0,
      dueNext30DaysCount: 0,
      projectedMonthlyGrossCents: 0,
      projectedMonthlyVatCents: 0,
    },
  );
}

export function getVatDeadlineInfo(now = new Date()): VatDeadlineInfo {
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 10);
  dueDate.setHours(23, 59, 59, 999);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay);
  return {
    dueDate,
    daysUntilDue,
    statusLabel: daysUntilDue < 0 ? "Overdue" : daysUntilDue <= 7 ? "Due soon" : "Upcoming",
  };
}
