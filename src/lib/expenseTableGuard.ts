type PrismaLikeError = {
  code?: unknown;
  meta?: unknown;
};

export const EXPENSE_STORAGE_UNAVAILABLE_MESSAGE =
  "Expense storage is not available until the expense migrations are applied.";

export function isMissingExpenseTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as PrismaLikeError;
  if (prismaError.code !== "P2021") return false;
  const table =
    prismaError.meta && typeof prismaError.meta === "object" && "table" in prismaError.meta
      ? (prismaError.meta as { table?: unknown }).table
      : null;
  return (
    typeof table === "string" &&
    (table.includes("Expense") || table.includes("RecurringExpense"))
  );
}
