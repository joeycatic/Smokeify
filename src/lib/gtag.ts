"use client";

type GtagFn = (...args: unknown[]) => void;

const CONSENT_KEY = "smokeify_cookie_consent";
const AGE_KEY = "smokeify_age_gate";
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

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
  const ageGate = readStatus(AGE_KEY);
  return consent === "accepted" && ageGate === "verified";
};

const getGtag = (): GtagFn | null => {
  if (typeof window === "undefined") return null;
  const gtag = (window as { gtag?: GtagFn }).gtag;
  return typeof gtag === "function" ? gtag : null;
};

export const trackGtagEvent = (eventName: string, params?: Record<string, unknown>) => {
  const gtag = getGtag();
  if (!gtag) return;
  if (!canUseAnalytics()) return;
  if (params) {
    gtag("event", eventName, params);
    return;
  }
  gtag("event", eventName);
};

export const trackAdsConversion = (
  label: string | undefined,
  params?: Record<string, unknown>,
) => {
  const gtag = getGtag();
  if (!gtag) return;
  if (!canUseAnalytics()) return;
  if (!GOOGLE_ADS_ID || !label) return;
  gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    ...(params ?? {}),
  });
};
