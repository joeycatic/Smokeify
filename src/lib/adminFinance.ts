import {
  calculateVatComponentsFromGross,
  canApplyDefaultVatFallback,
} from "@/lib/vat";

export const RECOGNIZED_PAYMENT_STATUSES = [
  "paid",
  "succeeded",
  "refunded",
  "partially_refunded",
] as const;

const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "refunded",
  "partially_refunded",
]);

export type AdminFinanceOrderItemInput = {
  quantity: number;
  totalAmount: number;
  baseCostAmount: number;
  paymentFeeAmount: number;
  adjustedCostAmount: number;
  taxAmount: number;
};

export type AdminFinanceOrderInput = {
  createdAt: Date;
  currency: string;
  shippingCountry?: string | null;
  paymentStatus: string;
  status: string;
  amountSubtotal: number;
  amountTax: number;
  amountShipping: number;
  amountDiscount: number;
  amountTotal: number;
  amountRefunded: number;
  items: AdminFinanceOrderItemInput[];
};

export type AdminOrderFinanceBreakdown = {
  recognized: boolean;
  grossOrderCents: number;
  refundedGrossCents: number;
  netCollectedGrossCents: number;
  outputVatCents: number;
  refundedVatEstimateCents: number;
  netOutputVatCents: number;
  netRevenueCents: number;
  shippingCollectedCents: number;
  cogsCents: number;
  paymentFeesCents: number;
  variableCostCents: number;
  contributionMarginCents: number;
  contributionMarginRatio: number;
  estimatedProfitCents: number;
  taxedItemCount: number;
};

export type AdminFinanceRollup = {
  currency: string;
  paidOrderCount: number;
  recognizedOrderCount: number;
  refundedOrderCount: number;
  grossRevenueCents: number;
  refundedGrossCents: number;
  netCollectedGrossCents: number;
  outputVatCents: number;
  refundedVatEstimateCents: number;
  netOutputVatCents: number;
  netRevenueCents: number;
  shippingCollectedCents: number;
  cogsCents: number;
  paymentFeesCents: number;
  variableCostCents: number;
  contributionMarginCents: number;
  contributionMarginRatio: number;
  estimatedProfitCents: number;
  ordersMissingTaxCount: number;
  taxCoverageRate: number;
};

export type AdminVatSummary = {
  monthLabel: string;
  accountingModeLabel: string;
  taxationModeLabel: string;
  outputVatCents: number;
  refundedVatEstimateCents: number;
  inputVatCents: number;
  estimatedLiabilityCents: number;
  taxCoverageRate: number;
  ordersMissingTaxCount: number;
  status: "estimated" | "review_required" | "ready_for_handover";
  blockers: string[];
  notes: string[];
};

type BuildVatSummaryOptions =
  | number
  | {
      inputVatCents?: number;
      expenseCount?: number;
      missingExpenseVatCount?: number;
      missingExpenseDocumentCount?: number;
      missingExpenseSupplierCount?: number;
    };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeStatus = (value: string) => value.trim().toLowerCase();

export const isRecognizedPaidOrder = (order: Pick<AdminFinanceOrderInput, "paymentStatus">) =>
  PAID_PAYMENT_STATUSES.has(normalizeStatus(order.paymentStatus));

const getRefundRatio = (grossAmount: number, refundedAmount: number) => {
  if (grossAmount <= 0 || refundedAmount <= 0) return 0;
  return clamp(refundedAmount / grossAmount, 0, 1);
};

