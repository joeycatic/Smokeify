"use client";

import Link from "next/link";
import { useMemo } from "react";
import { readCheckoutPaymentState } from "@/app/checkout/shared/paymentState";

export default function OrderFailurePage() {
  const paymentState = useMemo(() => readCheckoutPaymentState(), []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="legacy-light-surface relative overflow-hidden rounded-[30px] border border-[var(--smk-border)] bg-white p-5 shadow-[var(--gv-shadow)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,143,127,0.16),transparent_32%),radial-gradient(circle_at_88%_14%,rgba(233,188,116,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_30%)]" />
        <div className="relative">
          <span className="inline-flex rounded-full border border-[var(--smk-error)]/35 bg-[rgba(239,143,127,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-error)]">
            Zahlung nicht abgeschlossen
          </span>
          <h1 className="smk-heading mt-5 text-4xl sm:text-5xl">
            Zahlung konnte nicht bestätigt werden.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
            Viva hat den Zahlungsabschluss nicht bestätigt. Dein Warenkorb bleibt erhalten,
            und du kannst die Zahlung erneut öffnen oder deine Lieferdaten prüfen.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(280px,0.96fr)]">
            <div className="rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                Was jetzt sinnvoll ist
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--smk-text)]">
                <li>Prüfe, ob deine Bank- oder Wallet-Freigabe abgeschlossen wurde.</li>
                <li>Versuche die Zahlung erneut, falls der Viva Checkout abgebrochen wurde.</li>
                <li>Starte den Checkout neu, wenn Preise, Versand oder Bestand frisch geprüft werden sollen.</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.08)] px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-accent-2)]">
                Nächster Schritt
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--smk-text)]">
                {paymentState
                  ? "Die vorbereitete Viva-Zahlung ist noch im Browser gespeichert."
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
                Zahlung erneut öffnen
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
              Lieferdaten prüfen
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
