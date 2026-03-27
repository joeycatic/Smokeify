ALTER TABLE "User"
  ADD COLUMN "adminAccessDisabledAt" TIMESTAMP(3),
  ADD COLUMN "adminAccessDisableReason" TEXT;
