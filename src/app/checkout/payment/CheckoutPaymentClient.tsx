"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import CheckoutProgress from "@/app/checkout/start/components/CheckoutProgress";
import OrderSummary from "@/app/checkout/start/components/OrderSummary";
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
      className={`inline-flex items-center gap-2.5 text-[color:var(--gv-text)] ${className}`}
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

const checkoutPrimaryButtonClassName =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[color:var(--gv-lime)] px-4 text-sm font-semibold text-[color:var(--gv-forest)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";

const checkoutSecondaryButtonClassName =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 text-sm font-semibold text-[color:var(--gv-text)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/24 hover:bg-[color:var(--gv-lime)]/10";

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
      <div className="mx-auto flex min-h-[65vh] max-w-xl items-center px-4 py-12 text-center">
        <section className="gv-checkout-surface w-full rounded-[26px] px-6 py-8 sm:px-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-[18px] bg-amber-100 text-amber-800">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-[color:var(--gv-text)]">
            Checkout nicht gefunden
          </h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--gv-text-muted)]">
            {pageError ?? "Starte den Checkout bitte erneut aus deinem Warenkorb."}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push("/checkout/start")}
              className={checkoutPrimaryButtonClassName}
            >
              Lieferdaten öffnen
            </button>
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className={checkoutSecondaryButtonClassName}
            >
              Zum Warenkorb
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!paymentState || !summary || loadState === "loading") {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-4 py-12 text-center">
        <div className="gv-checkout-surface w-full rounded-[26px] px-6 py-8 sm:px-8">
          <LoadingSpinner
            size="md"
            className="mx-auto border-[color:var(--gv-lime)]/25 border-t-[color:var(--gv-lime)]"
          />
          <p className="mt-4 text-sm text-[color:var(--gv-text-muted)]">
            Zahlungsseite wird vorbereitet…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-6 sm:py-7 lg:px-8">
      <section className="gv-checkout-surface rounded-[22px] px-3 py-4 sm:px-5">
        <CheckoutProgress
          currentStep="payment"
          onStepClick={(step) => {
            if (step === "cart") router.push("/cart");
            if (step === "address") router.push("/checkout/start");
          }}
        />

        <div className="mt-4 grid gap-3 sm:mt-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:items-start lg:gap-5">
          <div className="order-2 min-w-0 rounded-[24px] bg-[linear-gradient(145deg,#edf6ef_0%,#ffffff_62%)] p-5 ring-1 ring-emerald-900/10 sm:p-7 lg:order-1">
            <div className="flex items-center justify-between gap-4 border-b border-emerald-950/8 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  Sicher bezahlen mit
                </p>
                <VivaComLogo className="mt-1.5" />
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-emerald-100 text-emerald-800">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-5 flex items-start gap-4">
              {!autoRedirected ? (
                <LoadingSpinner
                  size="md"
                  className="mt-1 border-[color:var(--gv-lime)]/30 border-t-[color:var(--gv-lime)]"
                />
              ) : null}
              <div>
                <h1 className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.04em] text-[color:var(--gv-text)]">
                  {autoRedirected ? "Zahlung erneut öffnen" : "Bereit für die Zahlung"}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--gv-text-muted)]">
                  {autoRedirected
                    ? "Du bist zurück bei Smokeify. Deine Bestellung ist erst bezahlt, wenn Viva die Zahlung bestätigt."
                    : "Wir öffnen gleich Viva Smart Checkout. Dort wählst du deine Zahlungsart und bestätigst den Betrag."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between gap-3 rounded-[18px] bg-white px-4 py-3 ring-1 ring-emerald-900/8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--gv-text-muted)]">
                  Zu zahlen
                </p>
                <p className="mt-1 font-[family:var(--font-syne)] text-2xl font-bold">
                  {formatMoney(summary.totalCents, summary.currency)}
                </p>
              </div>
              <PaymentMethodLogos
                className="justify-end gap-1.5"
                pillClassName="h-7 border-emerald-950/8 bg-white px-2"
                logoClassName="h-3.5"
              />
            </div>

            {autoRedirected ? (
              <div
                className="mt-4 rounded-[16px] bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
                role="status"
              >
                Noch nicht bezahlt. Öffne Viva erneut oder bearbeite deine Lieferdaten.
              </div>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={checkoutPrimaryButtonClassName}
                onClick={startVivaRedirect}
              >
                {autoRedirected ? "Zahlung erneut öffnen" : "Jetzt sicher bezahlen"}
              </button>
              <button
                type="button"
                className={checkoutSecondaryButtonClassName}
                onClick={() => router.push("/checkout/start")}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Lieferdaten bearbeiten
              </button>
              <button
                type="button"
                className="min-h-11 text-sm font-semibold text-[color:var(--gv-text-muted)] underline-offset-4 hover:text-[color:var(--gv-error)] hover:underline sm:col-span-2"
                onClick={() => void cancelDraft()}
              >
                Checkout abbrechen und zum Warenkorb
              </button>
            </div>
          </div>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-5">
            <OrderSummary {...summary} />
          </aside>
        </div>
      </section>
    </div>
  );
}
