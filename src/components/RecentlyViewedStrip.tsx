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
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className="h-3.5 w-1 rounded-full"
              style={{ background: "#E4C56C" }}
            />
            <h2
              className="text-lg font-bold"
              style={{ color: "#2f3e36" }}
            >
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollTrack("left")}
              disabled={!canScrollPrev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black/50 shadow-sm transition hover:bg-stone-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Nach links"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTrack("right")}
              disabled={!canScrollNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black/50 shadow-sm transition hover:bg-stone-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Nach rechts"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Carousel track */}
        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {visibleItems.map((item) => (
            <Link
              key={item.handle}
              href={`/products/${item.handle}`}
              className="group relative w-[13rem] shrink-0 snap-start border-r border-black/[0.06] p-4 transition last:border-r-0 hover:bg-stone-50/70 sm:w-[15rem]"
            >
              {/* Gold hover bar */}
              <span
                className="absolute inset-x-0 top-0 h-0.5 scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
                style={{ background: "#E4C56C", transformOrigin: "left" }}
              />

              <div className="relative h-36 overflow-hidden rounded-xl bg-stone-50 sm:h-44">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.imageAlt ?? item.title}
                    className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.04]"
                    fill
                    sizes="(min-width: 640px) 15rem, 13rem"
                  />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>

              {item.manufacturer && (
                <p className="mt-3 truncate text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  {item.manufacturer}
                </p>
              )}
              <p className={`${item.manufacturer ? "mt-0.5" : "mt-3"} line-clamp-2 text-[13px] font-semibold leading-snug text-stone-800 transition group-hover:text-stone-900`}>
                {item.title}
              </p>
              {item.price ? (
                <p className="mt-1.5 text-sm font-bold" style={{ color: "#2f3e36" }}>
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
