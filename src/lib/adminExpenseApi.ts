import {
  type ExpenseCategory,
  type ExpenseDocumentStatus,
  type RecurringExpenseInterval,
  isExpenseCategory,
  isExpenseDocumentStatus,
  isRecurringExpenseInterval,
} from "@/lib/adminExpenses";

type ParsedExpensePayload = {
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

type ParseResult =
  | { ok: true; data: ParsedExpensePayload }
  | { ok: false; error: string };

type ParsedRecurringExpensePayload = {
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

type RecurringParseResult =
  | { ok: true; data: ParsedRecurringExpensePayload }
  | { ok: false; error: string };

const parseInteger = (value: unknown) => {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
};

const parseOptionalDate = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function parseExpensePayload(body: unknown): ParseResult {
  const input = typeof body === "object" && body ? (body as Record<string, unknown>) : null;
  if (!input) return { ok: false, error: "Invalid payload." };

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required." };

  const category = typeof input.category === "string" ? input.category : "";
  if (!isExpenseCategory(category)) {
    return { ok: false, error: "Expense category is invalid." };
  }

  const documentStatus =
    typeof input.documentStatus === "string" ? input.documentStatus : "";
  if (!isExpenseDocumentStatus(documentStatus)) {
    return { ok: false, error: "Document status is invalid." };
  }

  const grossAmount = parseInteger(input.grossAmount);
  const netAmount = parseInteger(input.netAmount);
  const vatAmount = parseInteger(input.vatAmount);
  if (
    grossAmount === null ||
    netAmount === null ||
    vatAmount === null ||
    grossAmount < 0 ||
    netAmount < 0 ||
    vatAmount < 0
  ) {
    return { ok: false, error: "Gross, net and VAT amounts must be non-negative cents." };
  }

  if (grossAmount !== netAmount + vatAmount) {
    return { ok: false, error: "Gross amount must equal net amount plus VAT amount." };
  }

  const vatRateBasisPoints =
    input.vatRateBasisPoints === null || typeof input.vatRateBasisPoints === "undefined"
      ? null
      : parseInteger(input.vatRateBasisPoints);
  if (
    typeof input.vatRateBasisPoints !== "undefined" &&
    input.vatRateBasisPoints !== null &&
    (vatRateBasisPoints === null || vatRateBasisPoints < 0)
  ) {
    return { ok: false, error: "VAT rate must be a non-negative integer." };
  }

  if (typeof input.isDeductible !== "boolean") {
    return { ok: false, error: "Deductible flag is required." };
  }

  const documentDate = parseOptionalDate(input.documentDate);
  if (!documentDate) return { ok: false, error: "Document date is required." };

  const paidAt = parseOptionalDate(input.paidAt);
  if (
    input.paidAt &&
    typeof input.paidAt === "string" &&
    input.paidAt.trim() &&
    !paidAt
  ) {
    return { ok: false, error: "Paid date is invalid." };
  }

  const supplierId =
    typeof input.supplierId === "string" && input.supplierId.trim()
      ? input.supplierId.trim()
      : null;

  const currency =
    typeof input.currency === "string" && input.currency.trim()
      ? input.currency.trim().toUpperCase()
      : "EUR";

  return {
    ok: true,
    data: {
      supplierId,
      title,
      category,
      notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null,
      currency,
      grossAmount,
      netAmount,
      vatAmount,
      vatRateBasisPoints,
      isDeductible: input.isDeductible,
      documentDate,
      paidAt,
      documentStatus,
    },
  };
}

export function parseRecurringExpensePayload(body: unknown): RecurringParseResult {
  const input = typeof body === "object" && body ? (body as Record<string, unknown>) : null;
  if (!input) return { ok: false, error: "Invalid payload." };

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required." };

  const category = typeof input.category === "string" ? input.category : "";
  if (!isExpenseCategory(category)) {
    return { ok: false, error: "Expense category is invalid." };
  }

  const grossAmount = parseInteger(input.grossAmount);
  const netAmount = parseInteger(input.netAmount);
  const vatAmount = parseInteger(input.vatAmount);
  if (
    grossAmount === null ||
    netAmount === null ||
    vatAmount === null ||
    grossAmount < 0 ||
    netAmount < 0 ||
    vatAmount < 0
  ) {
    return { ok: false, error: "Gross, net and VAT amounts must be non-negative cents." };
  }

  if (grossAmount !== netAmount + vatAmount) {
    return { ok: false, error: "Gross amount must equal net amount plus VAT amount." };
  }

  const vatRateBasisPoints =
    input.vatRateBasisPoints === null || typeof input.vatRateBasisPoints === "undefined"
      ? null
      : parseInteger(input.vatRateBasisPoints);
  if (
    typeof input.vatRateBasisPoints !== "undefined" &&
    input.vatRateBasisPoints !== null &&
    (vatRateBasisPoints === null || vatRateBasisPoints < 0)
  ) {
    return { ok: false, error: "VAT rate must be a non-negative integer." };
  }

  if (typeof input.isDeductible !== "boolean") {
    return { ok: false, error: "Deductible flag is required." };
  }

  if (typeof input.isActive !== "boolean") {
    return { ok: false, error: "Active flag is required." };
  }

  const interval = typeof input.interval === "string" ? input.interval : "";
  if (!isRecurringExpenseInterval(interval)) {
    return { ok: false, error: "Recurring interval is invalid." };
  }

  const nextDueDate = parseOptionalDate(input.nextDueDate);
  if (!nextDueDate) return { ok: false, error: "Next due date is required." };

  const supplierId =
    typeof input.supplierId === "string" && input.supplierId.trim()
      ? input.supplierId.trim()
      : null;

  const currency =
    typeof input.currency === "string" && input.currency.trim()
      ? input.currency.trim().toUpperCase()
      : "EUR";

  return {
    ok: true,
    data: {
      supplierId,
      title,
      category,
      notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null,
      currency,
      grossAmount,
      netAmount,
      vatAmount,
      vatRateBasisPoints,
      isDeductible: input.isDeductible,
      interval,
      nextDueDate,
      isActive: input.isActive,
    },
  };
}

export function serializeExpenseRecord<
  T extends {
    id: string;
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
    createdAt: Date;
    updatedAt: Date;
    supplier?: { id: string; name: string } | null;
  },
>(expense: T) {
  return {
    id: expense.id,
    supplierId: expense.supplierId,
    supplierName: expense.supplier?.name ?? null,
    title: expense.title,
    category: expense.category,
    notes: expense.notes,
    currency: expense.currency,
    grossAmount: expense.grossAmount,
    netAmount: expense.netAmount,
    vatAmount: expense.vatAmount,
    vatRateBasisPoints: expense.vatRateBasisPoints,
    isDeductible: expense.isDeductible,
    documentDate: expense.documentDate.toISOString(),
    paidAt: expense.paidAt ? expense.paidAt.toISOString() : null,
    documentStatus: expense.documentStatus,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export function serializeRecurringExpenseRecord<
  T extends {
    id: string;
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
    createdAt: Date;
    updatedAt: Date;
    supplier?: { id: string; name: string } | null;
  },
>(expense: T) {
  return {
    id: expense.id,
    supplierId: expense.supplierId,
    supplierName: expense.supplier?.name ?? null,
    title: expense.title,
    category: expense.category,
    notes: expense.notes,
    currency: expense.currency,
    grossAmount: expense.grossAmount,
    netAmount: expense.netAmount,
    vatAmount: expense.vatAmount,
    vatRateBasisPoints: expense.vatRateBasisPoints,
    isDeductible: expense.isDeductible,
    interval: expense.interval,
    nextDueDate: expense.nextDueDate.toISOString(),
    isActive: expense.isActive,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}
