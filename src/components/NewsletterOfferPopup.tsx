"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { XMarkIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  formatDiscountAmount,
  formatNewsletterOfferActiveUntil,
  isNewsletterOfferActive,
  NEWSLETTER_OFFER_POPUP_STORAGE_KEY,
  NEWSLETTER_OFFER_SUCCESS_STORAGE_KEY,
} from "@/lib/newsletterOffer";

const HIDDEN_PATH_PREFIXES = [
  "/admin",
  "/auth",
  "/checkout",
  "/order",
];

const HIDDEN_PATHS = new Set(["/cart"]);

export default function NewsletterOfferPopup() {
  const pathname = usePathname();
  const { status: sessionStatus } = useSession();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [offerEligibility, setOfferEligibility] = useState<
    "unknown" | "eligible" | "claimed"
  >("unknown");
  const discountLabel = useMemo(() => formatDiscountAmount(), []);
  const compactDiscountLabel = "5 €";
  const activeUntilLabel = useMemo(() => formatNewsletterOfferActiveUntil(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (sessionStatus === "loading") return;
    if (sessionStatus !== "authenticated") {
      setOfferEligibility("eligible");
      return;
    }

    let cancelled = false;
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/newsletter/offer/status", {
          method: "GET",
        });
        const data = (await res.json().catch(() => null)) as {
          eligible?: boolean;
        } | null;
        if (cancelled) return;
        setOfferEligibility(data?.eligible === false ? "claimed" : "eligible");
      } catch {
        if (cancelled) return;
        setOfferEligibility("eligible");
      }
    };

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [mounted, sessionStatus]);

  useEffect(() => {
    if (!mounted) return;
    if (offerEligibility !== "eligible") return;
    if (!isNewsletterOfferActive()) return;
    if (!pathname) return;
    if (HIDDEN_PATHS.has(pathname)) return;
    if (HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return;
    }
    if (window.sessionStorage.getItem(NEWSLETTER_OFFER_POPUP_STORAGE_KEY)) return;
    if (window.sessionStorage.getItem(NEWSLETTER_OFFER_SUCCESS_STORAGE_KEY)) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      trackAnalyticsEvent("view_promotion", {
        creative_name: "newsletter_offer_popup",
        promotion_id: "newsletter-offer-popup",
        promotion_name: "Newsletter Angebot 5 Euro",
      });
    }, 7000);

    return () => window.clearTimeout(timer);
  }, [mounted, offerEligibility, pathname]);

  if (!mounted || !open) return null;

  const dismiss = () => {
    window.sessionStorage.setItem(
      NEWSLETTER_OFFER_POPUP_STORAGE_KEY,
      new Date().toISOString(),
    );
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/45 px-4 pb-4 pt-10 sm:items-center sm:p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#d7c07a] bg-[linear-gradient(180deg,#17392e_0%,#23473a_55%,#f7f3e8_55%,#f7f3e8_100%)] shadow-[0_32px_90px_rgba(15,23,42,0.32)]">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17392e]"
          aria-label="Popup schließen"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="px-6 pb-6 pt-8 text-white sm:px-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e4c56c]/30 bg-[#e4c56c]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f7df9a]">
            <SparklesIcon className="h-4 w-4" />
            Zeitlich begrenztes Angebot
          </div>
          <h2 className="mt-4 text-3xl font-black leading-tight">
            {compactDiscountLabel} Rabatt
            <br />
            für deine erste E-Mail-Anmeldung
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">
            Trage deine E-Mail-Adresse ein und wir senden dir sofort einen persönlichen Rabattcode über {discountLabel}.
          </p>
          {activeUntilLabel ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#f7df9a]">
              Gültig bis {activeUntilLabel}
            </p>
          ) : null}
        </div>

        <div className="bg-[#f7f3e8] px-6 pb-6 pt-5 text-[#1f2f28] sm:px-7 sm:pb-7">
          <div className="rounded-2xl border border-[#d7c07a]/70 bg-white/80 p-4">
            <p className="text-sm font-semibold text-[#1f2f28]">
              Was du bekommst
            </p>
            <ul className="mt-2 space-y-1 text-sm text-stone-700">
              <li>{discountLabel} Rabattcode per E-Mail</li>
              <li>Einmalig als Rabattcode im Warenkorb einlösbar</li>
            </ul>
          </div>

          <form
            className="mt-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const trimmedEmail = email.trim();
              if (!trimmedEmail) {
                setStatus("error");
                setMessage("Bitte eine gültige E-Mail-Adresse eingeben.");
                return;
              }
              setStatus("loading");
              setMessage(null);
              try {
                const res = await fetch("/api/newsletter/offer", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: trimmedEmail }),
                });
                const data = (await res.json().catch(() => null)) as {
                  message?: string;
                  error?: string;
                } | null;
                if (!res.ok) {
                  setStatus("error");
                  setMessage(data?.error ?? "Das Angebot konnte nicht aktiviert werden.");
                  return;
                }
                window.sessionStorage.setItem(
                  NEWSLETTER_OFFER_SUCCESS_STORAGE_KEY,
                  new Date().toISOString(),
                );
                setOfferEligibility("claimed");
                setStatus("ok");
                setMessage(
                  data?.message ??
                    "Dein Rabattcode wurde an deine E-Mail-Adresse gesendet.",
                );
                trackAnalyticsEvent("generate_lead", {
                  method: "newsletter_offer_popup",
                });
                setEmail("");
              } catch {
                setStatus("error");
                setMessage("Das Angebot konnte nicht aktiviert werden.");
              }
            }}
          >
            <label
              htmlFor="newsletter-offer-email"
              className="block text-xs font-semibold uppercase tracking-[0.16em] text-stone-600"
            >
              E-Mail-Adresse
            </label>
            <input
              id="newsletter-offer-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@beispiel.de"
              className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-stone-900 outline-none transition focus:border-[#2f3e36] focus-visible:ring-2 focus-visible:ring-emerald-700/30 focus-visible:ring-offset-2"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:shadow-emerald-900/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading"
                ? "Rabattcode wird gesendet..."
                : `${compactDiscountLabel} per E-Mail sichern`}
            </button>
          </form>

          <p className="mt-3 text-[11px] leading-5 text-stone-500">
            Mit deiner Anmeldung stimmst du zu, Marketing-E-Mails von Smokeify zu erhalten. Abmeldung jederzeit möglich.
          </p>

          {message ? (
            <p
              className={`mt-3 text-sm font-semibold ${
                status === "ok" ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
