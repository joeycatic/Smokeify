"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import type { MutableRefObject } from "react";

export type NavbarSearchResult = {
  id: string;
  defaultVariantId: string | null;
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
      className="fixed z-[990] mt-0 rounded-[24px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] p-3 text-sm text-[var(--smk-text)] shadow-2xl shadow-black/40"
      style={{
        top: searchPopupStyle.top,
        left: searchPopupStyle.left,
        width: searchPopupStyle.width,
      }}
      aria-hidden={!open}
    >
      {searchStatus === "loading" && (
        <div className="px-2 py-2 text-xs text-[var(--smk-text-muted)]">
          Suche...
        </div>
      )}
      {searchStatus === "error" && (
        <div className="px-2 py-2 text-xs text-[var(--smk-error)]">
          Suche fehlgeschlagen.
        </div>
      )}
      {searchStatus === "idle" &&
        searchQuery.trim().length > 0 &&
        searchResults.length === 0 && (
          <div className="px-2 py-2 text-xs text-[var(--smk-text-muted)]">
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
              className="flex items-center gap-3 rounded-[20px] border border-transparent px-2 py-2 text-sm text-[var(--smk-text)] transition hover:border-[var(--smk-border)] hover:bg-[rgba(255,255,255,0.05)]"
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
                <div className="h-10 w-10 rounded-lg bg-[rgba(255,255,255,0.06)]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--smk-text)]">
                  {item.title}
                </p>
                {item.price && (
                  <p className="text-xs text-[var(--smk-text-muted)]">
                    {formatPrice(item.price.amount, item.price.currencyCode)}
                  </p>
                )}
              </div>
              <span className="text-xs text-[var(--smk-accent)]">→</span>
            </Link>
          ))}
          <Link
            href="/products"
            onClick={onClose}
            className="flex items-center justify-between rounded-[20px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-xs font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.09)]"
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
