import { describe, expect, it } from "vitest";
import {
  calculateSelectedRefundAmount,
  getRefundPreviewAmount,
} from "@/lib/adminRefundCalculator";

const sampleOrder = {
  amountTotal: 11016,
  amountRefunded: 0,
  amountShipping: 690,
  items: [
    {
      id: "item-1",
      quantity: 2,
      totalAmount: 8000,
    },
    {
      id: "item-2",
      quantity: 1,
      totalAmount: 2326,
    },
  ],
};

describe("adminRefundCalculator", () => {
  it("calculates item refunds from line totals instead of unit amounts", () => {
    expect(
      calculateSelectedRefundAmount(sampleOrder, {
        "item-1": 1,
      }),
    ).toBe(4000);
  });

  it("excludes shipping from full refunds when disabled", () => {
    expect(getRefundPreviewAmount(sampleOrder, "full", undefined, false)).toBe(10326);
  });

  it("adds shipping to item refunds without exceeding the remaining balance", () => {
    expect(
      getRefundPreviewAmount(
        {
          ...sampleOrder,
          amountRefunded: 10500,
        },
        "items",
        { "item-2": 1 },
        true,
      ),
    ).toBe(516);
  });
});
