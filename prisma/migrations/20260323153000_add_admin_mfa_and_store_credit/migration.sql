ALTER TABLE "User"
  ADD COLUMN "adminTotpSecretEncrypted" TEXT,
  ADD COLUMN "adminTotpPendingSecretEncrypted" TEXT,
  ADD COLUMN "adminTotpEnabledAt" TIMESTAMP(3),
  ADD COLUMN "storeCreditBalance" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "ReturnResolutionType" AS ENUM ('REFUND', 'STORE_CREDIT', 'EXCHANGE');

ALTER TABLE "ReturnRequest"
  ADD COLUMN "requestedResolution" "ReturnResolutionType" NOT NULL DEFAULT 'REFUND',
  ADD COLUMN "exchangePreference" TEXT,
  ADD COLUMN "storeCreditAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "storeCreditIssuedAt" TIMESTAMP(3);

CREATE TABLE "StoreCreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "returnRequestId" TEXT,
  "orderId" TEXT,
  "amountDelta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StoreCreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreCreditTransaction_userId_createdAt_idx"
  ON "StoreCreditTransaction"("userId", "createdAt");

CREATE INDEX "StoreCreditTransaction_returnRequestId_idx"
  ON "StoreCreditTransaction"("returnRequestId");

CREATE INDEX "StoreCreditTransaction_orderId_idx"
  ON "StoreCreditTransaction"("orderId");

ALTER TABLE "StoreCreditTransaction"
  ADD CONSTRAINT "StoreCreditTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreCreditTransaction"
  ADD CONSTRAINT "StoreCreditTransaction_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreCreditTransaction"
  ADD CONSTRAINT "StoreCreditTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
