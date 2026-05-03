export function formatAdminMoney(
  amountCents: number,
  locale = "de-DE",
  currency = "EUR",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatAdminPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
