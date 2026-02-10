"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    setItems(readRecentlyViewed());
  }, []);

  const visibleItems = useMemo(() => {
    if (items.length === 0) return [];
    const excluded = new Set(excludeHandles.filter(Boolean));
    return items
      .filter((item) => !excluded.has(item.handle))
      .slice(0, Math.max(1, maxItems));
  }, [excludeHandles, items, maxItems]);

  if (visibleItems.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-black/80 sm:text-2xl">
          {title}
        </h2>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {visibleItems.map((item) => (
          <article
            key={item.handle}
            className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Link
              href={`/products/${item.handle}`}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <div className="overflow-hidden rounded-xl bg-stone-50 aspect-square">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.imageAlt ?? item.title}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              {item.manufacturer && (
                <p className="mt-3 truncate text-[11px] uppercase tracking-wide text-stone-500">
                  {item.manufacturer}
                </p>
              )}
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-stone-800">
                {item.title}
              </p>
              {item.price ? (
                <p className="mt-1 text-sm font-semibold text-emerald-900">
                  {formatPrice(item.price.amount, item.price.currencyCode)}
                </p>
              ) : null}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
