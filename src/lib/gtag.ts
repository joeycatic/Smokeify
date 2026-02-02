"use client";

type GtagFn = (...args: unknown[]) => void;

const getGtag = (): GtagFn | null => {
  if (typeof window === "undefined") return null;
  const gtag = (window as { gtag?: GtagFn }).gtag;
  return typeof gtag === "function" ? gtag : null;
};

export const trackGtagEvent = (eventName: string, params?: Record<string, unknown>) => {
  const gtag = getGtag();
  if (!gtag) return;
  if (params) {
    gtag("event", eventName, params);
    return;
  }
  gtag("event", eventName);
};
