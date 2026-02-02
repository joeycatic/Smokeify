"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const CONSENT_KEY = "smokeify_cookie_consent";
const AGE_KEY = "smokeify_age_gate";

function readCookieValue(key: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]+)`));
  return match?.[1] ?? null;
}

function readStatus(key: string): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  const fromCookie = readCookieValue(key);
  if (fromCookie) {
    window.localStorage.setItem(key, fromCookie);
  }
  return fromCookie;
}

function canLoadAnalytics(): boolean {
  const consent = readStatus(CONSENT_KEY);
  const ageGate = readStatus(AGE_KEY);
  return consent === "accepted" && ageGate === "verified";
}

export default function GoogleTag() {
  const googleTagId = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!googleTagId) return;
    setEnabled(canLoadAnalytics());

    const handler = () => setEnabled(canLoadAnalytics());
    window.addEventListener("cookie-consent-accepted", handler);
    window.addEventListener("age-gate-verified", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cookie-consent-accepted", handler);
      window.removeEventListener("age-gate-verified", handler);
      window.removeEventListener("storage", handler);
    };
  }, [googleTagId]);

  if (!googleTagId || !enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag("js", new Date());
          gtag("config", "${googleTagId}");
        `}
      </Script>
    </>
  );
}
