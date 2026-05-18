export const TAX_REGIMES = ["NORMAL", "KLEINUNTERNEHMER", "MANUAL_REVIEW"] as const;
export const GERMAN_VAT_RATES = [
  "VAT_19",
  "VAT_7",
  "VAT_0",
  "EXEMPT",
  "REVERSE_CHARGE",
  "UNKNOWN",
] as const;
export const TAX_CLASSIFICATIONS = [
  "DOMESTIC_STANDARD",
  "DOMESTIC_REDUCED",
  "DOMESTIC_ZERO",
  "EXEMPT",
  "KLEINUNTERNEHMER",
  "REVERSE_CHARGE",
  "INTRA_EU_MANUAL",
  "EXPORT_MANUAL",
  "UNKNOWN",
] as const;
export const INVOICE_VALIDATION_STATUSES = [
  "ENTWURF",
  "PRUEFUNG_ERFORDERLICH",
  "VOLLSTAENDIG",
] as const;
export const INPUT_VAT_ELIGIBILITY_VALUES = [
  "VORSTEUERFAEHIG",
  "NICHT_VORSTEUERFAEHIG",
  "TEILWEISE_VORSTEUERFAEHIG",
  "MANUELLE_PRUEFUNG",
] as const;
export const TAX_REVIEW_STATUSES = [
  "ENTWURF",
  "PRUEFUNG_ERFORDERLICH",
  "BEREIT_ZUR_UEBERGABE",
  "GESPERRT",
] as const;

export type TaxRegime = (typeof TAX_REGIMES)[number];
export type GermanVatRate = (typeof GERMAN_VAT_RATES)[number];
export type TaxClassification = (typeof TAX_CLASSIFICATIONS)[number];
export type InvoiceValidationStatus = (typeof INVOICE_VALIDATION_STATUSES)[number];
export type InputVatEligibility = (typeof INPUT_VAT_ELIGIBILITY_VALUES)[number];
export type TaxReviewStatus = (typeof TAX_REVIEW_STATUSES)[number];

export type GermanTaxContext = {
  currency?: string | null;
  vatRateBasisPoints?: number | null;
  supplierCountry?: string | null;
  reverseChargeReference?: string | null;
  taxRegime?: TaxRegime | null;
  isSmallBusinessSupplier?: boolean;
};

export type GermanTaxClassificationResult = {
  taxRegime: TaxRegime;
  germanVatRate: GermanVatRate;
  taxClassification: TaxClassification;
  manualReviewReason: string | null;
};

export type GermanInvoiceInput = {
  invoiceIssuerName?: string | null;
  invoiceNumber?: string | null;
  invoiceDescription?: string | null;
  documentDate?: Date | null;
  grossAmount?: number | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  vatRateBasisPoints?: number | null;
  documentStatus?: string | null;
  taxRegime?: TaxRegime | null;
  taxClassification?: TaxClassification | null;
  reverseChargeReference?: string | null;
  isSmallBusinessSupplier?: boolean;
};

export type GermanInvoiceValidationResult = {
  status: InvoiceValidationStatus;
  blockers: string[];
  warnings: string[];
  isSmallInvoice: boolean;
};

export type InputVatEligibilityResult = {
  status: InputVatEligibility;
  reason: string | null;
};

export type VatReviewSnapshot = {
  invoiceValidationStatus: InvoiceValidationStatus;
  inputVatEligibility: InputVatEligibility;
  taxReviewStatus: TaxReviewStatus;
  blockers: string[];
  warnings: string[];
  manualReviewReason: string | null;
};

const normalizeCountry = (value: string | null | undefined) =>
  value?.trim().toUpperCase() || null;

const hasValue = (value: string | null | undefined) => Boolean(value?.trim());

const isFiniteAmount = (value: unknown) => typeof value === "number" && Number.isFinite(value);

