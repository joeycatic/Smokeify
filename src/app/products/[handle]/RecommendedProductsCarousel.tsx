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
    <section className="mt-10 rounded-2xl border border-black/10 bg-white/90 p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/70">
          Empfohlen für dich
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollTrack("left")}
            disabled={!canScrollPrev}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 shadow-sm transition hover:border-black/30 hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Empfehlungen nach links"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollTrack("right")}
            disabled={!canScrollNext}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 shadow-sm transition hover:border-black/30 hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Empfehlungen nach rechts"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <Link
            href="/products"
            className="ml-1 text-xs font-semibold text-emerald-800 transition hover:text-emerald-900"
          >
            Alle Produkte
          </Link>
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/products/${item.handle}`}
            className="group w-[15.5rem] shrink-0 snap-start rounded-2xl border border-black/10 bg-white p-3 transition hover:border-black/20 hover:shadow-md sm:w-[17.5rem]"
          >
            <div className="relative h-44 overflow-hidden rounded-xl bg-white sm:h-52">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.imageAlt ?? item.title}
                  fill
                  className="object-contain transition duration-300 group-hover:scale-105"
                  sizes="(min-width: 640px) 280px, 248px"
                  loading="lazy"
                  quality={70}
                />
              ) : (
                <div className="h-full w-full bg-stone-100" />
              )}
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-semibold text-black/85">
              {item.title}
            </p>
            {item.price && (
              <p className="mt-1 text-base font-semibold text-stone-900">
                {formatPrice(item.price.amount, item.price.currencyCode)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
