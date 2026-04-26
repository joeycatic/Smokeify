"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { readCheckoutPaymentState } from "@/app/checkout/shared/paymentState";

const REASONS = {
  cancelled: {
    kicker: "Checkout Canceled",
    title: "Bestellung nicht abgeschlossen.",
    body:
      "Der Checkout wurde vor dem Zahlungsabschluss verlassen. Dein Warenkorb bleibt erhalten und du kannst direkt an der gleichen Stelle weitermachen.",
  },
  failed: {
    kicker: "Payment Rejected",
    title: "Zahlung konnte nicht bestätigt werden.",
    body:
      "Der Zahlungsanbieter hat den Vorgang nicht abgeschlossen. Du kannst zur Zahlungsseite zurückkehren oder eine andere Methode wählen.",
  },
  expired: {
    kicker: "Session Expired",
    title: "Checkout-Session abgelaufen.",
    body:
      "Die bisherige Session ist nicht mehr gültig. Starte den Checkout erneut, damit Preise, Versand und Bestand frisch geprüft werden.",
  },
} as const;

export default function OrderRejectedPage() {
  const searchParams = useSearchParams();
  const paymentState = useMemo(() => readCheckoutPaymentState(), []);
  const reason = searchParams.get("reason");
  const content =
    reason === "failed" || reason === "expired" || reason === "cancelled"
      ? REASONS[reason]
      : REASONS.cancelled;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-[34px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(23,20,18,0.98),rgba(14,12,11,0.98))] p-5 shadow-[var(--smk-shadow)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,143,127,0.16),transparent_32%),radial-gradient(circle_at_88%_14%,rgba(233,188,116,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_30%)]" />
        <div className="relative">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[var(--smk-error)]/35 bg-[rgba(239,143,127,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-error)]">
              {content.kicker}
            </span>
            <h1 className="smk-heading mt-5 text-4xl sm:text-5xl">
              {content.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
              {content.body}
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(280px,0.96fr)]">
            <div className="rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                Was jetzt sinnvoll ist
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--smk-text)]">
                <li>Prüfe Zahlungsart oder Kartenfreigabe, falls der Vorgang abgelehnt wurde.</li>
                <li>Bei Session-Ablauf starte den Checkout neu, damit Bestand und Versand erneut geprüft werden.</li>
                <li>Deine Lieferdaten bleiben im Checkout erhalten, solange die Session noch aktiv ist.</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.08)] px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-accent-2)]">
                Nächster Schritt
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--smk-text)]">
                {paymentState
                  ? "Die zuletzt vorbereitete Zahlung ist noch im Browser gespeichert."
                  : "Wenn keine aktive Zahlung mehr vorliegt, starte einfach wieder im Warenkorb."}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {paymentState ? (
              <Link
                href="/checkout/payment"
                className="smk-button-primary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
              >
                Zur Zahlung zurück
              </Link>
            ) : (
              <Link
                href="/cart"
                className="smk-button-primary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
              >
                Zurück zum Warenkorb
              </Link>
            )}
            <Link
              href="/checkout/start"
              className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
            >
              Checkout neu starten
            </Link>
            <Link
              href="/products"
              className="smk-button-secondary inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold"
            >
              Weiter shoppen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
