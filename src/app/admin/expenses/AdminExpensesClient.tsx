"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_DOCUMENT_STATUSES,
  RECURRING_EXPENSE_INTERVALS,
  formatExpenseCategoryLabel,
  formatExpenseDocumentStatusLabel,
  formatRecurringExpenseIntervalLabel,
  getRecurringExpenseMonthlyAmountCents,
  type ExpenseCategory,
  type ExpenseDocumentStatus,
  type RecurringExpenseInterval,
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
  currency: string;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  vatRateBasisPoints: number | null;
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

const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : "");

const emptyForm = (): ExpenseFormState => ({
  supplierId: "",
  title: "",
  category: "OPERATIONS",
  notes: "",
  grossAmount: "",
  netAmount: "",
  vatAmount: "",
  vatRateBasisPoints: "1900",
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
  vatRateBasisPoints: "1900",
  isDeductible: true,
  interval: "MONTHLY",
  nextDueDate: new Date().toISOString().slice(0, 10),
  isActive: true,
});

const buildPayload = (form: ExpenseFormState) => {
  const grossAmount = parseMoneyInputToCents(form.grossAmount);
  const netAmount = parseMoneyInputToCents(form.netAmount);
  const vatAmount = parseMoneyInputToCents(form.vatAmount);
  if (grossAmount === null || netAmount === null || vatAmount === null) {
    return { ok: false as const, error: "Gross, net and VAT amounts must be valid amounts." };
  }
  if (grossAmount !== netAmount + vatAmount) {
    return { ok: false as const, error: "Gross amount must equal net amount plus VAT amount." };
  }
  const vatRateBasisPoints = form.vatRateBasisPoints.trim()
    ? Number(form.vatRateBasisPoints.trim())
    : null;
  if (
    form.vatRateBasisPoints.trim() &&
    (!Number.isFinite(vatRateBasisPoints) || vatRateBasisPoints === null || vatRateBasisPoints < 0)
  ) {
    return { ok: false as const, error: "VAT rate must be a non-negative number." };
  }
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
      currency: "EUR",
      grossAmount,
      netAmount,
      vatAmount,
      vatRateBasisPoints,
      isDeductible: form.isDeductible,
      documentDate: form.documentDate,
      paidAt: form.paidAt || null,
      documentStatus: form.documentStatus,
    },
  };
};

