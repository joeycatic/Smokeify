"use client";

import { useEffect, useState } from "react";

type ConsentValue = "accepted" | "declined" | null;

const STORAGE_KEY = "smokeify_cookie_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

function readConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "accepted" || stored === "declined") {
    return stored;
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${STORAGE_KEY}=([^;]+)`)
  );
  const value = match?.[1];
  if (value === "accepted" || value === "declined") {
    window.localStorage.setItem(STORAGE_KEY, value);
    return value;
  }
  return null;
}

function persistConsent(value: Exclude<ConsentValue, null>) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  window.localStorage.setItem(STORAGE_KEY, value);
  document.cookie = `${STORAGE_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<ConsentValue>(null);

  useEffect(() => {
    setConsent(readConsent());
  }, []);

  if (consent) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-3xl rounded-2xl border border-black/10 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 text-sm text-stone-700">
          <p className="text-xs font-semibold tracking-widest text-black/60">
            COOKIES
          </p>
          <p>
            Wir nutzen notwendige Cookies für Login, Sicherheit und Warenkorb.
            Optionale Analytics-Cookies sind deaktiviert, bis du zustimmst.
          </p>
          <p>
            Mehr Infos in unserer{" "}
            <a
              href="/pages/privacy"
              className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-900"
            >
              DSGVO
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              persistConsent("declined");
              setConsent("declined");
            }}
            className="h-11 rounded-full border border-black/15 px-5 text-xs font-semibold text-stone-700 hover:border-black/30"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={() => {
              persistConsent("accepted");
              setConsent("accepted");
              window.dispatchEvent(new Event("cookie-consent-accepted"));
            }}
            className="h-11 rounded-full bg-[#E4C56C] px-5 text-xs font-semibold text-[#2f3e36] hover:opacity-90"
          >
            Zustimmen
          </button>
        </div>
      </div>
    </div>
  );
}
