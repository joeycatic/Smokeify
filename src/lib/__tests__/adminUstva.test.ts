import { describe, expect, it } from "vitest";
import { buildUstvaPreparation } from "@/lib/adminUstva";

describe("buildUstvaPreparation", () => {
  it("maps core domestic UStVA helper fields", () => {
    const result = buildUstvaPreparation({
      monthKey: "2026-04",
      monthLabel: "April 2026",
      outputVatCents: 1900,
      refundedVatEstimateCents: 0,
      inputVatCents: 500,
      estimatedLiabilityCents: 1400,
      ordersMissingTaxCount: 0,
      status: "ready_for_handover",
      blockers: [],
      notes: [],
      missingExpenseDocumentCount: 0,
      missingExpenseVatCount: 0,
      missingExpenseSupplierCount: 0,
    });

    expect(result.taxableBase19Cents).toBe(10000);
    expect(result.payableCents).toBe(1400);
    expect(result.refundCents).toBe(0);
    expect(result.fields.map((field) => field.code)).toEqual(["81", "86", "66", "83", null]);
  });

  it("keeps special cases in manual review and surfaces blocked expenses", () => {
    const result = buildUstvaPreparation({
      monthKey: "2026-04",
      monthLabel: "April 2026",
      outputVatCents: 3800,
      refundedVatEstimateCents: 300,
      inputVatCents: 4200,
      estimatedLiabilityCents: -400,
      ordersMissingTaxCount: 2,
      status: "review_required",
      blockers: ["2 order(s) are missing VAT amounts in the selected window."],
      notes: [],
      missingExpenseDocumentCount: 1,
      missingExpenseVatCount: 1,
      missingExpenseSupplierCount: 0,
      reviewRequiredExpenseCount: 3,
      blockedExpenseCount: 1,
      reverseChargeExpenseCount: 1,
    });

    expect(result.paymentStateLabel).toBe("Überschuss");
    expect(result.refundCents).toBe(400);
    expect(result.manualReview.find((field) => field.code === "67")?.note).toContain(
      "1 Beleg(e)",
    );
    expect(result.blockers.some((blocker) => blocker.includes("gesperrt"))).toBe(true);
  });
});
