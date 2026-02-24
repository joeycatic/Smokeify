type CheckoutSessionLike = {
  id?: string | null;
  mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
};

export const CHECKOUT_RECOVERY_EVENT_PREFIX = "checkout_recovery:";

export const getCheckoutRecoveryEventId = (sessionId: string) =>
  `${CHECKOUT_RECOVERY_EVENT_PREFIX}${sessionId}`;

export const parseCheckoutRecoveryDelayMinutes = (raw?: string | null) => {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.floor(parsed);
};

export const parseCheckoutRecoveryBatchSize = (raw?: string | null) => {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(100, Math.floor(parsed));
};

export const isRecoverableCheckoutSession = (session: CheckoutSessionLike) => {
  return Boolean(
    session.id &&
      session.mode === "payment" &&
      session.status === "open" &&
      session.payment_status !== "paid"
  );
};

