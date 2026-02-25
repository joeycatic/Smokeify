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
    <section className="mt-10 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3.5 w-1 rounded-full"
            style={{ background: "#E4C56C" }}
          />
          <h2 className="text-lg font-bold" style={{ color: "#2f3e36" }}>
            Empfohlen für dich
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollTrack("left")}
            disabled={!canScrollPrev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black/50 shadow-sm transition hover:bg-stone-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Empfehlungen nach links"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollTrack("right")}
            disabled={!canScrollNext}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-black/50 shadow-sm transition hover:bg-stone-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Empfehlungen nach rechts"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <Link
            href="/products"
            className="ml-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition"
            style={{
              borderColor: "rgba(47,62,54,0.2)",
              color: "#2f3e36",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#2f3e36";
              (e.currentTarget as HTMLAnchorElement).style.color = "#ffffff";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#2f3e36";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "";
              (e.currentTarget as HTMLAnchorElement).style.color = "#2f3e36";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(47,62,54,0.2)";
            }}
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
            className="group relative w-[13rem] shrink-0 snap-start border-r border-black/[0.06] p-4 transition last:border-r-0 hover:bg-stone-50/70 sm:w-[15rem]"
          >
            {/* Hover top accent */}
            <span
              className="absolute inset-x-0 top-0 h-0.5 scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
              style={{ background: "#E4C56C", transformOrigin: "left" }}
            />

            <div className="relative h-36 overflow-hidden rounded-xl bg-stone-50 sm:h-44">
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

            <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-snug text-stone-800 transition group-hover:text-stone-900">
              {item.title}
            </p>
            {item.price && (
              <p
                className="mt-1.5 text-sm font-bold"
                style={{ color: "#2f3e36" }}
              >
                {formatPrice(item.price.amount, item.price.currencyCode)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
