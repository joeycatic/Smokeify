export type PaymentFeeConfig = {
  percentBasisPoints: number;
  fixedCents: number;
};

export const PAYMENT_FEE_BY_METHOD: Record<string, PaymentFeeConfig> = {
  card: { percentBasisPoints: 150, fixedCents: 25 },
  link: { percentBasisPoints: 150, fixedCents: 25 },
  paypal: { percentBasisPoints: 299, fixedCents: 35 },
  klarna: { percentBasisPoints: 329, fixedCents: 35 },
  amazon_pay: { percentBasisPoints: 299, fixedCents: 35 },
};

export const DEFAULT_PAYMENT_FEE: PaymentFeeConfig = {
  percentBasisPoints: 150,
  fixedCents: 25,
};

export const HIGH_PRICE_SHIPPING_THRESHOLD_CENTS = 10_000;

export type CostSnapshotItem = {
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  baseCostAmount: number;
};

/**
 * Distributes `total` cents across items proportionally to their `weights`,
 * with integer rounding via largest-remainder method.
 */
export const allocateByWeight = (total: number, weights: number[]) => {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const positiveWeights = weights.map((w) => Math.max(0, w));
  const weightSum = positiveWeights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const allocations = positiveWeights.map((w) =>
    Math.floor((total * w) / weightSum)
  );
  let remainder = total - allocations.reduce((sum, v) => sum + v, 0);
  let index = 0;
  while (remainder > 0) {
    if (positiveWeights[index] > 0) {
      allocations[index] += 1;
      remainder -= 1;
    }
    index = (index + 1) % allocations.length;
  }
  return allocations;
};

export const applyPaymentFeesToCosts = (
  items: CostSnapshotItem[],
  shippingAmount: number,
  feeConfig: PaymentFeeConfig
) => {
  if (!items.length) {
    return [] as Array<
      CostSnapshotItem & { paymentFeeAmount: number; adjustedCostAmount: number }
    >;
  }

  const shippingEligibleWeights = items.map((item) =>
    item.unitAmount >= HIGH_PRICE_SHIPPING_THRESHOLD_CENTS ? item.totalAmount : 0
  );
  const shippingShares = allocateByWeight(
    Math.max(0, shippingAmount),
    shippingEligibleWeights
  );

  const percentageFees = items.map((item, index) => {
    const base = Math.max(0, item.totalAmount) + (shippingShares[index] ?? 0);
    return Math.max(
      0,
      Math.round((base * feeConfig.percentBasisPoints) / 10_000)
    );
  });

  const fixedShares = allocateByWeight(
    Math.max(0, feeConfig.fixedCents),
    items.map((item) => Math.max(0, item.totalAmount))
  );

  return items.map((item, index) => {
    const paymentFeeAmount =
      (percentageFees[index] ?? 0) + (fixedShares[index] ?? 0);
    const adjustedCostAmount = Math.max(0, item.baseCostAmount + paymentFeeAmount);
    return { ...item, paymentFeeAmount, adjustedCostAmount };
  });
};
