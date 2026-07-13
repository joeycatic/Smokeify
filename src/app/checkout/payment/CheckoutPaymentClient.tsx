"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  clearCheckoutPaymentStateHash,
  clearCheckoutPaymentState,
  readCheckoutPaymentState,
  readCheckoutPaymentStateFromHash,
  writeCheckoutPaymentState,
  type CheckoutPaymentState,
  type CheckoutSummarySnapshot,
} from "@/app/checkout/shared/paymentState";
import { trackAnalyticsEvent } from "@/lib/analytics";

const PAYMENT_INFO_TRACK_STORAGE_PREFIX = "smokeify.checkout.add-payment-info:";
const PAYMENT_VIEW_TRACK_STORAGE_PREFIX = "smokeify.checkout.payment-view:";
const PAYMENT_REDIRECT_TRACK_STORAGE_PREFIX = "smokeify.checkout.payment-redirect:";
const VIVA_AUTO_REDIRECT_STORAGE_PREFIX = "smokeify.checkout.viva-auto-redirect:";

const hasWindow = () => typeof window !== "undefined";

const getVivaAutoRedirectStorageKey = (orderCode: string) =>
  `${VIVA_AUTO_REDIRECT_STORAGE_PREFIX}${orderCode}`;

type CheckoutSessionSummaryResponse = {
  error?: string;
  paymentStatus?: string | null;
  status?: string | null;
  summary?: CheckoutSummarySnapshot | null;
};

function VivaComLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 text-[var(--smk-text)] ${className}`}
      aria-label="viva.com"
    >
      <svg aria-hidden="true" viewBox="0 0 64 40" className="h-8 w-[52px] shrink-0" fill="none">
        <path
          d="M3.5 9.7 13 32.8a4.1 4.1 0 0 0 7.6 0l10-23.1M30.6 9.7l10 23.1a4.1 4.1 0 0 0 7.6 0l9.5-23.1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <path
          d="m20.5 7.2 10.1 23.6M40.4 30.8 50.5 7.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
      </svg>
      <span className="text-3xl font-bold leading-none tracking-normal">viva.com</span>
    </span>
  );
}
const toAnalyticsItems = (summary: CheckoutSummarySnapshot) =>
  summary.items.map((item) => ({
    item_id: item.variantId,
    item_name: item.name,
    price:
      item.quantity > 0 ? item.lineTotalCents / item.quantity / 100 : undefined,
    quantity: item.quantity,
  }));

const formatMoney = (cents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);

export default function CheckoutPaymentClient() {
  const router = useRouter();
  const redirectStarted = useRef(false);
  const [paymentState, setPaymentState] = useState<CheckoutPaymentState | null>(null);
  const [summary, setSummary] = useState<CheckoutSummarySnapshot | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [autoRedirected, setAutoRedirected] = useState(false);

  const markAutoRedirected = useCallback((orderCode: string) => {
    if (!hasWindow()) return;
    window.sessionStorage.setItem(getVivaAutoRedirectStorageKey(orderCode), "1");
    setAutoRedirected(true);
  }, []);

  const trackPaymentRedirectStarted = useCallback(
    (state: CheckoutPaymentState, currentSummary: CheckoutSummarySnapshot | null) => {
      if (!hasWindow()) return;
      const storageKey = `${PAYMENT_REDIRECT_TRACK_STORAGE_PREFIX}${state.orderCode}`;
      if (window.sessionStorage.getItem(storageKey) === "1") return;
      window.sessionStorage.setItem(storageKey, "1");
      trackAnalyticsEvent("payment_redirect_started", {
        currency: currentSummary?.currency ?? state.summary.currency,
        items: currentSummary ? toAnalyticsItems(currentSummary) : toAnalyticsItems(state.summary),
        payment_type: "viva_smart_checkout",
        value: (currentSummary?.totalCents ?? state.summary.totalCents) / 100,
      });
    },
    [],
  );

  const startVivaRedirect = useCallback(() => {
    if (!paymentState?.checkoutUrl || !paymentState.orderCode || !hasWindow()) return;
    redirectStarted.current = true;
    trackPaymentRedirectStarted(paymentState, summary);
    markAutoRedirected(paymentState.orderCode);
    window.location.assign(paymentState.checkoutUrl);
  }, [markAutoRedirected, paymentState, summary, trackPaymentRedirectStarted]);

  useEffect(() => {
    const controller = new AbortController();
    const initialize = async () => {
      const hashState = readCheckoutPaymentStateFromHash();
      const stored = readCheckoutPaymentState() ?? hashState;
      if (!stored) {
        setLoadState("error");
        setPageError("Keine aktive Checkout-Session gefunden.");
        return;
      }

      if (hashState) {
        writeCheckoutPaymentState(hashState);
        clearCheckoutPaymentStateHash();
      }

      setPaymentState(stored);
      setSummary(stored.summary);
      setAutoRedirected(
        hasWindow() &&
          window.sessionStorage.getItem(getVivaAutoRedirectStorageKey(stored.orderCode)) === "1",
      );

      try {
        const params = new URLSearchParams({
          editToken: stored.editToken,
          sessionId: stored.sessionId || stored.orderCode,
        });
        const res = await fetch(`/api/checkout/session?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data =
          (await res.json().catch(() => null)) as CheckoutSessionSummaryResponse | null;
        if (!res.ok || !data?.summary) {
          throw new Error(data?.error ?? "Checkout-Session konnte nicht geladen werden.");
        }
        if (data.status === "paid") {
          clearCheckoutPaymentState();
          window.location.assign(stored.successUrl);
          return;
        }
        if (data.status === "cancelled") {
          throw new Error("Diese Checkout-Session wurde abgebrochen.");
        }
        setSummary(data.summary);
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadState("error");
        setPageError(
          error instanceof Error
            ? error.message
            : "Checkout-Session konnte nicht geladen werden.",
        );
      }
    };

    void initialize();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!paymentState || !summary || loadState !== "ready") return;
    const viewStorageKey = `${PAYMENT_VIEW_TRACK_STORAGE_PREFIX}${paymentState.orderCode}`;
    if (hasWindow() && window.sessionStorage.getItem(viewStorageKey) !== "1") {
      window.sessionStorage.setItem(viewStorageKey, "1");
      trackAnalyticsEvent("checkout_payment_view", {
        currency: summary.currency,
        items: toAnalyticsItems(summary),
        payment_type: "viva_smart_checkout",
        value: summary.totalCents / 100,
      });
    }
    const storageKey = `${PAYMENT_INFO_TRACK_STORAGE_PREFIX}${paymentState.orderCode}`;
    if (hasWindow() && window.sessionStorage.getItem(storageKey) === "1") return;
    if (hasWindow()) window.sessionStorage.setItem(storageKey, "1");
    trackAnalyticsEvent("add_payment_info", {
      currency: summary.currency,
      items: toAnalyticsItems(summary),
      payment_type: "viva_smart_checkout",
      value: summary.totalCents / 100,
    });
  }, [loadState, paymentState, summary]);

  useEffect(() => {
    if (
      !paymentState?.checkoutUrl ||
      !paymentState.orderCode ||
      redirectStarted.current ||
      autoRedirected ||
      loadState !== "ready"
    ) {
      return;
    }
    redirectStarted.current = true;
    const timer = window.setTimeout(() => {
      trackPaymentRedirectStarted(paymentState, summary);
      markAutoRedirected(paymentState.orderCode);
      window.location.assign(paymentState.checkoutUrl);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    autoRedirected,
    loadState,
    markAutoRedirected,
    paymentState,
    summary,
    trackPaymentRedirectStarted,
  ]);

  const cancelDraft = async () => {
    if (!paymentState) {
      router.push("/cart");
      return;
    }
    try {
      await fetch("/api/checkout/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editToken: paymentState.editToken,
          sessionId: paymentState.orderCode,
        }),
      });
    } finally {
      if (hasWindow()) {
        window.sessionStorage.removeItem(getVivaAutoRedirectStorageKey(paymentState.orderCode));
      }
      clearCheckoutPaymentState();
      router.push("/cart");
    }
  };

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="rounded-[30px] border border-[var(--smk-border)] bg-[color:var(--gv-dark)] p-6 shadow-[var(--gv-shadow-lg)]">
          <div className="rounded-2xl border border-[var(--smk-error)]/30 bg-[color:var(--gv-error)]/10 px-4 py-3 text-sm text-[var(--smk-error)]">
            {pageError ?? "Checkout-Session konnte nicht geladen werden."}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => router.push("/checkout/start")} className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold">
              Zur Adresse zurück
            </button>
            <button type="button" onClick={() => router.push("/cart")} className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold">
              Zum Warenkorb
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!paymentState || !summary || loadState === "loading") {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <LoadingSpinner size="md" className="border-white/15 border-t-[var(--smk-accent)]" />
        <p className="mt-4 text-sm text-[var(--smk-text-muted)]">Zahlungsseite wird vorbereitet...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--smk-text-dim)]">
            Checkout
          </p>
          <h1 className="smk-heading mt-2 text-3xl text-[var(--smk-text)] sm:text-4xl">
            Zahlung abschließen
          </h1>
        </div>
        <button type="button" onClick={() => router.push("/checkout/start")} className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold">
          Adresse ändern
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[30px] border border-[var(--smk-border)] bg-[color:var(--gv-dark)] p-6 shadow-[var(--gv-shadow-lg)]">
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--smk-border)] pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                Zahlungsanbieter
              </p>
              <VivaComLogo className="mt-2" />
            </div>
          </div>

          <div className="flex items-start gap-4">
            {!autoRedirected ? (
              <LoadingSpinner size="md" className="mt-1 border-white/15 border-t-[var(--smk-accent)]" />
            ) : null}
            <div>
              <h2 className="text-xl font-semibold text-[var(--smk-text)]">
                {autoRedirected ? "Zahlung fortsetzen" : "Weiter zu Viva Smart Checkout"}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--smk-text-muted)]">
                {autoRedirected
                  ? "Du bist vom Viva Checkout zurückgekehrt. Du kannst die Zahlung erneut öffnen, deine Lieferdaten prüfen oder den Checkout abbrechen."
                  : "Du wirst zur sicheren Viva-Zahlungsseite weitergeleitet. Dort kannst du mit den für Smokeify aktivierten Zahlungsarten bezahlen."}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={paymentState.checkoutUrl}
              className="smk-button-primary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
              onClick={() => {
                redirectStarted.current = true;
                markAutoRedirected(paymentState.orderCode);
              }}
            >
              Jetzt bezahlen
            </a>
            <button type="button" onClick={startVivaRedirect} className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold">
              Weiterleitung erneut starten
            </button>
            <button type="button" onClick={() => router.push("/checkout/start")} className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold">
              Lieferdaten prüfen
            </button>
            <button type="button" onClick={() => void cancelDraft()} className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold">
              Abbrechen
            </button>
          </div>
        </section>

        <aside className="rounded-[30px] border border-[var(--smk-border)] bg-[color:var(--gv-dark)] p-6 shadow-[var(--gv-shadow-lg)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Bestellübersicht</p>
          <div className="mt-4 space-y-3">
            {summary.items.map((item) => (
              <div key={`${item.variantId}-${item.name}`} className="flex items-center gap-3 rounded-[22px] border border-[var(--smk-border)] bg-[color:var(--gv-surface)] p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" /> : null}</div>
                <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold text-[var(--smk-text)]">{item.name}</p><p className="mt-1 text-xs text-[var(--smk-text-muted)]">Menge {item.quantity}</p></div>
                <p className="text-sm font-semibold text-[var(--smk-text)]">{formatMoney(item.lineTotalCents, summary.currency)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3 rounded-[24px] border border-[var(--smk-border)] bg-[color:var(--gv-surface)] p-4">
            <div className="flex items-center justify-between text-sm text-[var(--smk-text-muted)]"><span>Zwischensumme</span><span>{formatMoney(summary.subtotalCents, summary.currency)}</span></div>
            {(summary.discountCents ?? 0) > 0 ? <div className="flex items-center justify-between text-sm text-[var(--smk-text-muted)]"><span>Rabatt</span><span>-{formatMoney(summary.discountCents ?? 0, summary.currency)}</span></div> : null}
            <div className="flex items-center justify-between text-sm text-[var(--smk-text-muted)]"><span>Versand</span><span>{formatMoney(summary.shippingCents, summary.currency)}</span></div>
            <div className="flex items-center justify-between text-base font-semibold text-[var(--smk-text)]"><span>Gesamt</span><span>{formatMoney(summary.totalCents, summary.currency)}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