const buildRecurringPayload = (form: RecurringExpenseFormState) => {
  const grossAmount = parseMoneyInputToCents(form.grossAmount);
  const netAmount = parseMoneyInputToCents(form.netAmount);
  const vatAmount = parseMoneyInputToCents(form.vatAmount);
  if (grossAmount === null || netAmount === null || vatAmount === null) {
    return { ok: false as const, error: "Gross, net and VAT amounts must be valid amounts." };
  }
  if (grossAmount !== netAmount + vatAmount) {
    return { ok: false as const, error: "Gross amount must equal net amount plus VAT amount." };
  }
  const vatRateBasisPoints = form.vatRateBasisPoints.trim()
    ? Number(form.vatRateBasisPoints.trim())
    : null;
  if (
    form.vatRateBasisPoints.trim() &&
    (!Number.isFinite(vatRateBasisPoints) || vatRateBasisPoints === null || vatRateBasisPoints < 0)
  ) {
    return { ok: false as const, error: "VAT rate must be a non-negative number." };
  }
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
  grossAmount: toMoneyInput(expense.grossAmount),
  netAmount: toMoneyInput(expense.netAmount),
  vatAmount: toMoneyInput(expense.vatAmount),
  vatRateBasisPoints: expense.vatRateBasisPoints ? String(expense.vatRateBasisPoints) : "",
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
  vatRateBasisPoints: expense.vatRateBasisPoints ? String(expense.vatRateBasisPoints) : "",
  isDeductible: expense.isDeductible,
  interval: expense.interval,
  nextDueDate: toDateInput(expense.nextDueDate),
  isActive: expense.isActive,
});

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
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500";

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

  const createExpense = async () => {
    setError("");
    setNotice("");
    const payload = buildPayload(newExpense);
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
    const payload = buildRecurringPayload(newRecurringExpense);
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
          <MetricCard label="Recorded expenses" value={String(summary.expenseCount)} />
          <MetricCard
            label="Current month gross"
            value={formatMoney(currentMonthSummary.totalGrossCents)}
          />
          <MetricCard
            label="Recurring / month"
            value={formatMoney(recurringSummary.projectedMonthlyGrossCents)}
          />
          <MetricCard
            label="Deductible input VAT"
            value={formatMoney(currentMonthSummary.deductibleInputVatCents)}
          />
          <MetricCard
            label="VAT deadline"
            value={`${deadline.daysUntilDue} days`}
            footnote={new Date(deadline.dueDate).toLocaleDateString("de-DE")}
          />
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
            <MiniMetric label="Missing documents" value={String(currentMonthSummary.missingDocumentCount)} />
            <MiniMetric label="Missing VAT amounts" value={String(currentMonthSummary.missingVatCount)} />
            <MiniMetric label="Missing suppliers" value={String(currentMonthSummary.missingSupplierCount)} />
            <MiniMetric label="Verified expenses" value={String(currentMonthSummary.verifiedCount)} />
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
          description="Capture gross, net and VAT explicitly so the tax layer stays auditable and predictable."
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
            <Field label="Gross amount">
              <input
                value={newExpense.grossAmount}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, grossAmount: event.target.value }))
                }
                placeholder="119.00"
                className={inputClass}
              />
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
            <Field label="VAT amount">
              <input
                value={newExpense.vatAmount}
                onChange={(event) =>
                  setNewExpense((current) => ({ ...current, vatAmount: event.target.value }))
                }
                placeholder="19.00"
                className={inputClass}
              />
            </Field>
            <Field label="VAT rate (bps)">
              <input
                value={newExpense.vatRateBasisPoints}
                onChange={(event) =>
                  setNewExpense((current) => ({
                    ...current,
                    vatRateBasisPoints: event.target.value,
                  }))
                }
                placeholder="1900"
                className={inputClass}
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
          description="Add fixed overhead like rent, software, subscriptions, or other scheduled operating costs."
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
            <Field label="Gross amount">
              <input
                value={newRecurringExpense.grossAmount}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    grossAmount: event.target.value,
                  }))
                }
                placeholder="119.00"
                className={inputClass}
              />
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
            <Field label="VAT amount">
              <input
                value={newRecurringExpense.vatAmount}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    vatAmount: event.target.value,
                  }))
                }
                placeholder="19.00"
                className={inputClass}
              />
            </Field>
            <Field label="VAT rate (bps)">
              <input
                value={newRecurringExpense.vatRateBasisPoints}
                onChange={(event) =>
                  setNewRecurringExpense((current) => ({
                    ...current,
                    vatRateBasisPoints: event.target.value,
                  }))
                }
                placeholder="1900"
                className={inputClass}
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
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
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
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Directory"
          title="Expense records"
          description="Search and update recorded expenses. Changes here flow directly into the VAT and finance add-on layers."
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, supplier, category, notes..."
              className="h-10 min-w-[260px] flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
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
                  className="rounded-[24px] border border-white/10 bg-[#090d12] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{expense.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                        <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-300">
                          {formatExpenseCategoryLabel(expense.category)}
                        </span>
                        <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-300">
                          {formatExpenseDocumentStatusLabel(expense.documentStatus)}
                        </span>
                        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                          {formatMoney(expense.grossAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Updated {new Date(expense.updatedAt).toLocaleDateString("de-DE")}
                    </div>
                  </div>

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
                          updateExpenseField(
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
                    <Field label="Gross amount">
                      <input
                        value={toMoneyInput(expense.grossAmount)}
                        onChange={(event) => {
                          const parsed = parseMoneyInputToCents(event.target.value);
                          if (parsed !== null) updateExpenseField(expense.id, "grossAmount", parsed);
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Net amount">
                      <input
                        value={toMoneyInput(expense.netAmount)}
                        onChange={(event) => {
                          const parsed = parseMoneyInputToCents(event.target.value);
                          if (parsed !== null) updateExpenseField(expense.id, "netAmount", parsed);
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="VAT amount">
                      <input
                        value={toMoneyInput(expense.vatAmount)}
                        onChange={(event) => {
                          const parsed = parseMoneyInputToCents(event.target.value);
                          if (parsed !== null) updateExpenseField(expense.id, "vatAmount", parsed);
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="VAT rate (bps)">
                      <input
                        value={expense.vatRateBasisPoints ?? ""}
                        onChange={(event) =>
                          updateExpenseField(
                            expense.id,
                            "vatRateBasisPoints",
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
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

                  <div className="mt-4 flex justify-end">
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
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Recurring Directory"
        title="Recurring cost records"
        description="Review and update the planned recurring cost base that sits alongside booked expenses."
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
                className="rounded-[24px] border border-white/10 bg-[#090d12] p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{expense.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-300">
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
                      value={toMoneyInput(expense.netAmount)}
                      onChange={(event) => {
                        const parsed = parseMoneyInputToCents(event.target.value);
                        if (parsed !== null) {
                          updateRecurringExpenseField(expense.id, "netAmount", parsed);
                        }
                      }}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="VAT amount">
                    <input
                      value={toMoneyInput(expense.vatAmount)}
                      onChange={(event) => {
                        const parsed = parseMoneyInputToCents(event.target.value);
                        if (parsed !== null) {
                          updateRecurringExpenseField(expense.id, "vatAmount", parsed);
                        }
                      }}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="VAT rate (bps)">
                    <input
                      value={expense.vatRateBasisPoints ?? ""}
                      onChange={(event) =>
                        updateRecurringExpenseField(
                          expense.id,
                          "vatRateBasisPoints",
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
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

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                  Monthly run-rate:{" "}
                  <span className="font-semibold text-white">
                    {formatMoney(
                      getRecurringExpenseMonthlyAmountCents(
                        expense.grossAmount,
                        expense.interval,
                      ),
                    )}
                  </span>
                </div>

                <div className="mt-4 flex justify-end">
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
}: {
  label: string;
  value: string;
  footnote?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {footnote ? <p className="mt-2 text-xs text-slate-500">{footnote}</p> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
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
