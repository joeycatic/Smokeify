"use client";

const CONSENT_KEY = "smokeify_cookie_consent";

const readCookieValue = (key: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]+)`));
  return match?.[1] ?? null;
};

const readStatus = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  const fromCookie = readCookieValue(key);
  if (fromCookie) {
    window.localStorage.setItem(key, fromCookie);
  }
  return fromCookie;
};

export const canUseAnalytics = (): boolean => {
  const consent = readStatus(CONSENT_KEY);
  return consent === "accepted";
};

export const trackAnalyticsEvent = (
  eventName: string,
  params?: Record<string, unknown>
) => {
  if (typeof window === "undefined") return;
  if (!canUseAnalytics()) return;
  const dataLayer = (window as { dataLayer?: Array<Record<string, unknown>> })
    .dataLayer;
  if (!Array.isArray(dataLayer)) return;
  dataLayer.push({ event: eventName, ...(params ?? {}) });
};
