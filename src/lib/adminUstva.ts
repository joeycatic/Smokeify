export type AdminVatWindowStatus = "estimated" | "review_required" | "ready_for_handover";

export type AdminUstvaPreparationInput = {
  monthKey: string;
  monthLabel: string;
  outputVatCents: number;
  refundedVatEstimateCents: number;
  inputVatCents: number;
  estimatedLiabilityCents: number;
  ordersMissingTaxCount: number;
  status: AdminVatWindowStatus;
  blockers: string[];
  notes: string[];
  missingExpenseDocumentCount: number;
  missingExpenseVatCount: number;
  missingExpenseSupplierCount: number;
  reviewRequiredExpenseCount?: number;
  blockedExpenseCount?: number;
  reverseChargeExpenseCount?: number;
};

export type AdminUstvaFieldStatus = "ready" | "review_required" | "manual";

export type AdminUstvaField = {
  code: string | null;
  label: string;
  valueCents: number;
  status: AdminUstvaFieldStatus;
  note: string;
};

export type AdminUstvaPreparation = {
  monthKey: string;
  monthLabel: string;
  filingStatus: AdminVatWindowStatus;
  filingLabel: string;
  paymentStateLabel: string;
  dueDateNote: string;
  taxableBase19Cents: number;
  payableCents: number;
  refundCents: number;
  fields: AdminUstvaField[];
  manualReview: AdminUstvaField[];
  blockers: string[];
  notes: string[];
};

const calculateTaxableBase19 = (outputVatCents: number) =>
  outputVatCents > 0 ? Math.round((outputVatCents * 100) / 19) : 0;

const formatFilingLabel = (value: AdminVatWindowStatus) => {
  if (value === "ready_for_handover") return "Bereit zur Übergabe";
  if (value === "review_required") return "Prüfung erforderlich";
  return "Geschätzt";
};

export function buildUstvaPreparation(
  input: AdminUstvaPreparationInput,
): AdminUstvaPreparation {
  const taxableBase19Cents = calculateTaxableBase19(input.outputVatCents);
  const payableCents = Math.max(input.estimatedLiabilityCents, 0);
  const refundCents = Math.max(-input.estimatedLiabilityCents, 0);
  const reviewStatus: AdminUstvaFieldStatus =
    input.status === "ready_for_handover" ? "ready" : "review_required";

  const fields: AdminUstvaField[] = [
    {
      code: "81",
      label: "Steuerpflichtige Umsätze zu 19 %",
      valueCents: taxableBase19Cents,
      status: reviewStatus,
      note: "Aus der aktuell erfassten Umsatzsteuer zu 19 % für den Zeitraum abgeleitet.",
    },
    {
      code: "86",
      label: "Umsatzsteuer zu 19 %",
      valueCents: input.outputVatCents,
      status: reviewStatus,
      note: "Aus bezahlten Bestellungen nach Ist-Versteuerung abgeleitet.",
    },
    {
      code: "66",
      label: "Abziehbare Vorsteuerbeträge",
      valueCents: input.inputVatCents,
      status: reviewStatus,
      note: "Aus als vorsteuerfähig bewerteten Eingangsrechnungen übernommen.",
    },
    {
      code: "83",
      label: "Verbleibende Umsatzsteuer-Vorauszahlung",
      valueCents: payableCents,
      status: reviewStatus,
      note:
        refundCents > 0
          ? "Für diesen Zeitraum ergibt sich rechnerisch ein Überschuss; die Vorauszahlung bleibt daher 0 €."
          : "Vorbereiteter Zahllastwert ohne Sondervorauszahlung oder ELSTER-Übermittlung.",
    },
    {
      code: null,
      label: "Rechnerischer Überschuss / Erstattungsanspruch",
      valueCents: refundCents,
      status: reviewStatus,
      note:
        refundCents > 0
          ? "Negativer Saldo aus Umsatzsteuer minus Vorsteuer."
          : "Kein Überschuss für den gewählten Zeitraum.",
    },
  ];

  const manualReview: AdminUstvaField[] = [
    {
      code: "35/36",
      label: "Umsätze zum ermäßigten Steuersatz",
      valueCents: 0,
      status: "manual",
      note:
        "Im aktuellen Admin wird keine separate UStVA-Bemessungsgrundlage für 7-%-Umsätze gepflegt.",
    },
    {
      code: "61/62",
      label: "Innergemeinschaftliche Erwerbe",
      valueCents: 0,
      status: "manual",
      note: "EU-Erwerbe bleiben in dieser Version bewusst in der manuellen Prüfung.",
    },
    {
      code: "67",
      label: "Vorsteuer aus Reverse-Charge / § 13b UStG",
      valueCents: 0,
      status: "manual",
      note:
        (input.reverseChargeExpenseCount ?? 0) > 0
          ? `${input.reverseChargeExpenseCount ?? 0} Beleg(e) mit Reverse-Charge-Hinweis erfordern manuelle Prüfung.`
          : "Reverse-Charge-Fälle werden nicht automatisch in die UStVA übernommen.",
    },
    {
      code: "39",
      label: "Abzug Sondervorauszahlung",
      valueCents: 0,
      status: "manual",
      note:
        "Sondervorauszahlung / Dauerfristverlängerung wird derzeit nicht im Admin berechnet oder gegengebucht.",
    },
  ];

  const blockers = [...input.blockers];
  if ((input.blockedExpenseCount ?? 0) > 0) {
    blockers.push(
      `${input.blockedExpenseCount} Ausgabenposition(en) sind für die UStVA gesperrt und müssen manuell geprüft werden.`,
    );
  }
  if ((input.reviewRequiredExpenseCount ?? 0) > 0) {
    blockers.push(
      `${input.reviewRequiredExpenseCount} Ausgabenposition(en) stehen noch auf Prüfung erforderlich.`,
    );
  }

  const notes = [
    ...input.notes,
    "Die UStVA-Hilfe bereitet Werte für die Übergabe vor, sendet aber nicht an ELSTER.",
    "Kennzahlen basieren auf dem BMF-Vordruck USt 1 A 2026; nicht modellierte Spezialfälle bleiben manuell.",
  ];

  return {
    monthKey: input.monthKey,
    monthLabel: input.monthLabel,
    filingStatus: input.status,
    filingLabel: formatFilingLabel(input.status),
    paymentStateLabel:
      payableCents > 0
        ? "Zahllast"
        : refundCents > 0
          ? "Überschuss"
          : "Ausgeglichen",
    dueDateNote: "Elektronische Übermittlung erfolgt weiterhin außerhalb des Admins über ELSTER.",
    taxableBase19Cents,
    payableCents,
    refundCents,
    fields,
    manualReview,
    blockers,
    notes,
  };
}
