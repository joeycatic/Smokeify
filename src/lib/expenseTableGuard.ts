type PrismaLikeError = {
  code?: unknown;
  meta?: unknown;
  message?: unknown;
};

export const EXPENSE_STORAGE_UNAVAILABLE_MESSAGE =
  "Expense storage is not available until the expense migrations are applied.";

function readPrismaMetaString(error: PrismaLikeError, key: "table" | "column") {
  if (!error.meta || typeof error.meta !== "object" || !(key in error.meta)) {
    return null;
  }

  const value = (error.meta as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function referencesExpenseStorage(value: string | null) {
  return Boolean(
    value &&
      (value.includes("Expense") ||
        value.includes("RecurringExpense") ||
        value.includes("expense") ||
        value.includes("recurringExpense")),
  );
}

export function isMissingExpenseTableError(error: unknown) {
  if (error instanceof Error && referencesExpenseStorage(error.message)) {
    if (error.message.includes("does not exist")) {
      return true;
    }
  }

  if (!error || typeof error !== "object") return false;
  const prismaError = error as PrismaLikeError;

  if (prismaError.code === "P2021") {
    return referencesExpenseStorage(readPrismaMetaString(prismaError, "table"));
  }

  if (prismaError.code === "P2022") {
    return referencesExpenseStorage(readPrismaMetaString(prismaError, "column"));
  }

  return false;
}
