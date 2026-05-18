export const formatStoreCredit = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Math.max(0, amountCents) / 100);

export const buildStoreCreditHoldReason = (sessionId: string) =>
  `store_credit_hold:${sessionId}`;

export const buildStoreCreditRedeemedReason = (sessionId: string) =>
  `store_credit_redeemed:${sessionId}`;

export const buildStoreCreditReleasedReason = (sessionId: string) =>
  `store_credit_released:${sessionId}`;

export const buildReturnStoreCreditReason = (returnRequestId: string) =>
  `return_store_credit:${returnRequestId}`;
