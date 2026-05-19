CREATE TYPE "CheckoutRecoveryAttemptStatus" AS ENUM (
  'PENDING',
  'SENT',
  'SKIPPED',
  'FAILED'
);

ALTER TABLE "Order"
ADD COLUMN "recoveredFromCheckoutSessionId" TEXT;

CREATE TABLE "CheckoutRecoverySession" (
  "id" TEXT NOT NULL,
  "stripeSessionId" TEXT NOT NULL,
  "userId" TEXT,
  "customerEmail" TEXT,
  "customerFirstName" TEXT,
  "customerLastName" TEXT,
  "sourceStorefront" "Storefront",
  "sourceHost" TEXT,
  "sourceOrigin" TEXT,
  "isGuest" BOOLEAN NOT NULL DEFAULT false,
  "consentGranted" BOOLEAN NOT NULL DEFAULT false,
  "consentCapturedAt" TIMESTAMP(3),
  "cartItems" JSONB NOT NULL,
  "currency" TEXT NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "shippingCents" INTEGER NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "cartLineCount" INTEGER NOT NULL DEFAULT 0,
  "discountCode" TEXT,
  "shippingCountry" TEXT,
  "metadata" JSONB,
  "suppressedAt" TIMESTAMP(3),
  "suppressionReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutRecoverySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckoutRecoveryAttempt" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "CheckoutRecoveryAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "skipReason" TEXT,
  "errorMessage" TEXT,
  "promoCode" TEXT,
  "promoMessage" TEXT,
  "deliveryMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutRecoveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_recoveredFromCheckoutSessionId_key" ON "Order"("recoveredFromCheckoutSessionId");
CREATE UNIQUE INDEX "CheckoutRecoverySession_stripeSessionId_key" ON "CheckoutRecoverySession"("stripeSessionId");
CREATE INDEX "CheckoutRecoverySession_consentGranted_createdAt_idx" ON "CheckoutRecoverySession"("consentGranted", "createdAt");
CREATE INDEX "CheckoutRecoverySession_completedAt_createdAt_idx" ON "CheckoutRecoverySession"("completedAt", "createdAt");
CREATE INDEX "CheckoutRecoverySession_sourceStorefront_createdAt_idx" ON "CheckoutRecoverySession"("sourceStorefront", "createdAt");
CREATE INDEX "CheckoutRecoverySession_customerEmail_createdAt_idx" ON "CheckoutRecoverySession"("customerEmail", "createdAt");
CREATE UNIQUE INDEX "CheckoutRecoveryAttempt_sessionId_stepIndex_key" ON "CheckoutRecoveryAttempt"("sessionId", "stepIndex");
CREATE INDEX "CheckoutRecoveryAttempt_status_scheduledFor_idx" ON "CheckoutRecoveryAttempt"("status", "scheduledFor");
CREATE INDEX "CheckoutRecoveryAttempt_sessionId_createdAt_idx" ON "CheckoutRecoveryAttempt"("sessionId", "createdAt");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_recoveredFromCheckoutSessionId_fkey"
FOREIGN KEY ("recoveredFromCheckoutSessionId") REFERENCES "CheckoutRecoverySession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CheckoutRecoverySession"
ADD CONSTRAINT "CheckoutRecoverySession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CheckoutRecoveryAttempt"
ADD CONSTRAINT "CheckoutRecoveryAttempt_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "CheckoutRecoverySession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
