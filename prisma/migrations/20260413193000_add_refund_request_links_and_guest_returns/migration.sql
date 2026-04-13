ALTER TABLE "Order"
ADD COLUMN "refundRequestEmailSentAt" TIMESTAMP(3);

ALTER TABLE "ReturnRequest"
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "ReturnRequest"
DROP CONSTRAINT "ReturnRequest_userId_fkey";

ALTER TABLE "ReturnRequest"
ADD CONSTRAINT "ReturnRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