export function classifyGermanTaxContext(
  input: GermanTaxContext,
): GermanTaxClassificationResult {
  const supplierCountry = normalizeCountry(input.supplierCountry);
  const explicitRegime = input.taxRegime ?? null;

  if (explicitRegime === "KLEINUNTERNEHMER" || input.isSmallBusinessSupplier) {
    return {
      taxRegime: "KLEINUNTERNEHMER",
      germanVatRate: "EXEMPT",
      taxClassification: "KLEINUNTERNEHMER",
      manualReviewReason: "Lieferant ist als Kleinunternehmer markiert.",
    };
  }

  if (hasValue(input.reverseChargeReference)) {
    return {
      taxRegime: "MANUAL_REVIEW",
      germanVatRate: "REVERSE_CHARGE",
      taxClassification: "REVERSE_CHARGE",
      manualReviewReason: "Reverse-Charge-Hinweis erkannt (§ 13b UStG).",
    };
  }

  if (supplierCountry && supplierCountry !== "DE") {
    return {
      taxRegime: "MANUAL_REVIEW",
      germanVatRate: "UNKNOWN",
      taxClassification: "INTRA_EU_MANUAL",
      manualReviewReason: "Grenzüberschreitender Lieferant erfordert manuelle Prüfung.",
    };
  }

  const vatRateBasisPoints = input.vatRateBasisPoints ?? null;
  if (vatRateBasisPoints === 1900) {
    return {
      taxRegime: "NORMAL",
      germanVatRate: "VAT_19",
      taxClassification: "DOMESTIC_STANDARD",
      manualReviewReason: null,
    };
  }
  if (vatRateBasisPoints === 700) {
    return {
      taxRegime: "NORMAL",
      germanVatRate: "VAT_7",
      taxClassification: "DOMESTIC_REDUCED",
      manualReviewReason: null,
    };
  }
  if (vatRateBasisPoints === 0) {
    return {
      taxRegime: "NORMAL",
      germanVatRate: "VAT_0",
      taxClassification: "DOMESTIC_ZERO",
      manualReviewReason: "Steuersatz 0 % erfordert fachliche Prüfung.",
    };
  }

  return {
    taxRegime: explicitRegime ?? "MANUAL_REVIEW",
    germanVatRate: "UNKNOWN",
    taxClassification: "UNKNOWN",
    manualReviewReason: "Steuerkontext konnte nicht eindeutig als deutscher Domestic-Fall klassifiziert werden.",
  };
}

export function validateGermanInvoice(
  input: GermanInvoiceInput,
): GermanInvoiceValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const grossAmount = input.grossAmount ?? null;
  const netAmount = input.netAmount ?? null;
  const vatAmount = input.vatAmount ?? null;
  const vatRateBasisPoints = input.vatRateBasisPoints ?? null;
  const isSmallInvoice = typeof grossAmount === "number" && grossAmount > 0 && grossAmount <= 25_000;

  if (!hasValue(input.invoiceIssuerName)) {
    blockers.push("Rechnungsaussteller fehlt.");
  }
  if (!input.documentDate || Number.isNaN(input.documentDate.getTime())) {
    blockers.push("Rechnungsdatum fehlt oder ist ungültig.");
  }
  if (!hasValue(input.invoiceDescription)) {
    blockers.push("Leistungsbeschreibung fehlt.");
  }
  if (!isFiniteAmount(grossAmount) || !isFiniteAmount(netAmount) || !isFiniteAmount(vatAmount)) {
    blockers.push("Netto-, Brutto- oder Umsatzsteuerbetrag ist unvollständig.");
  }

  if (!isSmallInvoice && !hasValue(input.invoiceNumber)) {
    blockers.push("Rechnungsnummer fehlt.");
  }

  if (input.taxRegime !== "KLEINUNTERNEHMER" && !hasValue(input.reverseChargeReference)) {
    if (vatRateBasisPoints === null || vatRateBasisPoints < 0) {
      blockers.push("Steuersatz fehlt.");
    }
  }

  if (
    isFiniteAmount(grossAmount) &&
    isFiniteAmount(netAmount) &&
    isFiniteAmount(vatAmount) &&
    Math.abs((netAmount as number) + (vatAmount as number) - (grossAmount as number)) > 1
  ) {
    blockers.push("Netto, Umsatzsteuer und Brutto sind rechnerisch nicht konsistent.");
  }

  if (input.taxClassification === "DOMESTIC_ZERO") {
    warnings.push("0-%-Sachverhalt bitte fachlich gegen deutsche Steuerlogik prüfen.");
  }
  if (input.taxClassification === "REVERSE_CHARGE") {
    warnings.push("Reverse-Charge-Fall ist nicht vollautomatisch freigabefähig.");
  }
  if (input.taxRegime === "KLEINUNTERNEHMER") {
    warnings.push("Bei Kleinunternehmern ist regelmäßig kein Vorsteuerabzug möglich.");
  }
  if (input.documentStatus === "MISSING") {
    blockers.push("Belegstatus steht auf fehlend.");
  }

  return {
    status: blockers.length === 0 ? "VOLLSTAENDIG" : "PRUEFUNG_ERFORDERLICH",
    blockers,
    warnings,
    isSmallInvoice,
  };
}

