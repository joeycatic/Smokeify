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
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Schließen"
      />
      <div
        className="relative w-full max-w-sm overflow-y-auto rounded-3xl border border-black/10 bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.30)] max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          Sicherer Checkout
        </div>
        <h2 className="text-xl font-semibold text-stone-900">
          Wie möchtest du fortfahren?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
          Melde dich an, um Bestellungen zu verfolgen und schneller erneut zu
          bestellen, oder fahre als Gast fort.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Link
            href={`/auth/checkout?returnTo=${encodeURIComponent(returnTo)}`}
            onClick={onClose}
            className="group flex w-full items-center justify-between rounded-2xl border-2 border-[#2f3e36] bg-[#2f3e36] px-5 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#24312b]"
          >
            <span className="inline-flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-white/85" />
              Anmelden / Registrieren
            </span>
            <span className="text-xs font-normal text-white/75">
              Bestellhistorie & Vorteile
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void onContinueAsGuest()}
            className="group flex w-full items-center justify-between rounded-2xl border-2 border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-stone-800 transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-stone-50"
          >
            <span className="inline-flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-stone-500" />
              Als Gast fortfahren
            </span>
            <span className="text-xs font-normal text-stone-400">
              Ohne Account
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-stone-400 transition hover:text-stone-600"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
