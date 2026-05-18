ALTER TABLE "InventoryAdjustment"
  ADD COLUMN "sourceReference" TEXT;

CREATE TABLE "ExpenseStorefrontAllocation" (
  "id" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "storefront" "Storefront" NOT NULL,
  "percent" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExpenseStorefrontAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringExpenseStorefrontAllocation" (
  "id" TEXT NOT NULL,
  "recurringExpenseId" TEXT NOT NULL,
  "storefront" "Storefront" NOT NULL,
  "percent" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecurringExpenseStorefrontAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseStorefrontAllocation_expenseId_storefront_key"
  ON "ExpenseStorefrontAllocation"("expenseId", "storefront");

CREATE INDEX "ExpenseStorefrontAllocation_storefront_expenseId_idx"
  ON "ExpenseStorefrontAllocation"("storefront", "expenseId");

CREATE UNIQUE INDEX "RecurringExpenseStorefrontAllocation_recurringExpenseId_storefront_key"
  ON "RecurringExpenseStorefrontAllocation"("recurringExpenseId", "storefront");

CREATE INDEX "RecurringExpenseStorefrontAllocation_storefront_recurringExpenseId_idx"
  ON "RecurringExpenseStorefrontAllocation"("storefront", "recurringExpenseId");

CREATE INDEX "InventoryAdjustment_sourceType_createdAt_idx"
  ON "InventoryAdjustment"("sourceType", "createdAt");

ALTER TABLE "ExpenseStorefrontAllocation"
  ADD CONSTRAINT "ExpenseStorefrontAllocation_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringExpenseStorefrontAllocation"
  ADD CONSTRAINT "RecurringExpenseStorefrontAllocation_recurringExpenseId_fkey"
  FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
