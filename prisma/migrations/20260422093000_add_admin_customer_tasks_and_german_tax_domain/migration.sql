-- Create enums
CREATE TYPE "TaxRegime" AS ENUM ('NORMAL', 'KLEINUNTERNEHMER', 'MANUAL_REVIEW');
CREATE TYPE "GermanVatRate" AS ENUM ('VAT_19', 'VAT_7', 'VAT_0', 'EXEMPT', 'REVERSE_CHARGE', 'UNKNOWN');
CREATE TYPE "TaxClassification" AS ENUM ('DOMESTIC_STANDARD', 'DOMESTIC_REDUCED', 'DOMESTIC_ZERO', 'EXEMPT', 'KLEINUNTERNEHMER', 'REVERSE_CHARGE', 'INTRA_EU_MANUAL', 'EXPORT_MANUAL', 'UNKNOWN');
CREATE TYPE "InvoiceValidationStatus" AS ENUM ('ENTWURF', 'PRUEFUNG_ERFORDERLICH', 'VOLLSTAENDIG');
CREATE TYPE "InputVatEligibility" AS ENUM ('VORSTEUERFAEHIG', 'NICHT_VORSTEUERFAEHIG', 'TEILWEISE_VORSTEUERFAEHIG', 'MANUELLE_PRUEFUNG');
CREATE TYPE "TaxReviewStatus" AS ENUM ('ENTWURF', 'PRUEFUNG_ERFORDERLICH', 'BEREIT_ZUR_UEBERGABE', 'GESPERRT');
CREATE TYPE "AdminCustomerCohortStatus" AS ENUM ('ENTWURF', 'AKTIV', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN');
CREATE TYPE "AdminCustomerTaskStatus" AS ENUM ('OFFEN', 'IN_BEARBEITUNG', 'WIEDERVORLAGE', 'ERLEDIGT');
CREATE TYPE "AdminCustomerTaskPlaybook" AS ENUM ('RUECKGEWINNUNG', 'VIP_BETREUUNG', 'RETOUREN_RISIKO', 'MARGE_SCHUETZEN', 'MANUELL');

-- AlterTable
ALTER TABLE "Supplier"
ADD COLUMN "country" TEXT,
ADD COLUMN "vatId" TEXT;

ALTER TABLE "Expense"
ADD COLUMN "invoiceIssuerName" TEXT,
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "invoiceDescription" TEXT,
ADD COLUMN "supplierCountry" TEXT,
ADD COLUMN "reverseChargeReference" TEXT,
ADD COLUMN "isSmallBusinessSupplier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "taxRegime" "TaxRegime" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "germanVatRate" "GermanVatRate" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "taxClassification" "TaxClassification" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "invoiceValidationStatus" "InvoiceValidationStatus" NOT NULL DEFAULT 'ENTWURF',
ADD COLUMN "inputVatEligibility" "InputVatEligibility" NOT NULL DEFAULT 'MANUELLE_PRUEFUNG',
ADD COLUMN "taxReviewStatus" "TaxReviewStatus" NOT NULL DEFAULT 'ENTWURF',
ADD COLUMN "manualReviewReason" TEXT;

ALTER TABLE "Product"
ADD COLUMN "taxRegime" "TaxRegime" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "germanVatRate" "GermanVatRate" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "taxClassification" "TaxClassification" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "taxReviewStatus" "TaxReviewStatus" NOT NULL DEFAULT 'ENTWURF';

ALTER TABLE "Order"
ADD COLUMN "taxRegime" "TaxRegime" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "germanVatRate" "GermanVatRate" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "taxClassification" "TaxClassification" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "taxReviewStatus" "TaxReviewStatus" NOT NULL DEFAULT 'ENTWURF',
ADD COLUMN "taxSnapshot" JSONB;

ALTER TABLE "AdminCustomerCohort"
ADD COLUMN "status" "AdminCustomerCohortStatus" NOT NULL DEFAULT 'ENTWURF',
ADD COLUMN "assigneeUserId" TEXT,
ADD COLUMN "assigneeEmail" TEXT;

ALTER TABLE "PricingRecommendation"
ADD COLUMN "reviewNote" TEXT;

-- CreateTable
CREATE TABLE "AdminCustomerTask" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT,
    "sourceCohortId" TEXT,
    "status" "AdminCustomerTaskStatus" NOT NULL DEFAULT 'OFFEN',
    "playbook" "AdminCustomerTaskPlaybook" NOT NULL DEFAULT 'MANUELL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCustomerTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_taxReviewStatus_documentDate_idx" ON "Expense"("taxReviewStatus", "documentDate");
CREATE INDEX "Expense_invoiceValidationStatus_documentDate_idx" ON "Expense"("invoiceValidationStatus", "documentDate");
CREATE INDEX "Expense_inputVatEligibility_documentDate_idx" ON "Expense"("inputVatEligibility", "documentDate");
CREATE INDEX "AdminCustomerCohort_status_updatedAt_idx" ON "AdminCustomerCohort"("status", "updatedAt");
CREATE INDEX "AdminCustomerTask_customerId_status_updatedAt_idx" ON "AdminCustomerTask"("customerId", "status", "updatedAt");
CREATE INDEX "AdminCustomerTask_ownerId_status_dueAt_idx" ON "AdminCustomerTask"("ownerId", "status", "dueAt");
CREATE INDEX "AdminCustomerTask_sourceCohortId_idx" ON "AdminCustomerTask"("sourceCohortId");

-- AddForeignKey
ALTER TABLE "AdminCustomerTask" ADD CONSTRAINT "AdminCustomerTask_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminCustomerTask" ADD CONSTRAINT "AdminCustomerTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminCustomerTask" ADD CONSTRAINT "AdminCustomerTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
