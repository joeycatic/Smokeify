"use client";

import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/outline";

type AddedItem = {
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: { amount: string; currencyCode: string };
  quantity: number;
  productHandle?: string;
};

type Props = {
  open: boolean;
  item: AddedItem | null;
  onClose: () => void;
};

export default function AddedToCartModal({ open, item, onClose }: Props) {
  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700">
              Artikel in den Warenkorb gelegt
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-stone-500 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.imageAlt ?? item.title}
              className="h-20 w-20 rounded-md object-cover"
              loading="lazy"
              decoding="async"
              width={80}
              height={80}
            />
          ) : (
            <div className="h-20 w-20 rounded-md bg-stone-100" />
          )}
          <div className="text-sm text-stone-700">
            <div className="font-semibold text-stone-900">{item.title}</div>
            <div>Menge: {item.quantity}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-black/5 bg-[#E4C56C] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Weiter shoppen
          </button>
          <Link
            href="/cart"
            onClick={onClose}
            className="inline-flex items-center border-black/5 justify-center rounded-md bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Warenkorb anzeigen
          </Link>
        </div>
      </div>
    </div>
  );
}
