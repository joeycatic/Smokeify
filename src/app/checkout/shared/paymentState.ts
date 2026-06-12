"use client";

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
  checkoutUrl: string;
  discountCode?: string;
  editToken: string;
  failureUrl?: string;
  formValues: CheckoutPaymentFormValues;
  orderCode: string;
  sessionId: string;
  successUrl: string;
  summary: CheckoutSummarySnapshot;
};

const canUseWindow = () => typeof window !== "undefined";

const normalizeCheckoutPaymentState = (value: unknown): CheckoutPaymentState | null => {
  const parsed = value as CheckoutPaymentState | null;
  if (
    !parsed ||
    typeof parsed.checkoutUrl !== "string" ||
    typeof parsed.editToken !== "string" ||
    typeof parsed.orderCode !== "string" ||
    typeof parsed.successUrl !== "string" ||
    !parsed.summary
  ) {
    return null;
  }
  return {
    ...parsed,
    sessionId: parsed.sessionId || parsed.orderCode,
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
    window.sessionStorage.setItem(CHECKOUT_PAYMENT_STATE_KEY, JSON.stringify(value));
  } catch {
    // The payment page can still recover from the URL fragment fallback.
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
