-- CreateEnum
CREATE TYPE "RecurringExpenseInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "title" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "grossAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "vatRateBasisPoints" INTEGER,
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "interval" "RecurringExpenseInterval" NOT NULL DEFAULT 'MONTHLY',
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_supplierId_idx" ON "RecurringExpense"("supplierId");

-- CreateIndex
CREATE INDEX "RecurringExpense_nextDueDate_idx" ON "RecurringExpense"("nextDueDate");

-- CreateIndex
CREATE INDEX "RecurringExpense_isActive_nextDueDate_idx" ON "RecurringExpense"("isActive", "nextDueDate");

-- CreateIndex
CREATE INDEX "RecurringExpense_category_isActive_idx" ON "RecurringExpense"("category", "isActive");

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
