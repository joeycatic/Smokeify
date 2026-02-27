"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import type { MutableRefObject } from "react";

export type NavbarSearchResult = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: { amount: string; currencyCode: string } | null;
};

type PopupStyle = {
  top: number;
  left: number;
  width: number;
};

type Props = {
  open: boolean;
  searchStatus: "idle" | "loading" | "error";
  searchQuery: string;
  searchResults: NavbarSearchResult[];
  searchPopupStyle: PopupStyle | null;
  popupRef: MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSelectResult: (item: NavbarSearchResult) => void;
};

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

export default function NavbarSearchResultsPopover({
  open,
  searchStatus,
  searchQuery,
  searchResults,
  searchPopupStyle,
  popupRef,
  onClose,
  onSelectResult,
}: Props) {
  if (
    !open ||
    !searchPopupStyle ||
    !(
      searchStatus === "loading" ||
      searchStatus === "error" ||
      searchQuery.trim().length > 0
    )
  ) {
    return null;
  }

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[990] mt-0 rounded-2xl border border-emerald-200/70 bg-white p-3 text-sm shadow-xl shadow-emerald-900/10"
      style={{
        top: searchPopupStyle.top,
        left: searchPopupStyle.left,
        width: searchPopupStyle.width,
      }}
      aria-hidden={!open}
    >
      {searchStatus === "loading" && (
        <div className="px-2 py-2 text-xs text-stone-500">Suche...</div>
      )}
      {searchStatus === "error" && (
        <div className="px-2 py-2 text-xs text-red-600">
          Suche fehlgeschlagen.
        </div>
      )}
      {searchStatus === "idle" &&
        searchQuery.trim().length > 0 &&
        searchResults.length === 0 && (
          <div className="px-2 py-2 text-xs text-stone-500">
            Keine Produkte gefunden.
          </div>
        )}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.slice(0, 6).map((item) => (
            <Link
              key={item.id}
              href={`/products/${item.handle}`}
              onClick={() => onSelectResult(item)}
              className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-sm text-stone-800 hover:border-emerald-200 hover:bg-emerald-50/60"
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.imageAlt ?? item.title}
                  className="h-10 w-10 rounded-lg object-cover"
                  width={40}
                  height={40}
                  sizes="40px"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-stone-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                {item.price && (
                  <p className="text-xs text-stone-500">
                    {formatPrice(item.price.amount, item.price.currencyCode)}
                  </p>
                )}
              </div>
              <span className="text-xs text-emerald-700">→</span>
            </Link>
          ))}
          <Link
            href="/products"
            onClick={onClose}
            className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-900"
          >
            Alle Produkte anzeigen
            <span>→</span>
          </Link>
        </div>
      )}
    </div>,
    document.body,
  );
}
