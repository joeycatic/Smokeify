type PrismaLikeError = {
  code?: unknown;
  meta?: unknown;
  message?: unknown;
};

const ANALYTICS_STORAGE_IDENTIFIERS = ["AnalyticsEvent", "AnalyticsSession"];
const PROCESSED_WEBHOOK_STORAGE_IDENTIFIERS = ["ProcessedWebhookEvent"];
const ADMIN_AUDIT_STORAGE_IDENTIFIERS = ["AdminAuditLog"];
const ADMIN_JOB_RUN_STORAGE_IDENTIFIERS = ["AdminJobRun"];
const INVENTORY_STORAGE_IDENTIFIERS = ["InventoryAdjustment", "VariantInventory"];
const PROCUREMENT_STORAGE_IDENTIFIERS = [
  "PurchaseOrder",
  "PurchaseOrderItem",
  "PurchaseOrderReceipt",
  "PurchaseOrderReceiptItem",
  "PurchaseOrderEvent",
];

function readPrismaMetaString(error: PrismaLikeError, key: "table" | "column") {
  if (!error.meta || typeof error.meta !== "object" || !(key in error.meta)) {
    return null;
  }

  const value = (error.meta as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function matchesIdentifier(value: string | null, identifiers: string[]) {
  return Boolean(value && identifiers.some((identifier) => value.includes(identifier)));
}

function isMissingTableError(error: unknown, identifiers: string[]) {
  if (!error || typeof error !== "object") return false;

  const prismaError = error as PrismaLikeError;
  if (prismaError.code !== "P2021") return false;

  return matchesIdentifier(readPrismaMetaString(prismaError, "table"), identifiers);
}

function isMissingColumnError(error: unknown, identifiers: string[]) {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.includes("does not exist") &&
      identifiers.some((identifier) => message.includes(identifier))
    ) {
      return true;
    }
  }

  if (!error || typeof error !== "object") return false;

  const prismaError = error as PrismaLikeError;
  if (prismaError.code !== "P2022") return false;

  return matchesIdentifier(readPrismaMetaString(prismaError, "column"), identifiers);
}

function isMissingStorageError(error: unknown, identifiers: string[]) {
  return isMissingTableError(error, identifiers) || isMissingColumnError(error, identifiers);
}

export function isMissingAnalyticsStorageError(error: unknown) {
  return isMissingStorageError(error, ANALYTICS_STORAGE_IDENTIFIERS);
}

export function isMissingProcessedWebhookStorageError(error: unknown) {
  return isMissingStorageError(error, PROCESSED_WEBHOOK_STORAGE_IDENTIFIERS);
}

export function isMissingAdminAuditStorageError(error: unknown) {
  return isMissingStorageError(error, ADMIN_AUDIT_STORAGE_IDENTIFIERS);
}

export function isMissingAdminJobRunStorageError(error: unknown) {
  return isMissingStorageError(error, ADMIN_JOB_RUN_STORAGE_IDENTIFIERS);
}

export function isMissingInventoryStorageError(error: unknown) {
  return isMissingStorageError(error, INVENTORY_STORAGE_IDENTIFIERS);
}

export function isMissingProcurementStorageError(error: unknown) {
  return isMissingStorageError(error, PROCUREMENT_STORAGE_IDENTIFIERS);
}
