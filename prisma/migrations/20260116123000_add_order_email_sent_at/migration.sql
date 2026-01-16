-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "confirmationEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "shippingEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "refundEmailSentAt" TIMESTAMP(3);
