"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import type { MutableRefObject } from "react";
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import {
  getNumberFormatLocale,
  type Language,
} from "@/lib/language";
import { SearchResultsSkeleton } from "@/components/storefront/StorefrontSkeletons";

export type NavbarSearchResult = {
  id: string;
  defaultVariantId: string | null;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: { amount: string; currencyCode: string } | null;
  manufacturer: string | null;
  category: { title: string; handle: string } | null;
  availableForSale: boolean;
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
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  language: Language;
};

const DISCOVERY_SEARCHES = [
  { de: "LED für 80 × 80", en: "LED for 80 × 80", query: "LED 80x80" },
  { de: "Leise Abluft", en: "Quiet ventilation", query: "leise Abluft" },
  { de: "Growzelt 60 × 60", en: "Grow tent 60 × 60", query: "Growzelt 60x60" },
  { de: "Bewässerung", en: "Irrigation", query: "Bewässerung" },
] as const;

function formatPrice(
  amount: string,
  currencyCode: string,
  language: Language,
) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(getNumberFormatLocale(language), {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}
const buildSearchHref = (query: string) =>
  `/products?searchQuery=${encodeURIComponent(query.trim())}`;

export default function NavbarSearchResultsPopover({
  open,
  searchStatus,
  searchQuery,
  searchResults,
  searchPopupStyle,
  popupRef,
  onClose,
  onSelectResult,
  activeIndex,
  onActiveIndexChange,
  language,
}: Props) {
  if (!open || !searchPopupStyle) return null;

  const trimmedQuery = searchQuery.trim();
  const isEnglish = language === "en";

  return createPortal(
    <div
      ref={popupRef}
      className="webshop-dropdown-in fixed z-[990] flex max-h-[min(680px,calc(100dvh-24px))] flex-col overflow-hidden rounded-[28px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] text-sm text-[color:var(--gv-text)] shadow-[var(--gv-shadow-lg)]"
      style={{
        top: searchPopupStyle.top,
        left: searchPopupStyle.left,
        width: searchPopupStyle.width,
        maxHeight: `calc(100dvh - ${searchPopupStyle.top + 12}px)`,
      }}
      aria-label={isEnglish ? "Product search" : "Produktsuche"}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--gv-border)] bg-[linear-gradient(120deg,var(--gv-brand-soft),transparent_68%)] px-4 py-3.5 sm:px-5">
        <div>
          <p className="font-[family:var(--font-jetbrains-mono)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--gv-lime)]">
            {trimmedQuery
              ? isEnglish
                ? "Search suggestions"
                : "Suchvorschläge"
              : isEnglish
                ? "Quick discovery"
                : "Schnell entdecken"}
          </p>
          <p className="mt-1 text-xs text-[color:var(--gv-text-muted)]" aria-live="polite">
            {searchStatus === "loading"
              ? isEnglish
                ? "Searching the catalog…"
                : "Katalog wird durchsucht…"
              : trimmedQuery && searchResults.length > 0
                ? isEnglish
                  ? `${searchResults.length} matching suggestions`
                  : `${searchResults.length} passende Vorschläge`
                : isEnglish
                  ? "Popular ways into the catalog"
                  : "Beliebte Einstiege in den Katalog"}
          </p>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--gv-lime)]/18 bg-[color:var(--gv-dark)] text-[color:var(--gv-lime)]">
          <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>

      <div className="pretty-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {!trimmedQuery ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {DISCOVERY_SEARCHES.map((item) => (
              <Link
                key={item.query}
                href={buildSearchHref(item.query)}
                onClick={onClose}
                className="group flex min-h-14 items-center justify-between gap-3 rounded-[18px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)]/55 px-3.5 py-3 font-semibold transition hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/30 hover:bg-[color:var(--gv-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35"
              >
                <span>{isEnglish ? item.en : item.de}</span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-[color:var(--gv-lime)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        ) : null}

        {searchStatus === "loading" ? <SearchResultsSkeleton rows={5} /> : null}

        {searchStatus === "error" ? (
          <div className="rounded-[20px] border border-[color:var(--gv-error)]/18 bg-[color:var(--gv-error)]/7 px-4 py-4 text-sm">
            <p className="font-semibold text-[color:var(--gv-text)]">
              {isEnglish ? "Search is temporarily unavailable." : "Die Suche ist gerade nicht erreichbar."}
            </p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--gv-text-muted)]">
              {isEnglish ? "Please try again in a moment." : "Bitte versuche es gleich noch einmal."}
            </p>
          </div>
        ) : null}

        {searchStatus === "idle" && trimmedQuery && searchResults.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[color:var(--gv-lime)]/28 bg-[color:var(--gv-brand-soft)]/45 px-4 py-5 text-center">
            <p className="font-semibold">
              {isEnglish ? `No direct match for “${trimmedQuery}”.` : `Kein direkter Treffer für „${trimmedQuery}“.`}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[color:var(--gv-text-muted)]">
              {isEnglish
                ? "Open the full search for filters, related paths and guided alternatives."
                : "Öffne die vollständige Suche für Filter, passende Wege und geführte Alternativen."}
            </p>
          </div>
        ) : null}

        {searchStatus !== "loading" && searchResults.length > 0 ? (
          <div id="navbar-search-listbox" role="listbox" className="space-y-1.5">
            {searchResults.slice(0, 6).map((item, index) => {
              const active = index === activeIndex;
              const meta = [item.manufacturer, item.category?.title].filter(Boolean).join(" · ");

              return (
                <Link
                  id={`navbar-search-option-${index}`}
                  key={item.id}
                  role="option"
                  aria-selected={active}
                  href={`/products/${item.handle}`}
                  onClick={() => onSelectResult(item)}
                  onMouseMove={() => onActiveIndexChange(index)}
                  onFocus={() => onActiveIndexChange(index)}
                  className={`group flex items-center gap-3 rounded-[20px] border px-2.5 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35 ${
                    active
                      ? "border-[color:var(--gv-lime)]/28 bg-[color:var(--gv-brand-soft)]"
                      : "border-transparent hover:border-[color:var(--gv-border)] hover:bg-[color:var(--gv-surface)]/65"
                  }`}
                >
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.imageAlt ?? item.title}
                      className="h-14 w-14 shrink-0 rounded-[16px] border border-[color:var(--gv-border)] bg-white object-contain p-1"
                      width={56}
                      height={56}
                      sizes="56px"
                    />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] bg-[color:var(--gv-surface)] text-[color:var(--gv-text-muted)]">
                      <Squares2X2Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {meta ? (
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--gv-text-muted)]">
                        {meta}
                      </p>
                    ) : null}
                    <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 tracking-[-0.01em]">
                      {item.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      {item.price ? (
                        <span className="font-semibold text-[color:var(--gv-text)]">
                          {formatPrice(item.price.amount, item.price.currencyCode, language)}
                        </span>
                      ) : null}
                      <span className={item.availableForSale ? "text-[color:var(--gv-success)]" : "text-[color:var(--gv-text-muted)]"}>
                        {item.availableForSale
                          ? isEnglish
                            ? "Available"
                            : "Verfügbar"
                          : isEnglish
                            ? "Currently unavailable"
                            : "Aktuell nicht verfügbar"}
                      </span>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-[color:var(--gv-lime)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="border-t border-[color:var(--gv-border)] bg-[color:var(--gv-surface)]/42 p-3">
        <Link
          href={trimmedQuery ? buildSearchHref(trimmedQuery) : "/products"}
          onClick={onClose}
          className="group flex min-h-11 items-center justify-between rounded-[18px] bg-[color:var(--gv-lime)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--gv-lime-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/35 focus-visible:ring-offset-2"
        >
          <span>
            {trimmedQuery
              ? isEnglish
                ? `Show all results for “${trimmedQuery}”`
                : `Alle Ergebnisse für „${trimmedQuery}“`
              : isEnglish
                ? "Browse the complete catalog"
                : "Den gesamten Katalog ansehen"}
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>,
    document.body,
  );
}
