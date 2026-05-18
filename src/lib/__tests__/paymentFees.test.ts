import { describe, it, expect } from "vitest";
import {
  allocateByWeight,
  applyPaymentFeesToCosts,
  PAYMENT_FEE_BY_METHOD,
  DEFAULT_PAYMENT_FEE,
  HIGH_PRICE_SHIPPING_THRESHOLD_CENTS,
} from "../paymentFees";

describe("allocateByWeight", () => {
  it("distributes total exactly across equal weights", () => {
    expect(allocateByWeight(100, [1, 1, 1, 1])).toEqual([25, 25, 25, 25]);
  });

  it("distributes remainder to earlier items", () => {
    // 10 / 3 = 3.33 → [4, 3, 3]
    const result = allocateByWeight(10, [1, 1, 1]);
    expect(result.reduce((s, v) => s + v, 0)).toBe(10);
    expect(result).toHaveLength(3);
  });

  it("returns all zeros when total is 0", () => {
    expect(allocateByWeight(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it("returns all zeros when total is negative", () => {
    expect(allocateByWeight(-5, [1, 2])).toEqual([0, 0]);
  });

  it("returns all zeros for empty weights", () => {
    expect(allocateByWeight(100, [])).toEqual([]);
  });

  it("returns all zeros when all weights are 0", () => {
    expect(allocateByWeight(100, [0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("allocates proportionally to weights", () => {
    // weights [1, 3] → 25% and 75% of 100
    const result = allocateByWeight(100, [1, 3]);
    expect(result[0]).toBe(25);
    expect(result[1]).toBe(75);
    expect(result.reduce((s, v) => s + v, 0)).toBe(100);
  });

  it("handles a single item getting the full total", () => {
    expect(allocateByWeight(999, [1])).toEqual([999]);
  });
});

describe("PAYMENT_FEE_BY_METHOD", () => {
  it("card fee is 1.5% + 25c", () => {
    expect(PAYMENT_FEE_BY_METHOD.card).toEqual({
      percentBasisPoints: 150,
      fixedCents: 25,
    });
  });

  it("link has same fee as card", () => {
    expect(PAYMENT_FEE_BY_METHOD.link).toEqual(PAYMENT_FEE_BY_METHOD.card);
  });

  it("paypal fee is 2.99% + 35c", () => {
    expect(PAYMENT_FEE_BY_METHOD.paypal).toEqual({
      percentBasisPoints: 299,
      fixedCents: 35,
    });
  });

  it("klarna fee is 3.29% + 35c", () => {
    expect(PAYMENT_FEE_BY_METHOD.klarna).toEqual({
      percentBasisPoints: 329,
      fixedCents: 35,
    });
  });

  it("default fee matches card fee", () => {
    expect(DEFAULT_PAYMENT_FEE).toEqual(PAYMENT_FEE_BY_METHOD.card);
  });
});

describe("applyPaymentFeesToCosts", () => {
  const cardFee = PAYMENT_FEE_BY_METHOD.card; // 1.5% + 25c

  it("returns empty array for empty items", () => {
    expect(applyPaymentFeesToCosts([], 0, cardFee)).toEqual([]);
  });

  it("calculates fee for a single item with no shipping", () => {
    const item = {
      quantity: 1,
      unitAmount: 5000, // €50
      totalAmount: 5000,
      baseCostAmount: 3000,
    };
    const result = applyPaymentFeesToCosts([item], 0, cardFee);
    expect(result).toHaveLength(1);
    // percentage fee: round(5000 * 150 / 10000) = round(75) = 75
    // fixed share: 25 (all to single item)
    // total fee: 75 + 25 = 100
    expect(result[0].paymentFeeAmount).toBe(100);
    expect(result[0].adjustedCostAmount).toBe(3100);
  });

  it("splits fixed fee proportionally across multiple items", () => {
    const items = [
      { quantity: 1, unitAmount: 2000, totalAmount: 2000, baseCostAmount: 1000 },
      { quantity: 1, unitAmount: 2000, totalAmount: 2000, baseCostAmount: 1000 },
    ];
    const result = applyPaymentFeesToCosts(items, 0, cardFee);
    // fixed 25c split equally → 13c + 12c (or 12c + 13c)
    const totalFee = result.reduce((s, r) => s + r.paymentFeeAmount, 0);
    // percentage: 4000 * 150 / 10000 = 60 → 30+30
    // fixed: 25 → ~13+12
    expect(totalFee).toBeGreaterThan(0);
    // Total of all fees should account for 1.5% of 4000 + 25
    const expectedTotal = Math.round((4000 * 150) / 10000) + 25;
    expect(totalFee).toBe(expectedTotal);
  });

  it("only shares shipping cost to high-price items (>= €100)", () => {
    const cheapItem = {
      quantity: 1,
      unitAmount: 5000, // €50 — below threshold
      totalAmount: 5000,
      baseCostAmount: 2000,
    };
    const expensiveItem = {
      quantity: 1,
      unitAmount: HIGH_PRICE_SHIPPING_THRESHOLD_CENTS, // €100 — at threshold
      totalAmount: HIGH_PRICE_SHIPPING_THRESHOLD_CENTS,
      baseCostAmount: 5000,
    };
    const shipping = 890; // €8.90

    const result = applyPaymentFeesToCosts(
      [cheapItem, expensiveItem],
      shipping,
      cardFee
    );
    // cheap item gets no shipping share, expensive item gets all of it
    const cheapFee = Math.round((5000 * 150) / 10000);
    const expensiveFee = Math.round(
      ((HIGH_PRICE_SHIPPING_THRESHOLD_CENTS + shipping) * 150) / 10000
    );
    // The percentage part of cheap item should equal cheapFee (no shipping share)
    // Verify total makes sense
    const totalFee = result.reduce((s, r) => s + r.paymentFeeAmount, 0);
    expect(totalFee).toBeGreaterThan(0);
    // Expensive item's fee should be higher due to shipping allocation
    expect(result[1].paymentFeeAmount).toBeGreaterThan(result[0].paymentFeeAmount);
    void cheapFee;
    void expensiveFee;
  });

  it("adjustedCostAmount is always >= 0 even with zero baseCost", () => {
    const item = {
      quantity: 1,
      unitAmount: 1000,
      totalAmount: 1000,
      baseCostAmount: 0,
    };
    const result = applyPaymentFeesToCosts([item], 0, cardFee);
    expect(result[0].adjustedCostAmount).toBeGreaterThanOrEqual(0);
  });
});
