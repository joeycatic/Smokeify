"use client";

import type { StripeCheckoutContact } from "@stripe/stripe-js";

const CHECKOUT_PAYMENT_STATE_KEY = "smokeify.checkout.payment-state";

export type CheckoutSummaryItem = {
  imageUrl: string | null;
  lineTotalCents: number;
  name: string;
  quantity: number;
  variantId: string;
};

export type CheckoutSummarySnapshot = {
  currency: string;
  discountCents?: number;
  items: CheckoutSummaryItem[];
  shippingCents: number;
  subtotalCents: number;
  totalCents: number;
};

export type CheckoutPaymentFormValues = {
  city: string;
  country: string;
  email: string;
  firstName: string;
  houseNumber: string;
  lastName: string;
  packstationNumber: string;
  postalCode: string;
  postNumber: string;
  shippingAddressType: "STREET" | "PACKSTATION";
  street: string;
};

export type CheckoutPaymentState = {
  clientSecret: string;
  contact: StripeCheckoutContact;
  editToken: string;
  formValues: CheckoutPaymentFormValues;
  sessionId: string;
  successUrl: string;
  summary: CheckoutSummarySnapshot;
};

const canUseWindow = () => typeof window !== "undefined";

const STRIPE_ALLOWED_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "CA",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "NZ",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "US",
]);

const normalizeStripeCountryCode = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  const aliases: Record<string, string> = {
    DEU: "DE",
    GERMANY: "DE",
    DEUTSCHLAND: "DE",
    AUT: "AT",
    AUSTRIA: "AT",
    OESTERREICH: "AT",
    CHE: "CH",
    SWITZERLAND: "CH",
    SCHWEIZ: "CH",
    UK: "GB",
    GBR: "GB",
    "UNITED KINGDOM": "GB",
    "GREAT BRITAIN": "GB",
    USA: "US",
    "UNITED STATES": "US",
  };
  const candidate = aliases[normalized] ?? normalized;
  return STRIPE_ALLOWED_COUNTRIES.has(candidate) ? candidate : null;
};

const sanitizeContact = (contact: CheckoutPaymentState["contact"]) => {
  const address = contact.address ? { ...contact.address } : undefined;
  if (!address) return contact;

  const country = normalizeStripeCountryCode(address.country);
  const sanitizedAddress = country
    ? { ...address, country }
    : Object.fromEntries(
        Object.entries(address).filter(([key]) => key !== "country"),
      );

  return {
    ...contact,
    address: sanitizedAddress as CheckoutPaymentState["contact"]["address"],
  };
};

const normalizeCheckoutPaymentState = (value: unknown): CheckoutPaymentState | null => {
  const parsed = value as CheckoutPaymentState | null;
  if (
    !parsed ||
    typeof parsed.clientSecret !== "string" ||
    typeof parsed.editToken !== "string" ||
    typeof parsed.sessionId !== "string" ||
    typeof parsed.successUrl !== "string" ||
    !parsed.contact ||
    !parsed.summary
  ) {
    return null;
  }

  return {
    ...parsed,
    contact: sanitizeContact(parsed.contact),
  };
};

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const decodeBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const readCheckoutPaymentState = (): CheckoutPaymentState | null => {
  if (!canUseWindow()) return null;

  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_PAYMENT_STATE_KEY);
    if (!raw) return null;
    return normalizeCheckoutPaymentState(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeCheckoutPaymentState = (value: CheckoutPaymentState) => {
  if (!canUseWindow()) return;
  try {
    window.sessionStorage.setItem(
      CHECKOUT_PAYMENT_STATE_KEY,
      JSON.stringify(value),
    );
  } catch {
    // Some browsers block sessionStorage. The payment page can still recover from the URL fragment.
  }
};

export const clearCheckoutPaymentState = () => {
  if (!canUseWindow()) return;
  try {
    window.sessionStorage.removeItem(CHECKOUT_PAYMENT_STATE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
};

export const buildCheckoutPaymentStateHash = (value: CheckoutPaymentState) => {
  if (!canUseWindow()) return "";
  return `state=${encodeURIComponent(encodeBase64Url(JSON.stringify(value)))}`;
};

export const readCheckoutPaymentStateFromHash = (): CheckoutPaymentState | null => {
  if (!canUseWindow()) return null;
  const raw = new URLSearchParams(window.location.hash.slice(1)).get("state");
  if (!raw) return null;
  try {
    return normalizeCheckoutPaymentState(JSON.parse(decodeBase64Url(raw)));
  } catch {
    return null;
  }
};

export const clearCheckoutPaymentStateHash = () => {
  if (!canUseWindow()) return;
  if (!window.location.hash.includes("state=")) return;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
};
