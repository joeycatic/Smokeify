export const FREE_SHIPPING_THRESHOLD_EUR = 69;
export const MIN_ORDER_TOTAL_EUR = 15;

export const SHIPPING_BASE = {
  DE: 7.9,
  AT: 7.9,
  CH: 9.9,
  EU: 8.9,
  UK: 9.9,
  US: 12.9,
  OTHER: 12.9,
} as const;

export type ShippingCountry = keyof typeof SHIPPING_BASE;

export const SHIPPING_COUNTRY_LABELS: Record<ShippingCountry, string> = {
  DE: "Deutschland",
  AT: "Österreich",
  CH: "Schweiz",
  EU: "EU (sonstige)",
  UK: "Vereinigtes Königreich",
  US: "USA",
  OTHER: "Andere Länder",
};

export const getShippingAmount = (country: ShippingCountry) =>
  SHIPPING_BASE[country] ?? SHIPPING_BASE.OTHER;

export const toCents = (value: number) => Math.round(value * 100);
