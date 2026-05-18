export const SUPPORTED_MANUAL_WEBHOOK_REPLAYS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.payment_failed",
  "checkout.session.expired",
  "charge.refunded",
]);

export function canReplayWebhookEvent(type: string) {
  return SUPPORTED_MANUAL_WEBHOOK_REPLAYS.has(type);
}
