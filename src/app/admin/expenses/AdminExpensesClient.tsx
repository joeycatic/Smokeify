"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEFAULT_VAT_RATE_BASIS_POINTS,
  EXPENSE_CATEGORIES,
  EXPENSE_DOCUMENT_STATUSES,
  formatGermanVatRateLabel,
  RECURRING_EXPENSE_INTERVALS,
  formatInputVatEligibilityLabel,
  calculateVatComponentsFromGross,
  calculateVatComponentsFromNet,
  formatExpenseCategoryLabel,
  formatExpenseDocumentStatusLabel,
  formatRecurringExpenseIntervalLabel,
  formatTaxReviewStatusLabel,
  getRecurringExpenseMonthlyAmountCents,
  type ExpenseCategory,
  type ExpenseDocumentStatus,
  type GermanVatRate,
  type InputVatEligibility,
  type RecurringExpenseInterval,
  type TaxClassification,
  type TaxRegime,
  type TaxReviewStatus,
} from "@/lib/adminExpenses";

type SupplierOption = {
  id: string;
  name: string;
};

type ExpenseSummary = {
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
  invoiceCompleteCount: number;
  reviewRequiredCount: number;
  blockedCount: number;
};

type RecurringExpenseSummary = {
  currency: string;
  activeCount: number;
  inactiveCount: number;
  dueThisMonthCount: number;
  dueNext30DaysCount: number;
  projectedMonthlyGrossCents: number;
  projectedMonthlyVatCents: number;
};

type ExpenseCategorySummary = {
  category: string;
  grossAmount: number;
  vatAmount: number;
  count: number;
};

type VatDeadline = {
  dueDate: string;
  daysUntilDue: number;
  statusLabel: "Due soon" | "Upcoming" | "Overdue";
};

type ExpenseRecord = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  title: string;
  category: ExpenseCategory;
  notes: string | null;
  invoiceIssuerName: string | null;
  invoiceNumber: string | null;
  invoiceDescription: string | null;
  supplierCountry: string | null;
  reverseChargeReference: string | null;
  isSmallBusinessSupplier: boolean;
  currency: string;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  vatRateBasisPoints: number | null;
  taxRegime: TaxRegime;
  germanVatRate: GermanVatRate;
  taxClassification: TaxClassification;
  invoiceValidationStatus: "ENTWURF" | "PRUEFUNG_ERFORDERLICH" | "VOLLSTAENDIG";
  inputVatEligibility: InputVatEligibility;
  taxReviewStatus: TaxReviewStatus;
  manualReviewReason: string | null;
  isDeductible: boolean;
  documentDate: string;
  paidAt: string | null;
  documentStatus: ExpenseDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

type RecurringExpenseRecord = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
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
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ExpenseFormState = {
  supplierId: string;
  title: string;
  category: ExpenseCategory;
  notes: string;
  invoiceIssuerName: string;
  invoiceNumber: string;
  invoiceDescription: string;
  supplierCountry: string;
  reverseChargeReference: string;
  isSmallBusinessSupplier: boolean;
  taxRegime: TaxRegime | "";
  grossAmount: string;
  netAmount: string;
  vatAmount: string;
  vatRateBasisPoints: string;
  isDeductible: boolean;
  documentDate: string;
  paidAt: string;
  documentStatus: ExpenseDocumentStatus;
};

type RecurringExpenseFormState = {
  supplierId: string;
  title: string;
  category: ExpenseCategory;
  notes: string;
  grossAmount: string;
  netAmount: string;
  vatAmount: string;
  vatRateBasisPoints: string;
  isDeductible: boolean;
  interval: RecurringExpenseInterval;
  nextDueDate: string;
  isActive: boolean;
};

type Tone = {
  badge: string;
  soft: string;
  bar: string;
  glow: string;
};

const CATEGORY_TONES: Record<ExpenseCategory, Tone> = {
  INVENTORY: {
    badge: "bg-cyan-400/10 text-cyan-300",
    soft: "border-cyan-400/15 bg-cyan-400/8 text-cyan-100",
    bar: "bg-cyan-300",
    glow: "from-cyan-400/16 via-cyan-400/6 to-transparent",
  },
  SHIPPING: {
    badge: "bg-sky-400/10 text-sky-300",
    soft: "border-sky-400/15 bg-sky-400/8 text-sky-100",
    bar: "bg-sky-300",
    glow: "from-sky-400/16 via-sky-400/6 to-transparent",
  },
  MARKETING: {
    badge: "bg-fuchsia-400/10 text-fuchsia-300",
    soft: "border-fuchsia-400/15 bg-fuchsia-400/8 text-fuchsia-100",
    bar: "bg-fuchsia-300",
    glow: "from-fuchsia-400/16 via-fuchsia-400/6 to-transparent",
  },
  SOFTWARE: {
    badge: "bg-violet-400/10 text-violet-300",
    soft: "border-violet-400/15 bg-violet-400/8 text-violet-100",
    bar: "bg-violet-300",
    glow: "from-violet-400/16 via-violet-400/6 to-transparent",
  },
  OPERATIONS: {
    badge: "bg-amber-400/10 text-amber-300",
    soft: "border-amber-400/15 bg-amber-400/8 text-amber-100",
    bar: "bg-amber-300",
    glow: "from-amber-400/16 via-amber-400/6 to-transparent",
  },
  TAXES: {
    badge: "bg-rose-400/10 text-rose-300",
    soft: "border-rose-400/15 bg-rose-400/8 text-rose-100",
    bar: "bg-rose-300",
    glow: "from-rose-400/16 via-rose-400/6 to-transparent",
  },
  OTHER: {
    badge: "bg-slate-400/10 text-slate-300",
    soft: "border-slate-400/15 bg-slate-400/8 text-slate-100",
    bar: "bg-slate-300",
    glow: "from-slate-400/16 via-slate-400/6 to-transparent",
  },
};

const DOCUMENT_STATUS_TONES: Record<ExpenseDocumentStatus, Tone> = {
  MISSING: {
    badge: "bg-rose-400/10 text-rose-300",
    soft: "border-rose-400/15 bg-rose-400/8 text-rose-100",
    bar: "bg-rose-300",
    glow: "from-rose-400/16 via-rose-400/6 to-transparent",
  },
  RECEIVED: {
    badge: "bg-amber-400/10 text-amber-300",
    soft: "border-amber-400/15 bg-amber-400/8 text-amber-100",
    bar: "bg-amber-300",
    glow: "from-amber-400/16 via-amber-400/6 to-transparent",
  },
  VERIFIED: {
    badge: "bg-emerald-400/10 text-emerald-300",
    soft: "border-emerald-400/15 bg-emerald-400/8 text-emerald-100",
    bar: "bg-emerald-300",
    glow: "from-emerald-400/16 via-emerald-400/6 to-transparent",
  },
};

const DEADLINE_TONES: Record<VatDeadline["statusLabel"], Tone> = {
  "Due soon": {
    badge: "bg-amber-400/10 text-amber-300",
    soft: "border-amber-400/15 bg-amber-400/8 text-amber-100",
    bar: "bg-amber-300",
    glow: "from-amber-400/16 via-amber-400/6 to-transparent",
  },
  Upcoming: {
    badge: "bg-cyan-400/10 text-cyan-300",
    soft: "border-cyan-400/15 bg-cyan-400/8 text-cyan-100",
    bar: "bg-cyan-300",
    glow: "from-cyan-400/16 via-cyan-400/6 to-transparent",
  },
  Overdue: {
    badge: "bg-rose-400/10 text-rose-300",
    soft: "border-rose-400/15 bg-rose-400/8 text-rose-100",
    bar: "bg-rose-300",
    glow: "from-rose-400/16 via-rose-400/6 to-transparent",
  },
};

