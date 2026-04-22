import { describe, expect, it } from "vitest";
import {
  buildVatReviewSnapshot,
  classifyGermanTaxContext,
  evaluateInputVatEligibility,
  validateGermanInvoice,
} from "@/lib/germanTax";

describe("germanTax", () => {
  it("classifies domestic standard VAT correctly", () => {
    expect(
      classifyGermanTaxContext({
        supplierCountry: "DE",
        vatRateBasisPoints: 1900,
      }),
    ).toMatchObject({
      taxRegime: "NORMAL",
      germanVatRate: "VAT_19",
      taxClassification: "DOMESTIC_STANDARD",
      manualReviewReason: null,
    });
  });

  it("routes reverse-charge expenses into blocked manual review", () => {
    const snapshot = buildVatReviewSnapshot({
      invoiceIssuerName: "SaaS Vendor Ltd.",
      invoiceNumber: "INV-2026-04",
      invoiceDescription: "Subscription April 2026",
      documentDate: new Date("2026-04-10T00:00:00.000Z"),
      grossAmount: 11900,
      netAmount: 10000,
      vatAmount: 1900,
      vatRateBasisPoints: 1900,
      documentStatus: "RECEIVED",
      reverseChargeReference: "§ 13b UStG",
      isDeductible: true,
    });

    expect(snapshot.taxReviewStatus).toBe("GESPERRT");
    expect(snapshot.inputVatEligibility).toBe("MANUELLE_PRUEFUNG");
    expect(snapshot.manualReviewReason).toContain("Reverse-Charge");
  });

  it("marks complete domestic invoices as ready for handover", () => {
    const invoice = validateGermanInvoice({
      invoiceIssuerName: "Logistik GmbH",
      invoiceNumber: "RG-2026-0042",
      invoiceDescription: "Versandkosten März",
      documentDate: new Date("2026-03-31T00:00:00.000Z"),
      grossAmount: 11900,
      netAmount: 10000,
      vatAmount: 1900,
      vatRateBasisPoints: 1900,
      documentStatus: "VERIFIED",
      taxRegime: "NORMAL",
      taxClassification: "DOMESTIC_STANDARD",
    });

    expect(invoice.status).toBe("VOLLSTAENDIG");

    const snapshot = buildVatReviewSnapshot({
      invoiceIssuerName: "Logistik GmbH",
      invoiceNumber: "RG-2026-0042",
      invoiceDescription: "Versandkosten März",
      documentDate: new Date("2026-03-31T00:00:00.000Z"),
      grossAmount: 11900,
      netAmount: 10000,
      vatAmount: 1900,
      vatRateBasisPoints: 1900,
      documentStatus: "VERIFIED",
      taxRegime: "NORMAL",
      isDeductible: true,
    });

    expect(snapshot.invoiceValidationStatus).toBe("VOLLSTAENDIG");
    expect(snapshot.inputVatEligibility).toBe("VORSTEUERFAEHIG");
    expect(snapshot.taxReviewStatus).toBe("BEREIT_ZUR_UEBERGABE");
  });

  it("prevents Vorsteuer for Kleinunternehmer invoices", () => {
    expect(
      evaluateInputVatEligibility({
        isDeductible: true,
        vatAmount: 0,
        taxRegime: "KLEINUNTERNEHMER",
        taxClassification: "KLEINUNTERNEHMER",
        invoiceValidationStatus: "VOLLSTAENDIG",
      }),
    ).toMatchObject({
      status: "NICHT_VORSTEUERFAEHIG",
    });
  });
});
