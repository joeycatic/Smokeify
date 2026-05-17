CREATE TABLE "AdminSavedView" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "ownerEmail" TEXT,
  "route" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "storefrontScope" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminSavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminSavedView_ownerId_route_updatedAt_idx" ON "AdminSavedView"("ownerId", "route", "updatedAt");
CREATE INDEX "AdminSavedView_route_pinned_idx" ON "AdminSavedView"("route", "pinned");
