"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

type ConsentValue = "accepted" | "declined" | null;

const STORAGE_KEY = "smokeify_cookie_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted" || stored === "declined") return stored;
  } catch {
    // ignore
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${STORAGE_KEY}=([^;]+)`)
  );
  const value = match?.[1];
  if (value === "accepted" || value === "declined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    return value;
  }
  return null;
}

function persistConsent(value: Exclude<ConsentValue, null>) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${STORAGE_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${
      secure ? "; Secure" : ""
    }`;
  } catch {
    // ignore
  }
}

export function clearConsent() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("smokeify-cookie-consent-change"));
}

function subscribeConsentChange(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("smokeify-cookie-consent-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(
      "smokeify-cookie-consent-change",
      onStoreChange
    );
  };
}

function dispatchConsent(value: Exclude<ConsentValue, null>) {
  persistConsent(value);
  window.dispatchEvent(new Event("smokeify-cookie-consent-change"));
  if (value === "accepted")
    window.dispatchEvent(new Event("cookie-consent-accepted"));
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        checked ? "bg-[#2f3e36]" : "bg-stone-300"
      } ${disabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function CookieConsent() {
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const consent = useSyncExternalStore(
    subscribeConsentChange,
    readConsent,
    () => null
  );

  // After consent is saved, show a subtle re-open button so users can change their choice
  if (consent) {
    return (
      <button
        type="button"
        onClick={clearConsent}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-400 shadow-sm transition hover:border-stone-300 hover:text-stone-600"
        aria-label="Cookie-Einstellungen ändern"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M21.598 11.064a1.006 1.006 0 0 0-.854-.172A2.938 2.938 0 0 1 20 11c-1.654 0-3-1.346-3.003-2.937.005-.034.016-.136.017-.17a1 1 0 0 0-1.263-1.02A2.987 2.987 0 0 1 15 7c-1.654 0-3-1.346-3-3 0-.217.031-.444.09-.663a1 1 0 0 0-1.17-1.23A10.014 10.014 0 0 0 2 12c0 5.514 4.486 10 10 10s10-4.486 10-10c0-.049-.003-.097-.003-.146a1.002 1.002 0 0 0-.399-.79zM12 20c-4.411 0-8-3.589-8-8a8.006 8.006 0 0 1 6.693-7.855C10.533 4.756 10.5 4.88 10.5 5c0 2.757 2.243 5 5 5 .036 0 .07-.002.106-.003C15.748 11.393 17.286 13 19.218 13c.2 0 .4-.017.597-.046A8.006 8.006 0 0 1 12 20z" />
          <circle cx="7" cy="13" r="1.5" />
          <circle cx="10" cy="17" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </svg>
        Cookies
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie-Einstellungen"
      className="fixed bottom-0 left-0 right-0 z-50 w-full border-t border-stone-200 bg-white shadow-[0_-4px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {showDetails ? (
          /* ── Settings panel ── */
          <div>
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Zurück
              </button>
              <span className="text-sm font-semibold text-stone-800">
                Cookie-Einstellungen
              </span>
            </div>

            <div className="mb-4 space-y-3">
              {/* Necessary — always on */}
              <div className="flex items-start gap-4 rounded-xl border border-stone-200 p-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-stone-900">
                    Notwendige Cookies
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Erforderlich für Warenkorb, Login, Sicherheit und
                    grundlegende Shopfunktionen. Diese Cookies können nicht
                    deaktiviert werden.
                  </p>
                </div>
                <Toggle checked disabled />
              </div>

              {/* Analytics — opt-in */}
              <div className="flex items-start gap-4 rounded-xl border border-stone-200 p-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-stone-900">
                    Analyse &amp; Statistiken
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Google Analytics – hilft uns zu verstehen, wie Besucher den
                    Shop nutzen, damit wir ihn verbessern können. Alle Daten
                    werden anonymisiert verarbeitet.
                  </p>
                </div>
                <Toggle
                  checked={analyticsEnabled}
                  onChange={() => setAnalyticsEnabled((v) => !v)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => dispatchConsent("declined")}
                className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50"
              >
                Nur notwendige Cookies
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatchConsent(analyticsEnabled ? "accepted" : "declined")
                }
                className="flex-1 rounded-xl bg-[#2f3e36] py-2.5 text-sm font-medium text-white hover:bg-[#44584c]"
              >
                Einstellungen speichern
              </button>
            </div>
          </div>
        ) : (
          /* ── Main banner ── */
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-1 text-sm text-stone-600">
              <p className="font-semibold text-stone-900">
                Wir verwenden Cookies
              </p>
              <p>
                Notwendige Cookies sind immer aktiv (Warenkorb, Login,
                Sicherheit). Optional setzen wir Analyse-Cookies ein, um den
                Shop zu verbessern – nur mit Ihrer Einwilligung.{" "}
                <Link
                  href="/pages/privacy"
                  className="underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
                >
                  Datenschutzerklärung
                </Link>
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => dispatchConsent("declined")}
                className="h-10 rounded-xl border border-stone-300 px-5 text-sm font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50"
              >
                Ablehnen
              </button>
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="h-10 px-3 text-sm font-medium text-stone-500 underline decoration-stone-400 underline-offset-2 hover:text-stone-700"
              >
                Einstellungen
              </button>
              <button
                type="button"
                onClick={() => dispatchConsent("accepted")}
                className="h-10 rounded-xl bg-[#2f3e36] px-5 text-sm font-medium text-white hover:bg-[#44584c]"
              >
                Alle akzeptieren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
