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

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseDocumentStatus = (typeof EXPENSE_DOCUMENT_STATUSES)[number];

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

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function isExpenseDocumentStatus(value: string): value is ExpenseDocumentStatus {
  return (EXPENSE_DOCUMENT_STATUSES as readonly string[]).includes(value);
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
