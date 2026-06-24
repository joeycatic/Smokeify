import { describe, expect, it } from "vitest";

import { calculateDropshipSellableStock } from "./supplierStockSync.mjs";

describe("calculateDropshipSellableStock", () => {
  it("subtracts paid unfulfilled dropship demand from supplier-reported stock", () => {
    expect(
      calculateDropshipSellableStock({
        supplierReportedStock: 10,
        pendingDropshipDemand: 3,
      }),
    ).toBe(7);
  });

  it("never returns negative sellable stock", () => {
    expect(
      calculateDropshipSellableStock({
        supplierReportedStock: 2,
        pendingDropshipDemand: 5,
      }),
    ).toBe(0);
  });

  it("normalizes invalid inputs to zero", () => {
    expect(
      calculateDropshipSellableStock({
        supplierReportedStock: Number.NaN,
        pendingDropshipDemand: Number.POSITIVE_INFINITY,
      }),
    ).toBe(0);
  });
});
