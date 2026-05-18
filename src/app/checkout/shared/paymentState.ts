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

export const readCheckoutPaymentState = (): CheckoutPaymentState | null => {
  if (!canUseWindow()) return null;

  const raw = window.sessionStorage.getItem(CHECKOUT_PAYMENT_STATE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CheckoutPaymentState;
    if (
      !parsed ||
      typeof parsed.clientSecret !== "string" ||
      typeof parsed.editToken !== "string" ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.successUrl !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const writeCheckoutPaymentState = (value: CheckoutPaymentState) => {
  if (!canUseWindow()) return;
  window.sessionStorage.setItem(
    CHECKOUT_PAYMENT_STATE_KEY,
    JSON.stringify(value),
  );
};

export const clearCheckoutPaymentState = () => {
  if (!canUseWindow()) return;
  window.sessionStorage.removeItem(CHECKOUT_PAYMENT_STATE_KEY);
};
