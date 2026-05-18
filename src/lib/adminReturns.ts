export type AdminReturnResolution = "REFUND" | "STORE_CREDIT" | "EXCHANGE";

export function calculateReturnRequestAmountCents(
  items: Array<{ quantity: number; unitAmount: number }>
) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);
}

export function getReturnOrderStatus({
  requestStatus,
  requestedResolution,
}: {
  requestStatus: "APPROVED" | "REJECTED";
  requestedResolution: AdminReturnResolution;
}) {
  if (requestStatus === "REJECTED") {
    return "return_rejected";
  }

  if (requestedResolution === "EXCHANGE") {
    return "return_exchange_in_progress";
  }

  return "return_approved";
}