export function evaluateInputVatEligibility(input: {
  isDeductible: boolean;
  vatAmount: number;
  taxRegime: TaxRegime;
  taxClassification: TaxClassification;
  invoiceValidationStatus: InvoiceValidationStatus;
}): InputVatEligibilityResult {
  if (!input.isDeductible) {
    return {
      status: "NICHT_VORSTEUERFAEHIG",
      reason: "Ausgabe ist als nicht vorsteuerabzugsfähig markiert.",
    };
  }

  if (input.taxRegime === "KLEINUNTERNEHMER") {
    return {
      status: "NICHT_VORSTEUERFAEHIG",
      reason: "Kleinunternehmer-Rechnung enthält regelmäßig keine abziehbare Vorsteuer.",
    };
  }

  if (
    input.taxClassification === "REVERSE_CHARGE" ||
    input.taxClassification === "INTRA_EU_MANUAL" ||
    input.taxClassification === "EXPORT_MANUAL" ||
    input.taxClassification === "UNKNOWN"
  ) {
    return {
      status: "MANUELLE_PRUEFUNG",
      reason: "Grenzfall für Vorsteuerabzug erfordert manuelle Prüfung.",
    };
  }

  if (input.invoiceValidationStatus !== "VOLLSTAENDIG") {
    return {
      status: "MANUELLE_PRUEFUNG",
      reason: "Rechnung ist noch nicht vollständig validiert.",
    };
  }

  if (!Number.isFinite(input.vatAmount) || input.vatAmount <= 0) {
    return {
      status: "MANUELLE_PRUEFUNG",
      reason: "Keine plausible Vorsteuer auf der Rechnung erfasst.",
    };
  }

  return {
    status: "VORSTEUERFAEHIG",
    reason: null,
  };
}

export function buildVatReviewSnapshot(
  input: GermanInvoiceInput & {
    isDeductible: boolean;
  },
): VatReviewSnapshot {
  const classification = classifyGermanTaxContext({
    vatRateBasisPoints: input.vatRateBasisPoints ?? null,
    supplierCountry: null,
    reverseChargeReference: input.reverseChargeReference ?? null,
    taxRegime: input.taxRegime ?? null,
    isSmallBusinessSupplier: input.isSmallBusinessSupplier ?? false,
  });
  const invoiceValidation = validateGermanInvoice({
    ...input,
    taxRegime: classification.taxRegime,
    taxClassification: classification.taxClassification,
  });
  const inputVatEligibility = evaluateInputVatEligibility({
    isDeductible: input.isDeductible,
    vatAmount: input.vatAmount ?? 0,
    taxRegime: classification.taxRegime,
    taxClassification: classification.taxClassification,
    invoiceValidationStatus: invoiceValidation.status,
  });

  const blockers = [...invoiceValidation.blockers];
  const warnings = [...invoiceValidation.warnings];
  const reasons = [classification.manualReviewReason, inputVatEligibility.reason].filter(
    (value): value is string => Boolean(value),
  );
  const uniqueReason = reasons[0] ?? null;

  let taxReviewStatus: TaxReviewStatus = "PRUEFUNG_ERFORDERLICH";
  if (classification.taxClassification === "REVERSE_CHARGE") {
    taxReviewStatus = "GESPERRT";
  } else if (
    invoiceValidation.status === "VOLLSTAENDIG" &&
    inputVatEligibility.status === "VORSTEUERFAEHIG"
  ) {
    taxReviewStatus = "BEREIT_ZUR_UEBERGABE";
  }

  return {
    invoiceValidationStatus: invoiceValidation.status,
    inputVatEligibility: inputVatEligibility.status,
    taxReviewStatus,
    blockers,
    warnings,
    manualReviewReason: uniqueReason,
  };
}

export function formatGermanVatRateLabel(value: GermanVatRate) {
  switch (value) {
    case "VAT_19":
      return "19 %";
    case "VAT_7":
      return "7 %";
    case "VAT_0":
      return "0 %";
    case "EXEMPT":
      return "Steuerfrei";
    case "REVERSE_CHARGE":
      return "Reverse-Charge";
    default:
      return "Unbekannt";
  }
}

export function formatTaxReviewStatusLabel(value: TaxReviewStatus) {
  switch (value) {
    case "BEREIT_ZUR_UEBERGABE":
      return "Bereit zur Übergabe";
    case "PRUEFUNG_ERFORDERLICH":
      return "Prüfung erforderlich";
    case "GESPERRT":
      return "Gesperrt";
    default:
      return "Entwurf";
  }
}

export function formatInputVatEligibilityLabel(value: InputVatEligibility) {
  switch (value) {
    case "VORSTEUERFAEHIG":
      return "Vorsteuerfähig";
    case "NICHT_VORSTEUERFAEHIG":
      return "Nicht vorsteuerfähig";
    case "TEILWEISE_VORSTEUERFAEHIG":
      return "Teilweise vorsteuerfähig";
    default:
      return "Manuelle Prüfung";
  }
}
