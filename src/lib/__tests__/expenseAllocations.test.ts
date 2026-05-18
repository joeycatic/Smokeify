import { describe, expect, it } from "vitest";
import {
  getAllocatedAmountCents,
  normalizeStorefrontAllocations,
  summarizeStorefrontAllocations,
} from "@/lib/expenseAllocations";

describe("expenseAllocations", () => {
  it("normalizes valid split allocations", () => {
    const result = normalizeStorefrontAllocations([
      { storefront: "main", percent: 60 },
      { storefront: "GROW", percent: "40" },
    ]);

    expect(result).toEqual({
      ok: true,
      allocations: [
        { storefront: "MAIN", percent: 60 },
        { storefront: "GROW", percent: 40 },
      ],
    });
  });

  it("rejects incomplete totals", () => {
    const result = normalizeStorefrontAllocations([
      { storefront: "MAIN", percent: 50 },
    ]);

    expect(result).toEqual({
      ok: false,
      error: "Allocation percentages must total 100.",
    });
  });

  it("summarizes missing allocation coverage", () => {
    const summary = summarizeStorefrontAllocations([
      { storefront: "MAIN", percent: 70 },
    ]);

    expect(summary.totalPercent).toBe(70);
    expect(summary.isFullyAllocated).toBe(false);
    expect(summary.missingPercent).toBe(30);
  });

  it("allocates cents by storefront percent", () => {
    const allocated = getAllocatedAmountCents(
      12345,
      [
        { storefront: "MAIN", percent: 75 },
        { storefront: "GROW", percent: 25 },
      ],
      "GROW",
    );

    expect(allocated).toBe(3086);
  });
});
