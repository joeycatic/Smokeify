import { describe, expect, it } from "vitest";
import { buildOrderFinanceBreakdown } from "@/lib/adminFinance";

describe("buildOrderFinanceBreakdown", () => {
  it("estimates domestic VAT from gross totals when Stripe tax is missing", () => {
    const breakdown = buildOrderFinanceBreakdown({
      createdAt: new Date("2026-02-13T05:15:23.546Z"),
      currency: "EUR",
      shippingCountry: "DE",
      paymentStatus: "paid",
      status: "complete",
      amountSubtotal: 10000,
      amountTax: 0,
      amountShipping: 1900,
      amountDiscount: 0,
      amountTotal: 11900,
      amountRefunded: 0,
      items: [
        {
          quantity: 1,
          totalAmount: 11900,
          baseCostAmount: 5000,
          paymentFeeAmount: 0,
          adjustedCostAmount: 5000,
          taxAmount: 0,
        },
      ],
    });

    expect(breakdown.outputVatCents).toBe(1900);
    expect(breakdown.netRevenueCents).toBe(10000);
    expect(breakdown.taxedItemCount).toBe(1);
  });

  it("does not estimate VAT for non-domestic destinations", () => {
    const breakdown = buildOrderFinanceBreakdown({
      createdAt: new Date("2026-02-13T05:15:23.546Z"),
      currency: "EUR",
      shippingCountry: "US",
      paymentStatus: "paid",
      status: "complete",
      amountSubtotal: 10000,
      amountTax: 0,
      amountShipping: 1900,
      amountDiscount: 0,
      amountTotal: 11900,
      amountRefunded: 0,
      items: [
        {
          quantity: 1,
          totalAmount: 11900,
          baseCostAmount: 5000,
          paymentFeeAmount: 0,
          adjustedCostAmount: 5000,
          taxAmount: 0,
        },
      ],
    });

    expect(breakdown.outputVatCents).toBe(0);
    expect(breakdown.netRevenueCents).toBe(11900);
    expect(breakdown.taxedItemCount).toBe(0);
  });
});
