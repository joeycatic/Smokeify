export const DEFAULT_VAT_RATE_BASIS_POINTS = 1900;

export function calculateVatComponentsFromGross(
  grossAmountCents: number,
  vatRateBasisPoints = DEFAULT_VAT_RATE_BASIS_POINTS,
) {
  if (!Number.isFinite(grossAmountCents) || grossAmountCents < 0) {
    return {
      grossAmount: 0,
      netAmount: 0,
      vatAmount: 0,
      vatRateBasisPoints,
    };
  }

  const divisor = 1 + vatRateBasisPoints / 10_000;
  const netAmount = Math.round(grossAmountCents / divisor);
  const vatAmount = grossAmountCents - netAmount;

  return {
    grossAmount: grossAmountCents,
    netAmount,
    vatAmount,
    vatRateBasisPoints,
  };
}

export function calculateVatComponentsFromNet(
  netAmountCents: number,
  vatRateBasisPoints = DEFAULT_VAT_RATE_BASIS_POINTS,
) {
  if (!Number.isFinite(netAmountCents) || netAmountCents < 0) {
    return {
      grossAmount: 0,
      netAmount: 0,
      vatAmount: 0,
      vatRateBasisPoints,
    };
  }

  const grossAmount = Math.round(netAmountCents * (1 + vatRateBasisPoints / 10_000));
  const vatAmount = grossAmount - netAmountCents;

  return {
    grossAmount,
    netAmount: netAmountCents,
    vatAmount,
    vatRateBasisPoints,
  };
}

export function canApplyDefaultVatFallback(currency: string, shippingCountry?: string | null) {
  const normalizedCurrency = currency.trim().toUpperCase();
  const normalizedCountry = shippingCountry?.trim().toUpperCase() ?? null;
  return normalizedCurrency === "EUR" && (normalizedCountry === null || normalizedCountry === "DE");
}
