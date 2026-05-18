export const NEWSLETTER_OFFER_DISCOUNT_CENTS = 500;
export const NEWSLETTER_OFFER_POPUP_STORAGE_KEY =
  "smokeify-newsletter-offer-dismissed-v1";
export const NEWSLETTER_OFFER_SUCCESS_STORAGE_KEY =
  "smokeify-newsletter-offer-claimed-v1";

export const getNewsletterOfferActiveUntil = () => {
  const raw = process.env.NEXT_PUBLIC_NEWSLETTER_OFFER_ACTIVE_UNTIL?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isNewsletterOfferActive = (referenceDate = new Date()) => {
  const activeUntil = getNewsletterOfferActiveUntil();
  if (!activeUntil) return true;
  return referenceDate.getTime() <= activeUntil.getTime();
};

export const formatDiscountAmount = () =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(NEWSLETTER_OFFER_DISCOUNT_CENTS / 100);

export const formatNewsletterOfferActiveUntil = () => {
  const activeUntil = getNewsletterOfferActiveUntil();
  if (!activeUntil) return null;
  return activeUntil.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
