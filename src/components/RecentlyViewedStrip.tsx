"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readRecentlyViewed,
  type RecentlyViewedItem,
} from "@/lib/recentlyViewed";

type Props = {
  title?: string;
  className?: string;
  excludeHandles?: string[];
  maxItems?: number;
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

export default function RecentlyViewedStrip({
  title = "Zuletzt angesehen",
  className,
  excludeHandles = [],
  maxItems = 8,
}: Props) {
  const [items] = useState<RecentlyViewedItem[]>(() => readRecentlyViewed());
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const visibleItems = useMemo(() => {
    if (items.length === 0) return [];
    const excluded = new Set(excludeHandles.filter(Boolean));
    return items
      .filter((item) => !excluded.has(item.handle))
      .slice(0, Math.max(1, maxItems));
  }, [excludeHandles, items, maxItems]);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, visibleItems]);

  const scrollTrack = (direction: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const base = Math.max(220, Math.floor(el.clientWidth * 0.85));
    const amount = Math.min(680, base);
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (visibleItems.length === 0) return null;

  return (
    <section className={className}>
      <div className="overflow-hidden rounded-[32px] border border-[color:var(--gv-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%),var(--gv-dark)] shadow-[var(--gv-shadow)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--gv-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-3.5 w-1 rounded-full bg-[color:var(--gv-lime)]" />
            <div>
              <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--gv-lime)]">
                Verlauf
              </p>
              <h2 className="mt-1 font-[family:var(--font-syne)] text-xl font-bold tracking-[-0.04em] text-[color:var(--gv-text)]">
                {title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollTrack("left")}
              disabled={!canScrollPrev}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text-muted)] transition hover:border-[color:var(--gv-lime)]/35 hover:text-[color:var(--gv-text)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Nach links"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTrack("right")}
              disabled={!canScrollNext}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text-muted)] transition hover:border-[color:var(--gv-lime)]/35 hover:text-[color:var(--gv-text)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Nach rechts"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {visibleItems.map((item) => (
            <Link
              key={item.handle}
              href={`/products/${item.handle}`}
              className="group relative w-[13rem] shrink-0 snap-start border-r border-[color:var(--gv-border)] p-4 transition last:border-r-0 hover:bg-[color:var(--gv-lime)]/6 sm:w-[15rem]"
            >
              <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[color:var(--gv-lime)] transition-transform duration-200 group-hover:scale-x-100" />

              <div className="relative h-36 overflow-hidden rounded-[24px] border border-[color:var(--gv-border)] bg-white sm:h-44">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.imageAlt ?? item.title}
                    className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.04]"
                    fill
                    sizes="(min-width: 640px) 15rem, 13rem"
                  />
                ) : (
                  <div className="h-full w-full bg-white" />
                )}
              </div>

              {item.manufacturer && (
                <p className="mt-3 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                  {item.manufacturer}
                </p>
              )}
              <p className={`${item.manufacturer ? "mt-0.5" : "mt-3"} line-clamp-2 text-[13px] font-semibold leading-snug text-[color:var(--gv-text)] transition group-hover:text-[color:var(--gv-lime)]`}>
                {item.title}
              </p>
              {item.price ? (
                <p className="mt-1.5 text-sm font-bold text-[color:var(--gv-lime)]">
                  {formatPrice(item.price.amount, item.price.currencyCode)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
