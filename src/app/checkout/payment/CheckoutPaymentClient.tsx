"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckout,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  clearCheckoutPaymentState,
  readCheckoutPaymentState,
  type CheckoutPaymentState,
  type CheckoutSummarySnapshot,
} from "@/app/checkout/shared/paymentState";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = { publishableKey: string };

type CheckoutSessionSummaryResponse = {
  error?: string;
  paymentIntentStatus?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  summary?: CheckoutSummarySnapshot | null;
};

const appearance = {
  theme: "night",
  labels: "floating",
  variables: {
    colorBackground: "#12100d",
    colorDanger: "#ff8a80",
    colorPrimary: "#e9bc74",
    colorText: "#f7f2ea",
    colorTextSecondary: "#b5aa98",
    borderRadius: "18px",
    fontFamily: "system-ui, sans-serif",
    spacingUnit: "6px",
  },
} as const;

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

function PaymentPane({
  contact,
  onSuccess,
}: {
  contact: CheckoutPaymentState["contact"];
  onSuccess: () => void;
}) {
  const checkoutState = useCheckout();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (checkoutState.type === "loading") {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <LoadingSpinner size="md" className="border-white/15 border-t-[var(--smk-accent)]" />
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div className="rounded-2xl border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-4 py-3 text-sm text-[var(--smk-error)]">
        {checkoutState.error.message || "Checkout konnte nicht geladen werden."}
      </div>
    );
  }

  const { checkout } = checkoutState;

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    const result = await checkout.confirm({
      redirect: "if_required",
      shippingAddress: contact,
    });
    if (result.type === "error") {
      setSubmitError(result.error.message || "Zahlung konnte nicht bestätigt werden.");
      setSubmitting(false);
      return;
    }
    onSuccess();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
          Zahlungsart
        </p>
        <PaymentElement
          options={{
            layout: {
              type: "tabs",
              defaultCollapsed: false,
              paymentMethodLogoPosition: "start",
              radios: "always",
            },
          }}
        />
      </div>
      {submitError ? (
        <div className="rounded-2xl border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-4 py-3 text-sm text-[var(--smk-error)]">
          {submitError}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void handleConfirm()}
        disabled={submitting || !checkout.canConfirm}
        className="smk-button-primary inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Zahlung wird bestätigt..." : "Jetzt bezahlen"}
      </button>
    </div>
  );
}

export default function CheckoutPaymentClient({ publishableKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentState, setPaymentState] = useState<CheckoutPaymentState | null>(null);
  const [summary, setSummary] = useState<CheckoutSummarySnapshot | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [paymentReturnNotice, setPaymentReturnNotice] = useState<string | null>(null);
  const returnedFromStripe = searchParams.get("checkout_return") === "1";

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : Promise.resolve(null)),
    [publishableKey],
  );

  const navigateToSuccess = useCallback(
    (url: string) => {
      if (typeof window !== "undefined") {
        window.location.assign(url);
        return;
      }
      router.push(url);
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const initialize = async () => {
      const stored = readCheckoutPaymentState();
      if (!stored) {
        setLoadState("error");
        setPageError("Keine aktive Checkout-Session gefunden.");
        return;
      }

      setPaymentState(stored);
      setSummary(stored.summary);

      if (!publishableKey) {
        setLoadState("error");
        setPageError("Stripe Publishable Key fehlt.");
        return;
      }

      try {
        const params = new URLSearchParams({
          editToken: stored.editToken,
          sessionId: stored.sessionId,
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
        if (data.status === "complete") {
          clearCheckoutPaymentState();
          navigateToSuccess(stored.successUrl);
          return;
        }
        if (data.status === "expired") {
          throw new Error("Diese Checkout-Session ist abgelaufen.");
        }
        if (returnedFromStripe) {
          const paymentFailed =
            data.paymentStatus === "unpaid" ||
            data.paymentIntentStatus === "requires_payment_method" ||
            data.paymentIntentStatus === "canceled";
          setPaymentReturnNotice(
            paymentFailed
              ? "Die Zahlung wurde nicht abgeschlossen. Bitte versuche es erneut."
              : "Der Bezahlvorgang wurde unterbrochen. Du kannst hier fortfahren.",
          );
        } else {
          setPaymentReturnNotice(null);
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
  }, [navigateToSuccess, publishableKey, returnedFromStripe]);

  useEffect(() => {
    if (!paymentState || !summary || loadState !== "ready") return;
    trackAnalyticsEvent("add_payment_info", {
      currency: summary.currency,
      items: toAnalyticsItems(summary),
      payment_type: "stripe_custom_checkout",
      value: summary.totalCents / 100,
    });
  }, [loadState, paymentState, summary]);

  const handleSuccess = () => {
    const successUrl = paymentState?.successUrl ?? "/order/success";
    clearCheckoutPaymentState();
    navigateToSuccess(successUrl);
  };

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <div className="rounded-2xl border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-4 py-3 text-sm text-[var(--smk-error)]">
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
      {paymentReturnNotice ? (
        <div className="mb-5 rounded-2xl border border-[var(--smk-error)]/30 bg-[rgba(120,30,30,0.18)] px-4 py-3 text-sm text-[var(--smk-error)]">
          {paymentReturnNotice}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <CheckoutElementsProvider
            key={paymentState.sessionId}
            stripe={stripePromise}
            options={{
              clientSecret: paymentState.clientSecret,
              defaultValues: { shippingAddress: paymentState.contact },
              elementsOptions: { appearance },
            }}
          >
            <PaymentPane contact={paymentState.contact} onSuccess={handleSuccess} />
          </CheckoutElementsProvider>
        </section>
        <aside className="rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">Bestellübersicht</p>
          <div className="mt-4 space-y-3">
            {summary.items.map((item) => (
              <div key={`${item.variantId}-${item.name}`} className="flex items-center gap-3 rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[rgba(255,255,255,0.05)]">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" /> : null}</div>
                <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold text-[var(--smk-text)]">{item.name}</p><p className="mt-1 text-xs text-[var(--smk-text-muted)]">Menge {item.quantity}</p></div>
                <p className="text-sm font-semibold text-[var(--smk-text)]">{formatMoney(item.lineTotalCents, summary.currency)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3 rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-4">
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
