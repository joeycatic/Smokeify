"use client";

import Link from "next/link";
import { UserCircleIcon, UserIcon } from "@heroicons/react/24/outline";

type CheckoutAuthModalProps = {
  open: boolean;
  returnTo: string;
  onClose: () => void;
  onContinueAsGuest: () => void | Promise<void>;
};

export default function CheckoutAuthModal({
  open,
  returnTo,
  onClose,
  onContinueAsGuest,
}: CheckoutAuthModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Schließen"
      />
      <div
        className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[30px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-6 text-[var(--smk-text)] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 inline-flex items-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-xs font-semibold text-[var(--smk-accent)]">
          Sicherer Checkout
        </div>
        <h2 className="smk-heading text-2xl text-[var(--smk-text)]">
          Wie möchtest du fortfahren?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--smk-text-muted)]">
          Melde dich an, um Bestellungen zu verfolgen und schneller erneut zu
          bestellen, oder fahre als Gast fort.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Link
            href={`/auth/checkout?returnTo=${encodeURIComponent(returnTo)}`}
            onClick={onClose}
            className="group flex w-full items-center justify-between rounded-2xl border border-[var(--smk-border)] bg-[linear-gradient(135deg,var(--smk-accent),var(--smk-accent-2))] px-5 py-3.5 text-sm font-semibold text-[#1a140f] transition hover:-translate-y-0.5"
          >
            <span className="inline-flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-[#1a140f]/80" />
              Anmelden / Registrieren
            </span>
            <span className="text-xs font-normal text-[#1a140f]/70">
              Bestellhistorie & Vorteile
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void onContinueAsGuest()}
            className="group flex w-full items-center justify-between rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-5 py-3.5 text-sm font-semibold text-[var(--smk-text)] transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.08)]"
          >
            <span className="inline-flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-[var(--smk-text-dim)]" />
              Als Gast fortfahren
            </span>
            <span className="text-xs font-normal text-[var(--smk-text-dim)]">
              Ohne Account
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-[var(--smk-text-dim)] transition hover:text-[var(--smk-text)]"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