export const buildOrderFinanceBreakdown = (
  order: AdminFinanceOrderInput,
): AdminOrderFinanceBreakdown => {
  const recognized = isRecognizedPaidOrder(order);
  const grossOrderCents = Math.max(order.amountTotal, 0);
  const shouldEstimateTaxFromGross =
    canApplyDefaultVatFallback(order.currency, order.shippingCountry) &&
    grossOrderCents > 0 &&
    Math.max(order.amountTax, 0) <= 0 &&
    order.items.every((item) => Math.max(item.taxAmount, 0) <= 0);
  const refundedGrossCents = clamp(order.amountRefunded, 0, grossOrderCents);
  const refundRatio = getRefundRatio(grossOrderCents, refundedGrossCents);
  const outputVatCents = shouldEstimateTaxFromGross
    ? calculateVatComponentsFromGross(grossOrderCents).vatAmount
    : Math.max(order.amountTax, 0);
  const refundedVatEstimateCents = Math.round(outputVatCents * refundRatio);
  const netOutputVatCents = Math.max(outputVatCents - refundedVatEstimateCents, 0);
  const netCollectedGrossCents = Math.max(grossOrderCents - refundedGrossCents, 0);
  const netRevenueCents = Math.max(netCollectedGrossCents - netOutputVatCents, 0);
  const shippingCollectedCents = Math.max(order.amountShipping, 0);

  const cogsCents = order.items.reduce(
    (sum, item) => sum + Math.max(item.baseCostAmount, 0),
    0,
  );
  const paymentFeesCents = order.items.reduce((sum, item) => {
    if (item.paymentFeeAmount > 0) return sum + item.paymentFeeAmount;
    const adjustedDelta = item.adjustedCostAmount - item.baseCostAmount;
    return sum + Math.max(adjustedDelta, 0);
  }, 0);
  const taxedItemCount = order.items.reduce(
    (sum, item) =>
      sum +
      ((shouldEstimateTaxFromGross
        ? calculateVatComponentsFromGross(Math.max(item.totalAmount, 0)).vatAmount
        : Math.max(item.taxAmount, 0)) > 0
        ? 1
        : 0),
    0,
  );

  const variableCostCents = cogsCents + paymentFeesCents;
  const contributionMarginCents = netRevenueCents - variableCostCents;
  const contributionMarginRatio =
    netRevenueCents > 0 ? contributionMarginCents / netRevenueCents : 0;

  return {
    recognized,
    grossOrderCents,
    refundedGrossCents,
    netCollectedGrossCents,
    outputVatCents,
    refundedVatEstimateCents,
    netOutputVatCents,
    netRevenueCents,
    shippingCollectedCents,
    cogsCents,
    paymentFeesCents,
    variableCostCents,
    contributionMarginCents,
    contributionMarginRatio,
    estimatedProfitCents: contributionMarginCents,
    taxedItemCount,
  };
};

export const buildFinanceRollup = (
  orders: AdminFinanceOrderInput[],
  currency = orders[0]?.currency ?? "EUR",
): AdminFinanceRollup => {
  const recognizedOrders = orders.filter(isRecognizedPaidOrder);
  const totals = recognizedOrders.reduce(
    (sum, order) => {
      const breakdown = buildOrderFinanceBreakdown(order);
      sum.paidOrderCount += 1;
      sum.refundedOrderCount += breakdown.refundedGrossCents > 0 ? 1 : 0;
      sum.grossRevenueCents += breakdown.grossOrderCents;
      sum.refundedGrossCents += breakdown.refundedGrossCents;
      sum.netCollectedGrossCents += breakdown.netCollectedGrossCents;
      sum.outputVatCents += breakdown.outputVatCents;
      sum.refundedVatEstimateCents += breakdown.refundedVatEstimateCents;
      sum.netOutputVatCents += breakdown.netOutputVatCents;
      sum.netRevenueCents += breakdown.netRevenueCents;
      sum.shippingCollectedCents += breakdown.shippingCollectedCents;
      sum.cogsCents += breakdown.cogsCents;
      sum.paymentFeesCents += breakdown.paymentFeesCents;
      sum.variableCostCents += breakdown.variableCostCents;
      sum.contributionMarginCents += breakdown.contributionMarginCents;
      sum.estimatedProfitCents += breakdown.estimatedProfitCents;
      if (breakdown.outputVatCents <= 0) {
        sum.ordersMissingTaxCount += 1;
      }
      return sum;
    },
    {
      paidOrderCount: 0,
      refundedOrderCount: 0,
      grossRevenueCents: 0,
      refundedGrossCents: 0,
      netCollectedGrossCents: 0,
      outputVatCents: 0,
      refundedVatEstimateCents: 0,
      netOutputVatCents: 0,
      netRevenueCents: 0,
      shippingCollectedCents: 0,
      cogsCents: 0,
      paymentFeesCents: 0,
      variableCostCents: 0,
      contributionMarginCents: 0,
      estimatedProfitCents: 0,
      ordersMissingTaxCount: 0,
    },
  );

  return {
    currency,
    paidOrderCount: totals.paidOrderCount,
    recognizedOrderCount: totals.paidOrderCount,
    refundedOrderCount: totals.refundedOrderCount,
    grossRevenueCents: totals.grossRevenueCents,
    refundedGrossCents: totals.refundedGrossCents,
    netCollectedGrossCents: totals.netCollectedGrossCents,
    outputVatCents: totals.outputVatCents,
    refundedVatEstimateCents: totals.refundedVatEstimateCents,
    netOutputVatCents: totals.netOutputVatCents,
    netRevenueCents: totals.netRevenueCents,
    shippingCollectedCents: totals.shippingCollectedCents,
    cogsCents: totals.cogsCents,
    paymentFeesCents: totals.paymentFeesCents,
    variableCostCents: totals.variableCostCents,
    contributionMarginCents: totals.contributionMarginCents,
    contributionMarginRatio:
      totals.netRevenueCents > 0
        ? totals.contributionMarginCents / totals.netRevenueCents
        : 0,
    estimatedProfitCents: totals.estimatedProfitCents,
    ordersMissingTaxCount: totals.ordersMissingTaxCount,
    taxCoverageRate:
      totals.paidOrderCount > 0
        ? (totals.paidOrderCount - totals.ordersMissingTaxCount) / totals.paidOrderCount
        : 1,
  };
};

