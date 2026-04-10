type AdminOrderPatchInput = {
  status?: string;
  paymentStatus?: string;
  trackingCarrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

type BuildAdminOrderPatchOptions = {
  currentStatus?: string | null;
};

type AdminOrderPatchResult = {
  updates: {
    status?: string;
    trackingCarrier?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
  };
  changedFields: string[];
};

const ALLOWED_ADMIN_ORDER_STATUSES = new Set([
  "processing",
  "shipped",
  "fulfilled",
  "canceled",
  "cancelled",
  "return_approved",
  "return_rejected",
]);

const normalizeOptionalString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export function buildAdminOrderPatch(
  input: AdminOrderPatchInput,
  options?: BuildAdminOrderPatchOptions,
): AdminOrderPatchResult {
  if (typeof input.paymentStatus !== "undefined") {
    throw new Error(
      "Payment status is managed by Stripe webhooks and refund flows.",
    );
  }

  const updates: AdminOrderPatchResult["updates"] = {};
  const changedFields: string[] = [];

  const normalizedStatus = normalizeOptionalString(input.status).toLowerCase();
  const normalizedCurrentStatus = normalizeOptionalString(
    options?.currentStatus,
  ).toLowerCase();
  if (normalizedStatus) {
    if (normalizedStatus === normalizedCurrentStatus) {
      return appendTrackingUpdates(input, updates, changedFields);
    }
    if (!ALLOWED_ADMIN_ORDER_STATUSES.has(normalizedStatus)) {
      throw new Error(
        "Only fulfillment and return statuses can be updated from the admin order editor.",
      );
    }
    updates.status = normalizedStatus;
    changedFields.push("status");
  }

  return appendTrackingUpdates(input, updates, changedFields);
}

function appendTrackingUpdates(
  input: AdminOrderPatchInput,
  updates: AdminOrderPatchResult["updates"],
  changedFields: string[],
) {
  if (typeof input.trackingCarrier !== "undefined") {
    updates.trackingCarrier = normalizeOptionalString(input.trackingCarrier) || null;
    changedFields.push("trackingCarrier");
  }
  if (typeof input.trackingNumber !== "undefined") {
    updates.trackingNumber = normalizeOptionalString(input.trackingNumber) || null;
    changedFields.push("trackingNumber");
  }
  if (typeof input.trackingUrl !== "undefined") {
    updates.trackingUrl = normalizeOptionalString(input.trackingUrl) || null;
    changedFields.push("trackingUrl");
  }

  return { updates, changedFields };
}
