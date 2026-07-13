"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CONSENT_ACCEPTED_EVENT,
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_KEY,
  COOKIE_CONSENT_SETTINGS_REQUESTED_EVENT,
  shouldShowCookieConsent,
} from "@/lib/analyticsShared";

type ConsentValue = "accepted" | "declined" | null;

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (stored === "accepted" || stored === "declined") return stored;
  } catch {
    // ignore
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ANALYTICS_CONSENT_KEY}=([^;]+)`)
  );
  const value = match?.[1];
  if (value === "accepted" || value === "declined") {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
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
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${ANALYTICS_CONSENT_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${
      secure ? "; Secure" : ""
    }`;
  } catch {
    // ignore
  }
}

export function clearConsent() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${ANALYTICS_CONSENT_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
}

function subscribeConsentChange(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === ANALYTICS_CONSENT_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onStoreChange);
  };
}

function dispatchConsent(value: Exclude<ConsentValue, null>) {
  persistConsent(value);
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
  if (value === "accepted") {
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_ACCEPTED_EVENT));
  }
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={
        disabled
          ? undefined
          : (event) => {
              event.stopPropagation();
              onChange?.();
            }
      }
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f] ${
        checked
          ? "border-[#1f5f3f] bg-[#1f5f3f]"
          : "border-[#c9d4cc] bg-[#e8ece8]"
      } ${disabled ? "cursor-default opacity-75" : "cursor-pointer hover:border-[#6f8d79]"}`}
    >
      <span
        className={`absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(20,45,30,0.18)] transition-transform ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function CookieConsent() {
  const pathname = usePathname() ?? "/";
  const showsConsentOnPath = shouldShowCookieConsent(pathname);
  const consent = useSyncExternalStore(
    subscribeConsentChange,
    readConsent,
    () => null
  );
  const [showDetails, setShowDetails] = useState(false);
  const [isOpen, setIsOpen] = useState(() => consent === null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    () => consent === "accepted"
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const openSettings = () => {
      setAnalyticsEnabled(readConsent() === "accepted");
      setShowDetails(true);
      setIsOpen(true);
    };

    window.addEventListener(
      COOKIE_CONSENT_SETTINGS_REQUESTED_EVENT,
      openSettings,
    );
    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_SETTINGS_REQUESTED_EVENT,
        openSettings,
      );
    };
  }, []);

  useEffect(() => {
    if (!showsConsentOnPath || !isOpen) {
      delete document.documentElement.dataset.cookieConsentOpen;
      return;
    }

    document.documentElement.dataset.cookieConsentOpen = "true";
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowDetails(false);
      setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      delete document.documentElement.dataset.cookieConsentOpen;
    };
  }, [isOpen, showsConsentOnPath]);

  const applyConsent = (value: Exclude<ConsentValue, null>) => {
    dispatchConsent(value);
    setShowDetails(false);
    setIsOpen(false);
  };

  const dismiss = () => {
    setShowDetails(false);
    setIsOpen(false);
  };

  if (!showsConsentOnPath || !isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-end bg-[#10251a]/55 backdrop-blur-[3px] sm:justify-end sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        className="relative flex h-[100dvh] w-full flex-col overflow-y-auto bg-[#f7f8f3] text-[#173323] shadow-[0_28px_90px_rgba(8,30,18,0.28)] sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:w-[min(34rem,calc(100vw-2.5rem))] sm:rounded-[2rem] sm:border sm:border-white/60"
      >
        <header className="relative overflow-hidden border-b border-[#d7e2d9] bg-[linear-gradient(135deg,#e8f3e9_0%,#f8f3e8_72%,#f3ddc9_100%)] px-5 pb-6 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-7 sm:pb-6 sm:pt-6">
          <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border border-[#7fa98b]/25" />
          <div className="pointer-events-none absolute -right-5 -top-7 h-24 w-24 rounded-full border border-[#bd6b42]/20" />
          <div className="relative flex items-start justify-between gap-5">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#8aac93]/35 bg-white/65 px-3 py-1 font-[family:var(--font-jetbrains-mono)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#326044]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4c9b68]" />
                Datenschutz
              </span>
              <h2
                id="cookie-consent-title"
                className="mt-4 max-w-sm font-[family:var(--font-syne)] text-[2rem] font-bold leading-[1.02] tracking-[-0.06em] text-[#173323] sm:text-[2.25rem]"
              >
                {showDetails
                  ? "Deine Cookie-Einstellungen"
                  : "Du entscheidest, was mitwächst."}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={dismiss}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#9eb5a4]/45 bg-white/75 text-[#31523d] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f]"
              aria-label="Cookie-Dialog ohne Auswahl schließen"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-7 sm:pt-6">
        {showDetails ? (
          <div className="flex flex-1 flex-col">
            <div className="mb-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-[#42604c] hover:text-[#173323] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f]"
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
                Zur Übersicht
              </button>
              <span className="rounded-full bg-[#e3eee5] px-3 py-1 text-[11px] font-semibold text-[#326044]">
                Jederzeit änderbar
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#d5e0d7] bg-white p-4 shadow-[0_10px_30px_rgba(33,74,48,0.05)]">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#173323]">
                    Notwendige Cookies
                    </p>
                    <span className="rounded-full bg-[#edf3ee] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#55705e]">
                      Immer aktiv
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#607267]">
                    Erforderlich für Warenkorb, Login, Sicherheit und
                    grundlegende Shopfunktionen. Diese Cookies können nicht
                    deaktiviert werden.
                  </p>
                </div>
                <Toggle checked disabled label="Notwendige Cookies sind aktiv" />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#d5e0d7] bg-white p-4 shadow-[0_10px_30px_rgba(33,74,48,0.05)]">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#173323]">
                      Analyse &amp; Statistiken
                    </p>
                    <span className="rounded-full bg-[#f7ecdf] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b593d]">
                      Optional
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#607267]">
                    Google Tag / Google Analytics hilft uns zu verstehen, wie
                    Besucher den Shop nutzen, damit wir ihn verbessern können.
                    Dabei können pseudonymisierte Nutzungsdaten verarbeitet
                    werden.
                  </p>
                </div>
                <Toggle
                  checked={analyticsEnabled}
                  onChange={() => setAnalyticsEnabled((v) => !v)}
                  label="Analyse und Statistik-Cookies umschalten"
                />
              </div>
            </div>

            <div className="mt-auto grid gap-2 pt-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => applyConsent("declined")}
                className="min-h-12 rounded-full border border-[#9db2a3] bg-white px-5 text-sm font-semibold text-[#294d36] transition hover:border-[#688875] hover:bg-[#f0f5f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f]"
              >
                Nur notwendige Cookies
              </button>
              <button
                type="button"
                onClick={() =>
                  applyConsent(analyticsEnabled ? "accepted" : "declined")
                }
                className="min-h-12 rounded-full bg-[#1f5f3f] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,95,63,0.2)] transition hover:bg-[#174c32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f]"
              >
                Einstellungen speichern
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <p className="max-w-[45ch] text-sm leading-6 text-[#53675a]">
              Notwendige Cookies halten Warenkorb, Login und Sicherheit am
              Laufen. Analyse-Cookies helfen uns, Smokeify zu verbessern –
              aber erst, wenn du ausdrücklich zustimmst.{" "}
                <Link
                  href="/datenschutz"
                className="font-medium text-[#315d40] underline decoration-[#8da897] underline-offset-4 hover:text-[#173323]"
                >
                  Datenschutzerklärung
                </Link>
            </p>

            <div className="my-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.35rem] border border-[#d5e0d7] bg-white p-4 shadow-[0_10px_30px_rgba(33,74,48,0.05)]">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d7765]">
                  Notwendig
                </span>
                <p className="mt-2 text-sm font-semibold text-[#173323]">
                  Shop funktioniert
                </p>
                <p className="mt-1 text-xs leading-5 text-[#68796e]">
                  Warenkorb, Anmeldung und sichere Seitennutzung.
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-[#e7dacb] bg-[#fffaf4] p-4 shadow-[0_10px_30px_rgba(90,54,30,0.04)]">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#956247]">
                  Optional
                </span>
                <p className="mt-2 text-sm font-semibold text-[#4a3528]">
                  Shop wird besser
                </p>
                <p className="mt-1 text-xs leading-5 text-[#7d6b5f]">
                  Nutzungsstatistiken nur nach deiner Zustimmung.
                </p>
              </div>
            </div>

            <div className="mt-auto grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => applyConsent("declined")}
                className="min-h-12 rounded-full border border-[#9db2a3] bg-white px-5 text-sm font-semibold text-[#294d36] transition hover:border-[#688875] hover:bg-[#f0f5f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f]"
              >
                Nur notwendige
              </button>
              <button
                type="button"
                onClick={() => applyConsent("accepted")}
                className="min-h-12 rounded-full bg-[#1f5f3f] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,95,63,0.2)] transition hover:bg-[#174c32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f]"
              >
                Alle akzeptieren
              </button>
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="min-h-11 text-sm font-semibold text-[#526b5a] underline decoration-[#9eb2a4] underline-offset-4 hover:text-[#173323] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5f3f] sm:col-span-2"
              >
                Auswahl anpassen
              </button>
            </div>
          </div>
        )}
      </div>
      </section>
    </div>
  );
}