const formatMoney = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

const toMoneyInput = (amountCents: number) => (amountCents / 100).toFixed(2);

const parseMoneyInputToCents = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
};

const parseVatRatePercentInputToBasisPoints = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, "").replace(/%/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
};

const formatVatRateBasisPointsAsPercentInput = (vatRateBasisPoints: number | null) => {
  if (vatRateBasisPoints === null || !Number.isFinite(vatRateBasisPoints)) return "";
  return (vatRateBasisPoints / 100)
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
};

const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : "");

const emptyForm = (): ExpenseFormState => ({
  supplierId: "",
  title: "",
  category: "OPERATIONS",
  notes: "",
  invoiceIssuerName: "",
  invoiceNumber: "",
  invoiceDescription: "",
  supplierCountry: "DE",
  reverseChargeReference: "",
  isSmallBusinessSupplier: false,
  taxRegime: "",
  grossAmount: "",
  netAmount: "",
  vatAmount: "",
  vatRateBasisPoints: formatVatRateBasisPointsAsPercentInput(DEFAULT_VAT_RATE_BASIS_POINTS),
  isDeductible: true,
  documentDate: new Date().toISOString().slice(0, 10),
  paidAt: "",
  documentStatus: "RECEIVED",
});

const emptyRecurringForm = (): RecurringExpenseFormState => ({
  supplierId: "",
  title: "",
  category: "OPERATIONS",
  notes: "",
  grossAmount: "",
  netAmount: "",
  vatAmount: "",
  vatRateBasisPoints: formatVatRateBasisPointsAsPercentInput(DEFAULT_VAT_RATE_BASIS_POINTS),
  isDeductible: true,
  interval: "MONTHLY",
  nextDueDate: new Date().toISOString().slice(0, 10),
  isActive: true,
});

const buildPayload = (
  form: ExpenseFormState,
  amountSource: "gross" | "net" = "gross",
) => {
  const parsedVatRateBasisPoints = parseVatRatePercentInputToBasisPoints(form.vatRateBasisPoints);
  if (parsedVatRateBasisPoints === null) {
    return { ok: false as const, error: "VAT rate must be a valid percentage." };
  }
  const amountInput =
    amountSource === "net"
      ? parseMoneyInputToCents(form.netAmount)
      : parseMoneyInputToCents(form.grossAmount);
  if (amountInput === null) {
    return {
      ok: false as const,
      error: `${amountSource === "net" ? "Net" : "Gross"} amount must be a valid amount.`,
    };
  }
  const { grossAmount, netAmount, vatAmount, vatRateBasisPoints } =
    amountSource === "net"
      ? calculateVatComponentsFromNet(amountInput, parsedVatRateBasisPoints)
      : calculateVatComponentsFromGross(amountInput, parsedVatRateBasisPoints);
  if (!form.title.trim()) {
    return { ok: false as const, error: "Title is required." };
  }
  if (!form.documentDate) {
    return { ok: false as const, error: "Document date is required." };
  }

  return {
    ok: true as const,
    data: {
      supplierId: form.supplierId || null,
      title: form.title.trim(),
      category: form.category,
      notes: form.notes.trim() || null,
      invoiceIssuerName: form.invoiceIssuerName.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      invoiceDescription: form.invoiceDescription.trim() || null,
      supplierCountry: form.supplierCountry.trim().toUpperCase() || null,
      reverseChargeReference: form.reverseChargeReference.trim() || null,
      isSmallBusinessSupplier: form.isSmallBusinessSupplier,
      currency: "EUR",
      grossAmount,
      netAmount,
      vatAmount,
      vatRateBasisPoints,
      taxRegime: form.taxRegime || null,
      isDeductible: form.isDeductible,
      documentDate: form.documentDate,
      paidAt: form.paidAt || null,
      documentStatus: form.documentStatus,
    },
  };
};

const buildRecurringPayload = (
  form: RecurringExpenseFormState,
  amountSource: "gross" | "net" = "gross",
) => {
  const parsedVatRateBasisPoints = parseVatRatePercentInputToBasisPoints(form.vatRateBasisPoints);
  if (parsedVatRateBasisPoints === null) {
    return { ok: false as const, error: "VAT rate must be a valid percentage." };
  }
  const amountInput =
    amountSource === "net"
      ? parseMoneyInputToCents(form.netAmount)
      : parseMoneyInputToCents(form.grossAmount);
  if (amountInput === null) {
    return {
      ok: false as const,
      error: `${amountSource === "net" ? "Net" : "Gross"} amount must be a valid amount.`,
    };
  }
  const { grossAmount, netAmount, vatAmount, vatRateBasisPoints } =
    amountSource === "net"
      ? calculateVatComponentsFromNet(amountInput, parsedVatRateBasisPoints)
      : calculateVatComponentsFromGross(amountInput, parsedVatRateBasisPoints);
  if (!form.title.trim()) {
    return { ok: false as const, error: "Title is required." };
  }
  if (!form.nextDueDate) {
    return { ok: false as const, error: "Next due date is required." };
  }

  return {
    ok: true as const,
    data: {
      supplierId: form.supplierId || null,
      title: form.title.trim(),
      category: form.category,
      notes: form.notes.trim() || null,
      currency: "EUR",
      grossAmount,
      netAmount,
      vatAmount,
      vatRateBasisPoints,
      isDeductible: form.isDeductible,
      interval: form.interval,
      nextDueDate: form.nextDueDate,
      isActive: form.isActive,
    },
  };
};

const toEditableForm = (expense: ExpenseRecord): ExpenseFormState => ({
  supplierId: expense.supplierId ?? "",
  title: expense.title,
  category: expense.category,
  notes: expense.notes ?? "",
  invoiceIssuerName: expense.invoiceIssuerName ?? "",
  invoiceNumber: expense.invoiceNumber ?? "",
  invoiceDescription: expense.invoiceDescription ?? "",
  supplierCountry: expense.supplierCountry ?? "DE",
  reverseChargeReference: expense.reverseChargeReference ?? "",
  isSmallBusinessSupplier: expense.isSmallBusinessSupplier,
  taxRegime: expense.taxRegime ?? "",
  grossAmount: toMoneyInput(expense.grossAmount),
  netAmount: toMoneyInput(expense.netAmount),
  vatAmount: toMoneyInput(expense.vatAmount),
  vatRateBasisPoints: formatVatRateBasisPointsAsPercentInput(expense.vatRateBasisPoints),
  isDeductible: expense.isDeductible,
  documentDate: toDateInput(expense.documentDate),
  paidAt: toDateInput(expense.paidAt),
  documentStatus: expense.documentStatus,
});

const toEditableRecurringForm = (
  expense: RecurringExpenseRecord,
): RecurringExpenseFormState => ({
  supplierId: expense.supplierId ?? "",
  title: expense.title,
  category: expense.category,
  notes: expense.notes ?? "",
  grossAmount: toMoneyInput(expense.grossAmount),
  netAmount: toMoneyInput(expense.netAmount),
  vatAmount: toMoneyInput(expense.vatAmount),
  vatRateBasisPoints: formatVatRateBasisPointsAsPercentInput(expense.vatRateBasisPoints),
  isDeductible: expense.isDeductible,
  interval: expense.interval,
  nextDueDate: toDateInput(expense.nextDueDate),
  isActive: expense.isActive,
});

