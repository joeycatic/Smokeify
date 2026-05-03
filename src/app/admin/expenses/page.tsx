import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getExpensesPageData } from "@/lib/adminAddonData";
import AdminExpensesClient from "./AdminExpensesClient";

export default async function AdminExpensesPage() {
  if (!(await requireAdminScope("tax.review"))) notFound();

  const data = await getExpensesPageData(120);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminExpensesClient
        initialSuppliers={data.suppliers}
        initialSummary={data.summary}
        initialRecurringSummary={data.recurringSummary}
        initialCurrentMonthSummary={data.currentMonthSummary}
        initialExpenseByCategory={data.expenseByCategory}
        initialMigrationRequired={data.expenseMigrationRequired}
        initialDeadline={{
          dueDate: data.deadline.dueDate.toISOString(),
          daysUntilDue: data.deadline.daysUntilDue,
          statusLabel: data.deadline.statusLabel,
        }}
        initialExpenses={data.expenses.map((expense) => ({
          id: expense.id,
          supplierId: expense.supplierId,
          supplierName: expense.supplier?.name ?? null,
          title: expense.title,
          category: expense.category,
          notes: expense.notes,
          invoiceIssuerName: expense.invoiceIssuerName,
          invoiceNumber: expense.invoiceNumber,
          invoiceDescription: expense.invoiceDescription,
          supplierCountry: expense.supplierCountry,
          reverseChargeReference: expense.reverseChargeReference,
          isSmallBusinessSupplier: expense.isSmallBusinessSupplier,
          currency: expense.currency,
          grossAmount: expense.grossAmount,
          netAmount: expense.netAmount,
          vatAmount: expense.vatAmount,
          vatRateBasisPoints: expense.vatRateBasisPoints,
          taxRegime: expense.taxRegime,
          germanVatRate: expense.germanVatRate,
          taxClassification: expense.taxClassification,
          invoiceValidationStatus: expense.invoiceValidationStatus,
          inputVatEligibility: expense.inputVatEligibility,
          taxReviewStatus: expense.taxReviewStatus,
          manualReviewReason: expense.manualReviewReason,
          isDeductible: expense.isDeductible,
          documentDate: expense.documentDate.toISOString(),
          paidAt: expense.paidAt ? expense.paidAt.toISOString() : null,
          documentStatus: expense.documentStatus,
          createdAt: expense.createdAt.toISOString(),
          updatedAt: expense.updatedAt.toISOString(),
        }))}
        initialRecurringExpenses={data.recurringExpenses.map((expense) => ({
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
        }))}
      />
    </div>
  );
}
