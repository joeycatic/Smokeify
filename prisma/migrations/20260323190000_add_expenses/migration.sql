-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('INVENTORY', 'SHIPPING', 'MARKETING', 'SOFTWARE', 'OPERATIONS', 'TAXES', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseDocumentStatus" AS ENUM ('MISSING', 'RECEIVED', 'VERIFIED');

-- CreateTable
CREATE TABLE "Expense" (
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
    "documentDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "documentStatus" "ExpenseDocumentStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");

-- CreateIndex
CREATE INDEX "Expense_documentDate_idx" ON "Expense"("documentDate");

-- CreateIndex
CREATE INDEX "Expense_paidAt_idx" ON "Expense"("paidAt");

-- CreateIndex
CREATE INDEX "Expense_category_documentDate_idx" ON "Expense"("category", "documentDate");

-- CreateIndex
CREATE INDEX "Expense_documentStatus_documentDate_idx" ON "Expense"("documentStatus", "documentDate");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