const getDerivedGrossFields = (grossValue: string, vatRateValue: string) => {
  const grossAmount = parseMoneyInputToCents(grossValue);
  const vatRateBasisPoints = parseVatRatePercentInputToBasisPoints(vatRateValue);
  if (grossAmount === null || vatRateBasisPoints === null) {
    return {
      netAmount: "",
      vatAmount: "",
    };
  }

  const { netAmount, vatAmount } = calculateVatComponentsFromGross(grossAmount, vatRateBasisPoints);

  return {
    netAmount: toMoneyInput(netAmount),
    vatAmount: toMoneyInput(vatAmount),
  };
};

const getDerivedNetFields = (netValue: string, vatRateValue: string) => {
  const netAmount = parseMoneyInputToCents(netValue);
  const vatRateBasisPoints = parseVatRatePercentInputToBasisPoints(vatRateValue);
  if (netAmount === null || vatRateBasisPoints === null) {
    return {
      grossAmount: "",
      vatAmount: "",
    };
  }

  const { grossAmount, vatAmount } = calculateVatComponentsFromNet(netAmount, vatRateBasisPoints);

  return {
    grossAmount: toMoneyInput(grossAmount),
    vatAmount: toMoneyInput(vatAmount),
  };
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const calculateShare = (value: number, total: number) =>
  total > 0 ? clampPercentage((value / total) * 100) : 0;

const getCategoryTone = (category: ExpenseCategory) => CATEGORY_TONES[category] ?? CATEGORY_TONES.OTHER;

const getDocumentStatusTone = (status: ExpenseDocumentStatus) => DOCUMENT_STATUS_TONES[status];

const formatInvoiceValidationStatus = (
  value: ExpenseRecord["invoiceValidationStatus"],
) => {
  switch (value) {
    case "VOLLSTAENDIG":
      return "Vollständig";
    case "PRUEFUNG_ERFORDERLICH":
      return "Prüfung erforderlich";
    default:
      return "Entwurf";
  }
};

const formatTaxClassificationLabel = (value: TaxClassification) => {
  switch (value) {
    case "DOMESTIC_STANDARD":
      return "Steuerpflichtig";
    case "DOMESTIC_REDUCED":
      return "Ermäßigt";
    case "DOMESTIC_ZERO":
      return "0 %";
    case "EXEMPT":
      return "Steuerfrei";
    case "REVERSE_CHARGE":
      return "Reverse-Charge";
    case "KLEINUNTERNEHMER":
      return "Kleinunternehmer";
    case "INTRA_EU_MANUAL":
      return "Innergemeinschaftlich";
    case "EXPORT_MANUAL":
      return "Export / manuell";
    default:
      return "Manuelle Prüfung";
  }
};

type AdminExpensesClientProps = {
  initialSuppliers: SupplierOption[];
  initialExpenses: ExpenseRecord[];
  initialRecurringExpenses: RecurringExpenseRecord[];
  initialSummary: ExpenseSummary;
  initialRecurringSummary: RecurringExpenseSummary;
  initialCurrentMonthSummary: ExpenseSummary;
  initialExpenseByCategory: ExpenseCategorySummary[];
  initialDeadline: VatDeadline;
  initialMigrationRequired: boolean;
};

const inputClass =
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/30 focus:bg-white/[0.05]";
const derivedInputClass = `${inputClass} text-slate-400`;

export default function AdminExpensesClient({
  initialSuppliers,
  initialExpenses,
  initialRecurringExpenses,
  initialSummary,
  initialRecurringSummary,
  initialCurrentMonthSummary,
  initialExpenseByCategory,
  initialDeadline,
  initialMigrationRequired,
}: AdminExpensesClientProps) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [recurringExpenses, setRecurringExpenses] = useState(initialRecurringExpenses);
  const [summary, setSummary] = useState(initialSummary);
  const [recurringSummary, setRecurringSummary] = useState(initialRecurringSummary);
  const [currentMonthSummary, setCurrentMonthSummary] = useState(initialCurrentMonthSummary);
  const [expenseByCategory, setExpenseByCategory] = useState(initialExpenseByCategory);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [migrationRequired, setMigrationRequired] = useState(initialMigrationRequired);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [expenseVatRateInputs, setExpenseVatRateInputs] = useState<Record<string, string>>({});
  const [recurringVatRateInputs, setRecurringVatRateInputs] = useState<Record<string, string>>({});
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingRecurringExpenseId, setEditingRecurringExpenseId] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState<ExpenseFormState>(emptyForm);
  const [newRecurringExpense, setNewRecurringExpense] =
    useState<RecurringExpenseFormState>(emptyRecurringForm);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/expenses", { method: "GET" });
      const data = (await response.json()) as {
        error?: string;
        suppliers?: SupplierOption[];
        expenses?: ExpenseRecord[];
        recurringExpenses?: RecurringExpenseRecord[];
        summary?: ExpenseSummary;
        recurringSummary?: RecurringExpenseSummary;
        currentMonthSummary?: ExpenseSummary;
        expenseByCategory?: ExpenseCategorySummary[];
        deadline?: VatDeadline;
        migrationRequired?: boolean;
      };
      if (!response.ok) {
        setError(data.error ?? "Failed to load expenses.");
        return;
      }
      setSuppliers(data.suppliers ?? []);
      setExpenses(data.expenses ?? []);
      setRecurringExpenses(data.recurringExpenses ?? []);
      setSummary(data.summary ?? initialSummary);
      setRecurringSummary(data.recurringSummary ?? initialRecurringSummary);
      setCurrentMonthSummary(data.currentMonthSummary ?? initialCurrentMonthSummary);
      setExpenseByCategory(data.expenseByCategory ?? []);
      setDeadline(data.deadline ?? initialDeadline);
      setMigrationRequired(Boolean(data.migrationRequired));
      setExpenseVatRateInputs({});
      setRecurringVatRateInputs({});
      setEditingExpenseId(null);
      setEditingRecurringExpenseId(null);
    } catch {
      setError("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return expenses;
    return expenses.filter((expense) =>
      [
        expense.title,
        expense.supplierName ?? "",
        expense.category,
        expense.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [expenses, query]);

  const filteredRecurringExpenses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return recurringExpenses;
    return recurringExpenses.filter((expense) =>
      [
        expense.title,
        expense.supplierName ?? "",
        expense.category,
        expense.notes ?? "",
        expense.interval,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [recurringExpenses, query]);

  const currentMonthGrossTotal = currentMonthSummary.totalGrossCents || 0;
  const readyRate = calculateShare(currentMonthSummary.readyCount, currentMonthSummary.expenseCount);
  const verifiedRate = calculateShare(
    currentMonthSummary.verifiedCount,
    currentMonthSummary.expenseCount,
  );
  const deductibleRate = calculateShare(
    currentMonthSummary.deductibleExpenseCount,
    currentMonthSummary.expenseCount,
  );
  const recurringActiveRate = calculateShare(
    recurringSummary.activeCount,
    recurringSummary.activeCount + recurringSummary.inactiveCount,
  );
  const topCategoryRows = expenseByCategory.slice(0, 5).map((row) => ({
    ...row,
    share: calculateShare(row.grossAmount, currentMonthGrossTotal),
  }));

  const createExpense = async () => {
    setError("");
    setNotice("");
    const payload = buildPayload(newExpense, "net");
    if (!payload.ok) {
      setError(payload.error);
      return;
    }

    try {
      const response = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });
      const data = (await response.json()) as { error?: string; migrationRequired?: boolean };
      if (!response.ok) {
        if (data.migrationRequired) setMigrationRequired(true);
        setError(data.error ?? "Failed to create expense.");
        return;
      }
      setNewExpense(emptyForm());
      setNotice("Expense created.");
      await loadData();
    } catch {
      setError("Failed to create expense.");
    }
  };

  const createRecurringExpense = async () => {
    setError("");
    setNotice("");
    const payload = buildRecurringPayload(newRecurringExpense, "net");
    if (!payload.ok) {
      setError(payload.error);
      return;
    }

    try {
      const response = await fetch("/api/admin/expenses/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });
      const data = (await response.json()) as { error?: string; migrationRequired?: boolean };
      if (!response.ok) {
        if (data.migrationRequired) setMigrationRequired(true);
        setError(data.error ?? "Failed to create recurring cost.");
        return;
      }
      setNewRecurringExpense(emptyRecurringForm());
      setNotice("Recurring cost created.");
      await loadData();
    } catch {
      setError("Failed to create recurring cost.");
    }
  };

  const updateExpense = async (expense: ExpenseRecord) => {
    setError("");
    setNotice("");
    setSavingId(expense.id);
    const payload = buildPayload(toEditableForm(expense));
    if (!payload.ok) {
      setSavingId(null);
      setError(payload.error);
      return;
    }

    try {
      const response = await fetch(`/api/admin/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });
      const data = (await response.json()) as { error?: string; migrationRequired?: boolean };
      if (!response.ok) {
        if (data.migrationRequired) setMigrationRequired(true);
        setError(data.error ?? "Failed to update expense.");
        return;
      }
      setNotice("Expense updated.");
      await loadData();
    } catch {
      setError("Failed to update expense.");
    } finally {
      setSavingId(null);
    }
  };

  const updateRecurringExpense = async (expense: RecurringExpenseRecord) => {
    setError("");
    setNotice("");
    setSavingId(expense.id);
    const payload = buildRecurringPayload(toEditableRecurringForm(expense));
    if (!payload.ok) {
      setSavingId(null);
      setError(payload.error);
      return;
    }

    try {
      const response = await fetch(`/api/admin/expenses/recurring/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });
      const data = (await response.json()) as { error?: string; migrationRequired?: boolean };
      if (!response.ok) {
        if (data.migrationRequired) setMigrationRequired(true);
        setError(data.error ?? "Failed to update recurring cost.");
        return;
      }
      setNotice("Recurring cost updated.");
      await loadData();
    } catch {
      setError("Failed to update recurring cost.");
    } finally {
      setSavingId(null);
    }
  };

  const updateExpenseField = <K extends keyof ExpenseRecord>(
    id: string,
    key: K,
    value: ExpenseRecord[K],
  ) => {
    setExpenses((current) =>
      current.map((expense) =>
        expense.id === id ? { ...expense, [key]: value } : expense,
      ),
    );
  };

  const updateRecurringExpenseField = <K extends keyof RecurringExpenseRecord>(
    id: string,
    key: K,
    value: RecurringExpenseRecord[K],
  ) => {
    setRecurringExpenses((current) =>
      current.map((expense) => (expense.id === id ? { ...expense, [key]: value } : expense)),
    );
  };

  const cancelExpenseEditing = async () => {
    setEditingExpenseId(null);
    await loadData();
  };

  const cancelRecurringExpenseEditing = async () => {
    setEditingRecurringExpenseId(null);
    await loadData();
  };

  const currentMonthKey = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,18,11,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Control Layer / Expenses
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Expense capture and input VAT readiness
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Record supplier-linked expenses, maintain VAT metadata, and feed the VAT monitor with
              deductible input tax instead of output-only estimates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {migrationRequired ? (
              <span className="inline-flex h-10 items-center rounded-full border border-red-400/20 bg-red-500/10 px-4 text-sm font-semibold text-red-200">
                Export unavailable until migration
              </span>
            ) : (
              <a
                href={`/api/admin/expenses/export?month=${currentMonthKey}`}
                className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
              >
                Export current month CSV
              </a>
            )}
            <Link
              href="/admin/vat"
              className="inline-flex h-10 items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-4 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/15"
            >
              Open VAT monitor
            </Link>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Recorded expenses"
            value={String(summary.expenseCount)}
            tone="from-cyan-400/18 via-cyan-400/6 to-transparent"
          />
          <MetricCard
            label="Current month gross"
            value={formatMoney(currentMonthSummary.totalGrossCents)}
            tone="from-emerald-400/18 via-emerald-400/6 to-transparent"
          />
          <MetricCard
            label="Recurring / month"
            value={formatMoney(recurringSummary.projectedMonthlyGrossCents)}
            tone="from-violet-400/18 via-violet-400/6 to-transparent"
          />
          <MetricCard
            label="Deductible input VAT"
            value={formatMoney(currentMonthSummary.deductibleInputVatCents)}
            tone="from-amber-400/18 via-amber-400/6 to-transparent"
          />
          <MetricCard
            label="VAT deadline"
            value={`${deadline.daysUntilDue} days`}
            footnote={new Date(deadline.dueDate).toLocaleDateString("de-DE")}
            tone={DEADLINE_TONES[deadline.statusLabel].glow}
          />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Visual Readiness
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">Bookkeeping health</h2>
              </div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${DEADLINE_TONES[deadline.statusLabel].soft}`}
              >
                {deadline.statusLabel}
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <ProgressStat
                label="Ready records"
                value={`${currentMonthSummary.readyCount}/${currentMonthSummary.expenseCount || 0}`}
                percentage={readyRate}
                tone="bg-emerald-300"
              />
              <ProgressStat
                label="Verified"
                value={`${currentMonthSummary.verifiedCount}/${currentMonthSummary.expenseCount || 0}`}
                percentage={verifiedRate}
                tone="bg-cyan-300"
              />
              <ProgressStat
                label="Deductible"
                value={`${currentMonthSummary.deductibleExpenseCount}/${currentMonthSummary.expenseCount || 0}`}
                percentage={deductibleRate}
                tone="bg-amber-300"
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Cost Mix
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Top current-month categories</h2>
            <div className="mt-5 space-y-3">
              {topCategoryRows.length === 0 ? (
                <EmptyState copy="No category distribution available yet." />
              ) : (
                topCategoryRows.map((row) => (
                  <ShareRow
                    key={row.category}
                    label={formatExpenseCategoryLabel(row.category as ExpenseCategory)}
                    value={formatMoney(row.grossAmount)}
                    percentage={row.share}
                    tone={getCategoryTone(row.category as ExpenseCategory).bar}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {migrationRequired ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Expense storage is not available in this database yet. Apply the pending Prisma
          migration before creating, editing, or exporting expense records.
        </div>
      ) : null}

      {(error || notice) ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-red-500/20 bg-red-500/10 text-red-200"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || notice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          eyebrow="Readiness"
          title="Current month completeness"
          description="Use these counts to determine whether the VAT layer is safe for bookkeeping handover."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric
              label="Missing documents"
              value={String(currentMonthSummary.missingDocumentCount)}
              tone="text-rose-200"
              bar="bg-rose-300"
            />
            <MiniMetric
              label="Missing VAT amounts"
              value={String(currentMonthSummary.missingVatCount)}
              tone="text-amber-200"
              bar="bg-amber-300"
            />
            <MiniMetric
              label="Missing suppliers"
              value={String(currentMonthSummary.missingSupplierCount)}
              tone="text-cyan-200"
              bar="bg-cyan-300"
            />
            <MiniMetric
              label="Verified expenses"
              value={String(currentMonthSummary.verifiedCount)}
              tone="text-emerald-200"
              bar="bg-emerald-300"
            />
            <MiniMetric
              label="Invoice complete"
              value={String(currentMonthSummary.invoiceCompleteCount)}
              tone="text-cyan-200"
              bar="bg-cyan-300"
            />
            <MiniMetric
              label="Review required"
              value={String(currentMonthSummary.reviewRequiredCount)}
              tone="text-amber-200"
              bar="bg-amber-300"
            />
            <MiniMetric
              label="Blocked"
              value={String(currentMonthSummary.blockedCount)}
              tone="text-rose-200"
              bar="bg-rose-300"
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SignalPill
              label="Docs blocker"
              value={String(currentMonthSummary.missingDocumentCount)}
              tone="border-rose-400/15 bg-rose-400/8 text-rose-100"
            />
            <SignalPill
              label="VAT blocker"
              value={String(currentMonthSummary.missingVatCount)}
              tone="border-amber-400/15 bg-amber-400/8 text-amber-100"
            />
            <SignalPill
              label="Supplier blocker"
              value={String(currentMonthSummary.missingSupplierCount)}
              tone="border-cyan-400/15 bg-cyan-400/8 text-cyan-100"
            />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
              Deductible input VAT only counts from expense records marked deductible.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
              The current export is a bookkeeping handover file, not an official filing artifact.
            </div>
          </div>
        </Panel>

        <Panel
          eyebrow="Create"
          title="New expense"
          description="Enter net and VAT rate, then let the gross total and VAT amount resolve automatically before the record is stored."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <input
                value={newExpense.title}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="DHL shipping invoice March"
                className={inputClass}
              />
            </Field>
            <Field label="Supplier">
              <select
                value={newExpense.supplierId}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, supplierId: event.target.value }))
                }
                className={inputClass}
              >
                <option value="">Unlinked / internal</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                value={newExpense.category}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    category: event.target.value as ExpenseCategory,
                  }))
                }
                className={inputClass}
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {formatExpenseCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Document status">
              <select
                value={newExpense.documentStatus}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    documentStatus: event.target.value as ExpenseDocumentStatus,
                  }))
                }
                className={inputClass}
              >
                {EXPENSE_DOCUMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatExpenseDocumentStatusLabel(status)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rechnungsaussteller">
              <input
                value={newExpense.invoiceIssuerName}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    invoiceIssuerName: event.target.value,
                  }))
                }
                placeholder="DHL Freight GmbH"
                className={inputClass}
              />
            </Field>
            <Field label="Rechnungsnummer">
              <input
                value={newExpense.invoiceNumber}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    invoiceNumber: event.target.value,
                  }))
                }
                placeholder="RG-2026-0412"
                className={inputClass}
              />
            </Field>
            <Field label="Leistungsbeschreibung" className="md:col-span-2">
              <input
                value={newExpense.invoiceDescription}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    invoiceDescription: event.target.value,
                  }))
                }
                placeholder="Versandkosten März 2026"
                className={inputClass}
              />
            </Field>
            <Field label="Lieferantenland">
              <input
                value={newExpense.supplierCountry}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    supplierCountry: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="DE"
                maxLength={2}
                className={inputClass}
              />
            </Field>
            <Field label="Steuerregime">
              <select
                value={newExpense.taxRegime}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    taxRegime: event.target.value as ExpenseFormState["taxRegime"],
                  }))
                }
                className={inputClass}
              >
                <option value="">Automatisch</option>
                <option value="NORMAL">Normal</option>
                <option value="KLEINUNTERNEHMER">Kleinunternehmer</option>
                <option value="MANUAL_REVIEW">Manuelle Prüfung</option>
              </select>
            </Field>
            <Field label="Net amount">
              <input
                value={newExpense.netAmount}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, netAmount: event.target.value }))
                }
                placeholder="100.00"
                className={inputClass}
              />
            </Field>
            <Field label="VAT rate (%)">
              <input
                value={newExpense.vatRateBasisPoints}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    vatRateBasisPoints: event.target.value,
                  }))
                }
                placeholder="19"
                className={inputClass}
              />
            </Field>
            <Field label="VAT amount">
              <input
                value={getDerivedNetFields(newExpense.netAmount, newExpense.vatRateBasisPoints).vatAmount}
                readOnly
                className={derivedInputClass}
              />
            </Field>
            <Field label="Gross amount (auto)">
              <input
                value={getDerivedNetFields(newExpense.netAmount, newExpense.vatRateBasisPoints).grossAmount}
                readOnly
                className={derivedInputClass}
              />
            </Field>
            <Field label="Document date">
              <input
                type="date"
                value={newExpense.documentDate}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, documentDate: event.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Paid at">
              <input
                type="date"
                value={newExpense.paidAt}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, paidAt: event.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <textarea
                value={newExpense.notes}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
                placeholder="Invoice number, channel, month-close note..."
                className={`${inputClass} min-h-[96px] py-3`}
              />
            </Field>
            <Field label="Reverse-Charge-Hinweis" className="md:col-span-2">
              <input
                value={newExpense.reverseChargeReference}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    reverseChargeReference: event.target.value,
                  }))
                }
                placeholder="§ 13b UStG / Reverse-Charge"
                className={inputClass}
              />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={newExpense.isDeductible}
              onChange={(event) =>
                setNewExpense((current) => ({
                  ...current,
                  isDeductible: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-white/20 bg-white/[0.03]"
            />
            Deductible for input VAT
          </label>
          <label className="mt-3 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={newExpense.isSmallBusinessSupplier}
              onChange={(event) =>
                setNewExpense((current) => ({
                  ...current,
                  isSmallBusinessSupplier: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-white/20 bg-white/[0.03]"
            />
            Lieferant ist Kleinunternehmer
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void createExpense()}
              disabled={migrationRequired}
              className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#05070a]"
            >
              Create expense
            </button>
            <button
              type="button"
              onClick={() => setNewExpense(emptyForm())}
              className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
            >
              Reset
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel
          eyebrow="Recurring"
          title="Recurring cost planner"
          description="Track monthly, quarterly, and yearly operating costs separately from booked expense records."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Active recurring costs" value={String(recurringSummary.activeCount)} />
            <MiniMetric label="Due this month" value={String(recurringSummary.dueThisMonthCount)} />
            <MiniMetric
              label="Due in next 30 days"
              value={String(recurringSummary.dueNext30DaysCount)}
            />
            <MiniMetric
              label="Projected VAT / month"
              value={formatMoney(recurringSummary.projectedMonthlyVatCents)}
              tone="text-violet-200"
              bar="bg-violet-300"
            />
          </div>
          <div className="mt-4">
            <ProgressStat
              label="Active planner coverage"
              value={`${recurringSummary.activeCount} active / ${recurringSummary.inactiveCount} inactive`}
              percentage={recurringActiveRate}
              tone="bg-violet-300"
            />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
              Recurring costs are planning records. They do not replace booked expense entries or
              VAT evidence.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
              Use next due dates to keep rent, software, and fixed overhead visible before the
              invoice is booked.
            </div>
          </div>
        </Panel>

        <Panel
          eyebrow="Create"
          title="New recurring cost"
          description="Enter the net amount once and keep the recurring gross total in sync automatically with the selected VAT rate."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <input
                value={newRecurringExpense.title}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Shop rent"
                className={inputClass}
              />
            </Field>
            <Field label="Supplier">
              <select
                value={newRecurringExpense.supplierId}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    supplierId: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">Unlinked / internal</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                value={newRecurringExpense.category}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    category: event.target.value as ExpenseCategory,
                  }))
                }
                className={inputClass}
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {formatExpenseCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Interval">
              <select
                value={newRecurringExpense.interval}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    interval: event.target.value as RecurringExpenseInterval,
                  }))
                }
                className={inputClass}
              >
                {RECURRING_EXPENSE_INTERVALS.map((interval) => (
                  <option key={interval} value={interval}>
                    {formatRecurringExpenseIntervalLabel(interval)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Net amount">
              <input
                value={newRecurringExpense.netAmount}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    netAmount: event.target.value,
                  }))
                }
                placeholder="100.00"
                className={inputClass}
              />
            </Field>
            <Field label="VAT rate (%)">
              <input
                value={newRecurringExpense.vatRateBasisPoints}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    vatRateBasisPoints: event.target.value,
                  }))
                }
                placeholder="19"
                className={inputClass}
              />
            </Field>
            <Field label="VAT amount">
              <input
                value={getDerivedNetFields(
                  newRecurringExpense.netAmount,
                  newRecurringExpense.vatRateBasisPoints,
                ).vatAmount}
                readOnly
                className={derivedInputClass}
              />
            </Field>
            <Field label="Gross amount (auto)">
              <input
                value={getDerivedNetFields(
                  newRecurringExpense.netAmount,
                  newRecurringExpense.vatRateBasisPoints,
                ).grossAmount}
                readOnly
                className={derivedInputClass}
              />
            </Field>
            <Field label="Next due date">
              <input
                type="date"
                value={newRecurringExpense.nextDueDate}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    nextDueDate: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Status">
              <select
                value={newRecurringExpense.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    isActive: event.target.value === "active",
                  }))
                }
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <textarea
                value={newRecurringExpense.notes}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
                placeholder="Lease, tool subscription, insurance note..."
                className={`${inputClass} min-h-[96px] py-3`}
              />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={newRecurringExpense.isDeductible}
              onChange={(event) =>
                setNewRecurringExpense((current) => ({
                  ...current,
                  isDeductible: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-white/20 bg-white/[0.03]"
            />
            Deductible for input VAT
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void createRecurringExpense()}
              disabled={migrationRequired}
              className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#05070a]"
            >
              Create recurring cost
            </button>
            <button
              type="button"
              onClick={() => setNewRecurringExpense(emptyRecurringForm())}
              className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
            >
              Reset
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel
          eyebrow="By Category"
          title="Current month expense mix"
          description="This gives finance and VAT pages a cleaner way to reason about operating cost composition."
        >
          <div className="space-y-3">
            {expenseByCategory.length === 0 ? (
              <EmptyState copy="No expense records in the current month." />
            ) : (
              expenseByCategory.map((row) => (
                <div
                  key={row.category}
                  className={`rounded-2xl border bg-gradient-to-r px-4 py-3 ${getCategoryTone(row.category as ExpenseCategory).soft} ${getCategoryTone(row.category as ExpenseCategory).glow}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {formatExpenseCategoryLabel(row.category as ExpenseCategory)}
                      </div>
                      <div className="text-xs text-slate-500">{row.count} record(s)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-cyan-300">
                        {formatMoney(row.grossAmount)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatMoney(row.vatAmount)} VAT
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/8">
                    <div
                      className={`h-2 rounded-full ${getCategoryTone(row.category as ExpenseCategory).bar}`}
                      style={{ width: `${calculateShare(row.grossAmount, currentMonthGrossTotal)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Directory"
          title="Expense records"
          description="Browse recorded costs as readable cards first, then open an editor only for the entry you want to change."
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, supplier, category, notes..."
              className="h-10 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/30 focus:bg-white/[0.05] sm:min-w-[260px]"
            />
            <span className="text-xs text-slate-500">{filteredExpenses.length} expenses</span>
          </div>

          <div className="space-y-4">
            {filteredExpenses.length === 0 ? (
              <EmptyState copy="No expenses found for the current filter." />
            ) : (
              filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className={`rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,13,18,0.96),rgba(7,10,15,0.98))] p-4`}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{expense.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                        <span
                          className={`rounded-full px-2.5 py-1 ${getCategoryTone(expense.category).badge}`}
                        >
                          {formatExpenseCategoryLabel(expense.category)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 ${getDocumentStatusTone(expense.documentStatus).badge}`}
                        >
                          {formatExpenseDocumentStatusLabel(expense.documentStatus)}
                        </span>
                        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                          {formatMoney(expense.grossAmount)}
                        </span>
                        <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-200">
                          {formatTaxReviewStatusLabel(expense.taxReviewStatus)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Updated {new Date(expense.updatedAt).toLocaleDateString("de-DE")}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <RecordMeta label="Supplier" value={expense.supplierName ?? "Unlinked / internal"} />
                    <RecordMeta
                      label="Document date"
                      value={new Date(expense.documentDate).toLocaleDateString("de-DE")}
                    />
                    <RecordMeta
                      label="Paid at"
                      value={
                        expense.paidAt
                          ? new Date(expense.paidAt).toLocaleDateString("de-DE")
                          : "Not marked"
                      }
                    />
                    <RecordMeta
                      label="VAT rate"
                      value={`${
                        formatVatRateBasisPointsAsPercentInput(
                          expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                        ) || "0"
                      }%`}
                    />
                    <RecordMeta label="Net" value={formatMoney(expense.netAmount)} />
                    <RecordMeta label="VAT" value={formatMoney(expense.vatAmount)} />
                    <RecordMeta label="Deductible" value={expense.isDeductible ? "Yes" : "No"} />
                    <RecordMeta label="USt-Satz" value={formatGermanVatRateLabel(expense.germanVatRate)} />
                    <RecordMeta
                      label="Steuerlogik"
                      value={formatTaxClassificationLabel(expense.taxClassification)}
                    />
                    <RecordMeta
                      label="Rechnungsstatus"
                      value={formatInvoiceValidationStatus(expense.invoiceValidationStatus)}
                    />
                    <RecordMeta
                      label="Vorsteuer"
                      value={formatInputVatEligibilityLabel(expense.inputVatEligibility)}
                    />
                    <RecordMeta
                      label="Created"
                      value={new Date(expense.createdAt).toLocaleDateString("de-DE")}
                    />
                  </div>

                  {expense.manualReviewReason ? (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                      {expense.manualReviewReason}
                    </div>
                  ) : null}

                  {expense.notes ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                      {expense.notes}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        editingExpenseId === expense.id
                          ? void cancelExpenseEditing()
                          : setEditingExpenseId(expense.id)
                      }
                      className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
                    >
                      {editingExpenseId === expense.id ? "Cancel editing" : "Edit expense"}
                    </button>
                  </div>

                  {editingExpenseId === expense.id ? (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Title">
                          <input
                            value={expense.title}
                            onChange={(event) =>
                              updateExpenseField(expense.id, "title", event.target.value)
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Supplier">
                          <select
                            value={expense.supplierId ?? ""}
                            onChange={(event) => {
                              const supplier = suppliers.find((item) => item.id === event.target.value);
                              updateExpenseField(expense.id, "supplierId", event.target.value || null);
                              updateExpenseField(expense.id, "supplierName", supplier?.name ?? null);
                            }}
                            className={inputClass}
                          >
                            <option value="">Unlinked / internal</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Category">
                          <select
                            value={expense.category}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "category",
                                event.target.value as ExpenseCategory,
                              )
                            }
                            className={inputClass}
                          >
                            {EXPENSE_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {formatExpenseCategoryLabel(category)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Document status">
                          <select
                            value={expense.documentStatus}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "documentStatus",
                                event.target.value as ExpenseDocumentStatus,
                              )
                            }
                            className={inputClass}
                          >
                            {EXPENSE_DOCUMENT_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {formatExpenseDocumentStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Rechnungsaussteller">
                          <input
                            value={expense.invoiceIssuerName ?? ""}
                            onChange={(event) =>
                              updateExpenseField(expense.id, "invoiceIssuerName", event.target.value)
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Rechnungsnummer">
                          <input
                            value={expense.invoiceNumber ?? ""}
                            onChange={(event) =>
                              updateExpenseField(expense.id, "invoiceNumber", event.target.value)
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Leistungsbeschreibung" className="md:col-span-2">
                          <input
                            value={expense.invoiceDescription ?? ""}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "invoiceDescription",
                                event.target.value,
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Lieferantenland">
                          <input
                            value={expense.supplierCountry ?? ""}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "supplierCountry",
                                event.target.value.toUpperCase(),
                              )
                            }
                            maxLength={2}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Steuerregime">
                          <select
                            value={expense.taxRegime}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "taxRegime",
                                event.target.value as ExpenseRecord["taxRegime"],
                              )
                            }
                            className={inputClass}
                          >
                            <option value="NORMAL">Normal</option>
                            <option value="KLEINUNTERNEHMER">Kleinunternehmer</option>
                            <option value="MANUAL_REVIEW">Manuelle Prüfung</option>
                          </select>
                        </Field>
                        <Field label="Gross amount">
                          <input
                            value={toMoneyInput(expense.grossAmount)}
                            onChange={(event) => {
                              const parsed = parseMoneyInputToCents(event.target.value);
                              if (parsed !== null) {
                                updateExpenseField(expense.id, "grossAmount", parsed);
                              }
                            }}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Net amount">
                          <input
                            value={getDerivedGrossFields(
                              toMoneyInput(expense.grossAmount),
                              expenseVatRateInputs[expense.id] ??
                                formatVatRateBasisPointsAsPercentInput(
                                  expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                                ),
                            ).netAmount}
                            readOnly
                            className={derivedInputClass}
                          />
                        </Field>
                        <Field label="VAT amount">
                          <input
                            value={getDerivedGrossFields(
                              toMoneyInput(expense.grossAmount),
                              expenseVatRateInputs[expense.id] ??
                                formatVatRateBasisPointsAsPercentInput(
                                  expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                                ),
                            ).vatAmount}
                            readOnly
                            className={derivedInputClass}
                          />
                        </Field>
                        <Field label="VAT rate (%)">
                          <input
                            value={
                              expenseVatRateInputs[expense.id] ??
                              formatVatRateBasisPointsAsPercentInput(
                                expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                              )
                            }
                            onChange={(event) => {
                              setExpenseVatRateInputs((current) => ({
                                ...current,
                                [expense.id]: event.target.value,
                              }));
                              const parsed = parseVatRatePercentInputToBasisPoints(event.target.value);
                              if (parsed !== null) {
                                updateExpenseField(expense.id, "vatRateBasisPoints", parsed);
                              }
                            }}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Document date">
                          <input
                            type="date"
                            value={toDateInput(expense.documentDate)}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "documentDate",
                                new Date(`${event.target.value}T00:00:00.000Z`).toISOString(),
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Paid at">
                          <input
                            type="date"
                            value={toDateInput(expense.paidAt)}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "paidAt",
                                event.target.value
                                  ? new Date(`${event.target.value}T00:00:00.000Z`).toISOString()
                                  : null,
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Notes" className="md:col-span-2">
                          <textarea
                            value={expense.notes ?? ""}
                            onChange={(event) =>
                              updateExpenseField(expense.id, "notes", event.target.value)
                            }
                            rows={3}
                            className={`${inputClass} min-h-[96px] py-3`}
                          />
                        </Field>
                        <Field label="Reverse-Charge-Hinweis" className="md:col-span-2">
                          <input
                            value={expense.reverseChargeReference ?? ""}
                            onChange={(event) =>
                              updateExpenseField(
                                expense.id,
                                "reverseChargeReference",
                                event.target.value,
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                      </div>

                      <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={expense.isDeductible}
                          onChange={(event) =>
                            updateExpenseField(expense.id, "isDeductible", event.target.checked)
                          }
                          className="h-4 w-4 rounded border-white/20 bg-white/[0.03]"
                        />
                        Deductible for input VAT
                      </label>
                      <label className="mt-3 flex items-center gap-3 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={expense.isSmallBusinessSupplier}
                          onChange={(event) =>
                            updateExpenseField(
                              expense.id,
                              "isSmallBusinessSupplier",
                              event.target.checked,
                            )
                          }
                          className="h-4 w-4 rounded border-white/20 bg-white/[0.03]"
                        />
                        Lieferant ist Kleinunternehmer
                      </label>

                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void cancelExpenseEditing()}
                          className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateExpense(expense)}
                          disabled={savingId === expense.id || migrationRequired}
                          className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#05070a] disabled:opacity-60"
                        >
                          {savingId === expense.id ? "Saving..." : "Save expense"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Recurring Directory"
        title="Recurring cost records"
        description="Keep the recurring planner easy to scan, then open the editor only when a schedule or amount actually needs adjustment."
      >
        <div className="mb-4 text-xs text-slate-500">
          {filteredRecurringExpenses.length} recurring costs
        </div>
        <div className="space-y-4">
          {filteredRecurringExpenses.length === 0 ? (
            <EmptyState copy="No recurring costs found for the current filter." />
          ) : (
            filteredRecurringExpenses.map((expense) => (
              <div
                key={expense.id}
                className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,13,18,0.96),rgba(7,10,15,0.98))] p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{expense.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span
                        className={`rounded-full px-2.5 py-1 ${getCategoryTone(expense.category).badge}`}
                      >
                        {formatExpenseCategoryLabel(expense.category)}
                      </span>
                      <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-violet-300">
                        {formatRecurringExpenseIntervalLabel(expense.interval)}
                      </span>
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                        {formatMoney(expense.grossAmount)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 ${
                          expense.isActive
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-slate-400/10 text-slate-300"
                        }`}
                      >
                        {expense.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Next due {new Date(expense.nextDueDate).toLocaleDateString("de-DE")}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <RecordMeta label="Supplier" value={expense.supplierName ?? "Unlinked / internal"} />
                  <RecordMeta
                    label="Next due"
                    value={new Date(expense.nextDueDate).toLocaleDateString("de-DE")}
                  />
                  <RecordMeta
                    label="Monthly run-rate"
                    value={formatMoney(
                      getRecurringExpenseMonthlyAmountCents(expense.grossAmount, expense.interval),
                    )}
                  />
                  <RecordMeta
                    label="VAT rate"
                    value={`${
                      formatVatRateBasisPointsAsPercentInput(
                        expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                      ) || "0"
                    }%`}
                  />
                  <RecordMeta label="Net" value={formatMoney(expense.netAmount)} />
                  <RecordMeta label="VAT" value={formatMoney(expense.vatAmount)} />
                  <RecordMeta label="Deductible" value={expense.isDeductible ? "Yes" : "No"} />
                  <RecordMeta label="Status" value={expense.isActive ? "Active" : "Inactive"} />
                </div>

                {expense.notes ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                    {expense.notes}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      editingRecurringExpenseId === expense.id
                        ? void cancelRecurringExpenseEditing()
                        : setEditingRecurringExpenseId(expense.id)
                    }
                    className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
                  >
                    {editingRecurringExpenseId === expense.id
                      ? "Cancel editing"
                      : "Edit recurring cost"}
                  </button>
                </div>

                {editingRecurringExpenseId === expense.id ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Title">
                        <input
                          value={expense.title}
                          onChange={(event) =>
                            updateRecurringExpenseField(expense.id, "title", event.target.value)
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Supplier">
                        <select
                          value={expense.supplierId ?? ""}
                          onChange={(event) => {
                            const supplier = suppliers.find((item) => item.id === event.target.value);
                            updateRecurringExpenseField(
                              expense.id,
                              "supplierId",
                              event.target.value || null,
                            );
                            updateRecurringExpenseField(
                              expense.id,
                              "supplierName",
                              supplier?.name ?? null,
                            );
                          }}
                          className={inputClass}
                        >
                          <option value="">Unlinked / internal</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Category">
                        <select
                          value={expense.category}
                          onChange={(event) =>
                            updateRecurringExpenseField(
                              expense.id,
                              "category",
                              event.target.value as ExpenseCategory,
                            )
                          }
                          className={inputClass}
                        >
                          {EXPENSE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {formatExpenseCategoryLabel(category)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Interval">
                        <select
                          value={expense.interval}
                          onChange={(event) =>
                            updateRecurringExpenseField(
                              expense.id,
                              "interval",
                              event.target.value as RecurringExpenseInterval,
                            )
                          }
                          className={inputClass}
                        >
                          {RECURRING_EXPENSE_INTERVALS.map((interval) => (
                            <option key={interval} value={interval}>
                              {formatRecurringExpenseIntervalLabel(interval)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Gross amount">
                        <input
                          value={toMoneyInput(expense.grossAmount)}
                          onChange={(event) => {
                            const parsed = parseMoneyInputToCents(event.target.value);
                            if (parsed !== null) {
                              updateRecurringExpenseField(expense.id, "grossAmount", parsed);
                            }
                          }}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Net amount">
                        <input
                          value={getDerivedGrossFields(
                            toMoneyInput(expense.grossAmount),
                            recurringVatRateInputs[expense.id] ??
                              formatVatRateBasisPointsAsPercentInput(
                                expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                              ),
                          ).netAmount}
                          readOnly
                          className={derivedInputClass}
                        />
                      </Field>
                      <Field label="VAT amount">
                        <input
                          value={getDerivedGrossFields(
                            toMoneyInput(expense.grossAmount),
                            recurringVatRateInputs[expense.id] ??
                              formatVatRateBasisPointsAsPercentInput(
                                expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                              ),
                          ).vatAmount}
                          readOnly
                          className={derivedInputClass}
                        />
                      </Field>
                      <Field label="VAT rate (%)">
                        <input
                          value={
                            recurringVatRateInputs[expense.id] ??
                            formatVatRateBasisPointsAsPercentInput(
                              expense.vatRateBasisPoints ?? DEFAULT_VAT_RATE_BASIS_POINTS,
                            )
                          }
                          onChange={(event) => {
                            setRecurringVatRateInputs((current) => ({
                              ...current,
                              [expense.id]: event.target.value,
                            }));
                            const parsed = parseVatRatePercentInputToBasisPoints(event.target.value);
                            if (parsed !== null) {
                              updateRecurringExpenseField(expense.id, "vatRateBasisPoints", parsed);
                            }
                          }}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Next due date">
                        <input
                          type="date"
                          value={toDateInput(expense.nextDueDate)}
                          onChange={(event) =>
                            updateRecurringExpenseField(
                              expense.id,
                              "nextDueDate",
                              new Date(`${event.target.value}T00:00:00.000Z`).toISOString(),
                            )
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Status">
                        <select
                          value={expense.isActive ? "active" : "inactive"}
                          onChange={(event) =>
                            updateRecurringExpenseField(
                              expense.id,
                              "isActive",
                              event.target.value === "active",
                            )
                          }
                          className={inputClass}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </Field>
                      <Field label="Notes" className="md:col-span-2">
                        <textarea
                          value={expense.notes ?? ""}
                          onChange={(event) =>
                            updateRecurringExpenseField(expense.id, "notes", event.target.value)
                          }
                          rows={3}
                          className={`${inputClass} min-h-[96px] py-3`}
                        />
                      </Field>
                    </div>

                    <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={expense.isDeductible}
                        onChange={(event) =>
                          updateRecurringExpenseField(
                            expense.id,
                            "isDeductible",
                            event.target.checked,
                          )
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/[0.03]"
                      />
                      Deductible for input VAT
                    </label>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void cancelRecurringExpenseEditing()}
                        className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateRecurringExpense(expense)}
                        disabled={savingId === expense.id || migrationRequired}
                        className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#05070a] disabled:opacity-60"
                      >
                        {savingId === expense.id ? "Saving..." : "Save recurring cost"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  footnote,
  tone = "from-white/10 via-white/0 to-transparent",
}: {
  label: string;
  value: string;
  footnote?: string;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${tone} p-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {footnote ? <p className="mt-2 text-xs text-slate-500">{footnote}</p> : null}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone = "text-white",
  bar = "bg-white/60",
}: {
  label: string;
  value: string;
  tone?: string;
  bar?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-lg font-semibold ${tone}`}>{value}</div>
      <div className="mt-3 h-1.5 rounded-full bg-white/8">
        <div className={`h-1.5 w-full rounded-full ${bar}`} />
      </div>
    </div>
  );
}

function RecordMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function ProgressStat({
  label,
  value,
  percentage,
  tone,
}: {
  label: string;
  value: string;
  percentage: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </span>
        <span className="text-xs text-slate-400">{Math.round(percentage)}%</span>
      </div>
      <div className="mt-3 text-base font-semibold text-white">{value}</div>
      <div className="mt-3 h-2 rounded-full bg-white/8">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function ShareRow({
  label,
  value,
  percentage,
  tone,
}: {
  label: string;
  value: string;
  percentage: number;
  tone: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="text-xs text-slate-400">
          {value} · {Math.round(percentage)}%
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/8">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function SignalPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs font-semibold text-slate-400 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
      {copy}
    </div>
  );
}
