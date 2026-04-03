import type { AdminOrderRecord } from "@/lib/adminOrders";
import { formatOrderSourceLabel } from "@/lib/orderSource";

const ARCHIVED_STATUSES = new Set(["fulfilled", "refunded"]);
const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "refunded",
  "partially_refunded",
]);
const FAILED_PAYMENT_STATUSES = new Set(["failed", "canceled", "cancelled"]);
const CLOSED_ORDER_STATUSES = new Set([
  "fulfilled",
  "refunded",
  "canceled",
  "cancelled",
  "failed",
]);

export type OrderQueueTone = "attention" | "progress" | "settled" | "muted";

export function normalizeOrderStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function isArchivedOrder(order: Pick<AdminOrderRecord, "status">) {
  return ARCHIVED_STATUSES.has(normalizeOrderStatus(order.status));
}

export function isPaidOrder(order: Pick<AdminOrderRecord, "paymentStatus">) {
  return PAID_PAYMENT_STATUSES.has(normalizeOrderStatus(order.paymentStatus));
}

export function hasPaymentFailure(order: Pick<AdminOrderRecord, "paymentStatus">) {
  return FAILED_PAYMENT_STATUSES.has(normalizeOrderStatus(order.paymentStatus));
}

export function isReadyToFulfillOrder(
  order: Pick<AdminOrderRecord, "status" | "paymentStatus">,
) {
  return (
    isPaidOrder(order) &&
    !CLOSED_ORDER_STATUSES.has(normalizeOrderStatus(order.status))
  );
}

export function isAwaitingPaymentOrder(
  order: Pick<AdminOrderRecord, "status" | "paymentStatus">,
) {
  return !isArchivedOrder(order) && !isPaidOrder(order) && !hasPaymentFailure(order);
}

export function getOrderSourceDetail(
  order: Pick<AdminOrderRecord, "sourceStorefront" | "sourceHost" | "sourceOrigin">,
) {
  const label = formatOrderSourceLabel(
    order.sourceStorefront,
    order.sourceHost,
    order.sourceOrigin,
  );

  if (order.sourceHost && order.sourceHost !== label) {
    return `${label} · ${order.sourceHost}`;
  }

  if (order.sourceOrigin && order.sourceOrigin !== label) {
    return `${label} · ${order.sourceOrigin}`;
  }

  return label;
}

export function getOrderCustomerLabel(order: AdminOrderRecord) {
  return (
    order.user.name?.trim() ||
    order.shippingName?.trim() ||
    order.customerEmail?.trim() ||
    order.user.email?.trim() ||
    `Order #${order.orderNumber}`
  );
}

export function getOrderCustomerSecondary(order: AdminOrderRecord) {
  const primaryEmail =
    order.customerEmail?.trim() || order.user.email?.trim() || null;

  if (primaryEmail) return primaryEmail;

  const parts = [order.shippingPostalCode, order.shippingCity, order.shippingCountry]
    .map((value) => value?.trim())
    .filter(Boolean);

  return parts.length ? parts.join(" ") : null;
}

export function getOrderItemSummary(order: AdminOrderRecord) {
  if (order.items.length === 0) return "No line items";

  const [firstItem] = order.items;
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const extraCount = Math.max(order.items.length - 1, 0);

  return [
    `${quantity} item${quantity === 1 ? "" : "s"}`,
    firstItem?.name ? `${firstItem.name}${extraCount > 0 ? ` +${extraCount} more` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getOrderTrackingSummary(order: AdminOrderRecord) {
  if (order.trackingNumber) {
    return order.trackingCarrier
      ? `${order.trackingCarrier} · ${order.trackingNumber}`
      : order.trackingNumber;
  }

  if (normalizeOrderStatus(order.status) === "fulfilled") {
    return "Fulfilled";
  }

  return "Tracking missing";
}

export function getOrderQueueTone(order: AdminOrderRecord): OrderQueueTone {
  if (isArchivedOrder(order)) {
    return normalizeOrderStatus(order.status) === "fulfilled" ? "settled" : "muted";
  }

  if (hasPaymentFailure(order)) return "attention";
  if (isReadyToFulfillOrder(order) && !order.trackingNumber) return "attention";
  if (order.trackingNumber) return "progress";

  return "muted";
}

export function getOrderQueuePriority(order: AdminOrderRecord) {
  const tone = getOrderQueueTone(order);

  if (tone === "attention") return 0;
  if (tone === "progress") return 1;
  if (tone === "muted") return 2;
  return 3;
}

export function matchesOrderSearch(order: AdminOrderRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    order.id,
    String(order.orderNumber),
    `#${order.orderNumber}`,
    order.status,
    order.paymentStatus,
    order.paymentMethod,
    order.customerEmail,
    order.user.email,
    order.user.name,
    order.shippingName,
    order.trackingCarrier,
    order.trackingNumber,
    order.discountCode,
    order.shippingCity,
    order.shippingCountry,
    getOrderSourceDetail(order),
    ...order.items.map((item) => item.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}