export const buildVatSummary = (
  orders: AdminFinanceOrderInput[],
  now = new Date(),
  options: BuildVatSummaryOptions = 0,
): AdminVatSummary => {
  const finance = buildFinanceRollup(orders);
  const inputVatCents =
    typeof options === "number" ? options : Math.max(options.inputVatCents ?? 0, 0);
  const expenseCount = typeof options === "number" ? 0 : options.expenseCount ?? 0;
  const missingExpenseVatCount =
    typeof options === "number" ? 0 : options.missingExpenseVatCount ?? 0;
  const missingExpenseDocumentCount =
    typeof options === "number" ? 0 : options.missingExpenseDocumentCount ?? 0;
  const missingExpenseSupplierCount =
    typeof options === "number" ? 0 : options.missingExpenseSupplierCount ?? 0;
  const monthLabel = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(now);

  const blockers: string[] = [];
  const notes: string[] = [];

  if (finance.ordersMissingTaxCount > 0) {
    blockers.push(
      `${finance.ordersMissingTaxCount} paid order(s) are missing VAT amounts in the selected window.`,
    );
  }

  if (expenseCount === 0) {
    blockers.push("No expense records are captured for the selected period yet.");
  } else {
    if (missingExpenseDocumentCount > 0) {
      blockers.push(
        `${missingExpenseDocumentCount} expense record(s) are missing a valid document status.`,
      );
    }
    if (missingExpenseVatCount > 0) {
      blockers.push(
        `${missingExpenseVatCount} deductible expense record(s) are missing VAT amounts.`,
      );
    }
    if (missingExpenseSupplierCount > 0) {
      blockers.push(
        `${missingExpenseSupplierCount} expense record(s) are not linked to a supplier.`,
      );
    }
    if (inputVatCents <= 0) {
      blockers.push("No deductible input VAT is currently captured from expenses.");
    }
  }

  if (finance.refundedGrossCents > 0) {
    notes.push("Refund VAT is estimated proportionally from refunded gross amounts.");
  }

  notes.push("Output VAT follows cash-based recognition from paid orders only.");
  if (expenseCount > 0) {
    notes.push("Input VAT is estimated from recorded deductible expenses and document dates.");
  }

  return {
    monthLabel,
    accountingModeLabel: "Cash-based VAT (Istversteuerung)",
    taxationModeLabel: "Regular VAT with input tax deduction",
    outputVatCents: finance.netOutputVatCents,
    refundedVatEstimateCents: finance.refundedVatEstimateCents,
    inputVatCents,
    estimatedLiabilityCents: finance.netOutputVatCents - inputVatCents,
    taxCoverageRate: finance.taxCoverageRate,
    ordersMissingTaxCount: finance.ordersMissingTaxCount,
    status:
      blockers.length === 0
        ? "ready_for_handover"
        : inputVatCents <= 0
          ? "review_required"
          : "estimated",
    blockers,
    notes,
  };
};
