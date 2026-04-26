"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useRef, useState } from "react";

export type RecommendedProduct = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: { amount: string; currencyCode: string } | null;
};

const formatPrice = (amount: string, currencyCode: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(amount));

type Props = {
  items: RecommendedProduct[];
};

export default function RecommendedProductsCarousel({ items }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(items.length > 0);

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
  }, [updateScrollState]);

  const scrollTrack = (direction: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const base = Math.max(220, Math.floor(el.clientWidth * 0.85));
    const amount = Math.min(680, base);
    const delta = direction === "left" ? -amount : amount;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <section className="mt-10 overflow-hidden rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(14,14,13,0.99))] shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--smk-border)] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="h-3.5 w-1 rounded-full bg-[var(--smk-accent-2)]" />
          <h2 className="smk-heading text-lg font-bold">
            Empfohlen für dich
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollTrack("left")}
            disabled={!canScrollPrev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-muted)] shadow-sm transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Empfehlungen nach links"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollTrack("right")}
            disabled={!canScrollNext}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] text-[var(--smk-text-muted)] shadow-sm transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Empfehlungen nach rechts"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <Link
            href="/products"
            className="ml-1.5 rounded-full border border-[var(--smk-border-strong)] bg-[rgba(233,188,116,0.12)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--smk-accent-2)] transition hover:bg-[rgba(233,188,116,0.18)]"
          >
            Alle Produkte
          </Link>
        </div>
      </div>

      {/* Carousel track */}
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-0 overflow-x-auto"
      >
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/products/${item.handle}`}
            className="group relative w-[13rem] shrink-0 snap-start border-r border-[var(--smk-border)] p-4 transition last:border-r-0 hover:bg-[rgba(255,255,255,0.03)] sm:w-[15rem]"
          >
            {/* Hover top accent */}
            <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[var(--smk-accent-2)] transition-transform duration-200 group-hover:scale-x-100" />

            <div className="smk-white-well relative h-36 overflow-hidden rounded-[20px] sm:h-44">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.imageAlt ?? item.title}
                  fill
                  className="object-contain p-2 transition duration-300 group-hover:scale-[1.04]"
                  sizes="(min-width: 640px) 240px, 208px"
                  loading={index < 4 ? "eager" : "lazy"}
                  quality={70}
                />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>

            <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--smk-text)] transition group-hover:text-[var(--smk-accent-2)]">
              {item.title}
            </p>
            {item.price && (
              <p className="mt-1.5 text-sm font-bold text-[var(--smk-accent-2)]">
                {formatPrice(item.price.amount, item.price.currencyCode)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
