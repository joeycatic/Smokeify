import { FREE_SHIPPING_THRESHOLD_EUR } from "@/lib/shippingPolicy";

export const STANDARD_DELIVERY_WINDOW_DE = "2-5 Werktage";
export const STANDARD_DELIVERY_WINDOW_EU = "3-7 Werktage";
export const RETURNS_WINDOW_DAYS = 14;
export const FREE_SHIPPING_THRESHOLD_LABEL = `${FREE_SHIPPING_THRESHOLD_EUR.toFixed(0)} EUR`;

export const HOMEPAGE_HERO_TRUST_CARDS = [
  {
    title: "Versand mit Klarheit",
    copy: `Ab ${FREE_SHIPPING_THRESHOLD_LABEL} versandkostenfrei in Deutschland. Länderkosten siehst du im Checkout.`,
  },
  {
    title: "Gezielt ausgewähltes Sortiment",
    copy: "Zelte, Licht, Luft, Bewässerung und Zubehör. Ohne Sortiment-Lärm.",
  },
  {
    title: "Spezialistenhilfe",
    copy: "Konfigurator und Pflanzenanalyse helfen bei der Auswahl.",
  },
] as const;

export const HOMEPAGE_TRUST_BADGES = [
  `Kostenloser Versand ab ${FREE_SHIPPING_THRESHOLD_LABEL}`,
  `${RETURNS_WINDOW_DAYS} Tage Rückgabe`,
  "Neutral verpackt",
  "Spezialisierte Grow-Hilfe",
] as const;

export const PDP_FEATURE_ITEMS = [
  "Neutral verpackt",
  "Schneller Versand",
  "Modular",
] as const;

export const PDP_TRUST_CARDS = [
  {
    title: "Lieferzeit",
    detail: STANDARD_DELIVERY_WINDOW_DE,
  },
  {
    title: "Sichere Zahlung",
    detail: "Stripe Checkout",
  },
  {
    title: `${RETURNS_WINDOW_DAYS} Tage Rückgabe`,
    detail: "Einfach & nachvollziehbar",
  },
] as const;

export const PDP_SHIPPING_RETURNS_SUMMARY = `Versandfertige Artikel erreichen Adressen in Deutschland in der Regel innerhalb von ${STANDARD_DELIVERY_WINDOW_DE}. Rücksendungen sind innerhalb von ${RETURNS_WINDOW_DAYS} Tagen nach Erhalt möglich.`;
export const CART_SHIPPING_EXPLANATION = `Versandkosten richten sich nach dem Zielland und werden vor dem Kaufabschluss verbindlich angezeigt.`;
export const CART_CHECKOUT_EXPLANATION = "Die endgültigen Versandkosten und Rabatte siehst du vor dem Kaufabschluss im Checkout.";
export const LISTING_DECISION_TRUST_NOTE =
  "Preis, Bestand und Kategoriepfade bleiben servergeführt. Versandkosten und finale Rabatte siehst du erst verbindlich vor dem Kaufabschluss im Checkout.";
export const COMPARE_TRUST_NOTE =
  "Vergleiche helfen bei der Vorauswahl. Preis- und Bestandsstand kommen aus dem Katalog, die finale Versand- und Rabattlogik bleibt serverseitig bis zum Checkout.";
export const PDP_DECISION_TRUST_NOTE =
  "Eignungshinweise helfen bei der Vorauswahl. Preis, Bestand, Versand und Rabatte bleiben bis zum Checkout servergeführt und nachvollziehbar.";

export const getFreeShippingActiveMessage = (language: "de" | "en" = "de") =>
  language === "en" ? "Free shipping unlocked!" : "Kostenloser Versand aktiv!";

export const getFreeShippingRemainingMessage = (
  remainingLabel: string,
  language: "de" | "en" = "de",
) =>
  language === "en"
    ? `${remainingLabel} left until free shipping`
    : `Noch ${remainingLabel} bis zur versandkostenfreien Lieferung`;

export const ANNOUNCEMENT_ITEMS = {
  de: [
    `Kostenloser Versand ab ${FREE_SHIPPING_THRESHOLD_LABEL}`,
    `${RETURNS_WINDOW_DAYS} Tage Rückgabe`,
    "Sichere Zahlung",
  ],
  en: [
    `Free shipping from EUR ${FREE_SHIPPING_THRESHOLD_EUR.toFixed(0)}`,
    `${RETURNS_WINDOW_DAYS}-day returns`,
    "Secure payment",
  ],
} as const;

