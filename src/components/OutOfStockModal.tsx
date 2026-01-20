"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function OutOfStockModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-red-700">
              Artikel nicht verfuegbar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-stone-500 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-stone-600">
          Dieser Artikel ist aktuell ausverkauft. Bitte versuche es spaeter
          erneut.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}
