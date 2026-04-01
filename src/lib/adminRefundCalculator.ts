export type RefundPreviewMode = "full" | "items";

export type RefundSelectionMap = Record<string, number> | undefined;

type RefundableOrderItem = {
  id: string;
  quantity: number;
  totalAmount: number;
};

type RefundableOrder = {
  amountTotal: number;
  amountRefunded: number;
  amountShipping: number;
  items: RefundableOrderItem[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getRemainingRefundableAmount = (order: RefundableOrder) =>
  Math.max(order.amountTotal - order.amountRefunded, 0);

export const calculateSelectedRefundAmount = (
  order: RefundableOrder,
  selection: RefundSelectionMap,
) =>
  order.items.reduce((sum, item) => {
    const selectedQty = selection?.[item.id] ?? 0;
    if (selectedQty <= 0 || item.quantity <= 0) return sum;
    const clampedQty = clamp(Math.floor(selectedQty), 0, item.quantity);
    if (clampedQty <= 0) return sum;
    return sum + Math.round((item.totalAmount * clampedQty) / item.quantity);
  }, 0);

export const getRefundPreviewAmount = (
  order: RefundableOrder,
  mode: RefundPreviewMode,
  selection: RefundSelectionMap,
  includeShipping: boolean,
) => {
  const remainingOrderAmount = getRemainingRefundableAmount(order);
  if (mode === "full") {
    const fullAmount = includeShipping
      ? order.amountTotal
      : Math.max(order.amountTotal - order.amountShipping, 0);
    return clamp(fullAmount - order.amountRefunded, 0, remainingOrderAmount);
  }

  const selectedAmount = calculateSelectedRefundAmount(order, selection);
  const withShipping = selectedAmount + (includeShipping ? order.amountShipping : 0);
  return clamp(withShipping, 0, remainingOrderAmount);
};
