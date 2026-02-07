"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWishlist } from "@/hooks/useWishlist";
import type { Product } from "@/data/types";
import PageLayout from "@/components/PageLayout";
import { DisplayProductsList } from "@/components/DisplayProducts";
import LoadingSpinner from "@/components/LoadingSpinner";

type SortMode = "featured" | "price_asc" | "price_desc" | "name_asc";

export default function WishlistPage() {
  const { ids } = useWishlist();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<SortMode>("featured");
  const [loading, setLoading] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const shareNoticeTimer = useRef<number | null>(null);

  const sharedIds = useMemo(() => {
    const raw = searchParams.get("ids") ?? "";
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }, [searchParams]);

  const isSharedView = sharedIds.length > 0;
  const activeIds = isSharedView ? sharedIds : ids;
  const sortedProducts = useMemo(() => {
    const toPrice = (product: Product) =>
      Number(product.priceRange?.minVariantPrice?.amount ?? 0);

    return [...products].sort((a, b) => {
      const stockDelta =
        Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
      if (stockDelta !== 0) return stockDelta;

      if (sortBy === "price_asc") return toPrice(a) - toPrice(b);
      if (sortBy === "price_desc") return toPrice(b) - toPrice(a);
      if (sortBy === "name_asc") return a.title.localeCompare(b.title);

      return a.title.localeCompare(b.title);
    });
  }, [products, sortBy]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeIds.length) {
        setProducts([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: activeIds }),
        });
        if (!res.ok) throw new Error("Wishlist fetch failed");
        const data = (await res.json()) as Product[];
        if (!cancelled) setProducts(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeIds]);

  const shareWishlist = async () => {
    setShareNotice("");
    if (!ids.length) return;
    const origin = window.location.origin;
    const url = `${origin}/wishlist?ids=${encodeURIComponent(ids.join(","))}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("Link kopiert.");
      if (shareNoticeTimer.current) {
        window.clearTimeout(shareNoticeTimer.current);
      }
      shareNoticeTimer.current = window.setTimeout(() => {
        setShareNotice("");
        shareNoticeTimer.current = null;
      }, 3000);
    } catch {
      setShareNotice("Link konnte nicht kopiert werden.");
      if (shareNoticeTimer.current) {
        window.clearTimeout(shareNoticeTimer.current);
      }
      shareNoticeTimer.current = window.setTimeout(() => {
        setShareNotice("");
        shareNoticeTimer.current = null;
      }, 3000);
    }
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-10 text-black/80">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "#2f3e36" }}>
              Wunschliste
            </h1>
            {isSharedView && (
              <p className="mt-2 text-sm text-stone-600">
                Du siehst eine geteilte Wunschliste.
              </p>
            )}
          </div>
          {!isSharedView && ids.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={shareWishlist}
                className="h-10 rounded-md border border-black/10 bg-white px-4 text-xs font-semibold text-stone-700 hover:border-black/20"
              >
                Wunschliste teilen
              </button>
              {shareNotice && (
                <span className="text-xs text-stone-500">{shareNotice}</span>
              )}
            </div>
          )}
          {isSharedView && (
            <Link
              href="/wishlist"
              className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 bg-white px-4 text-xs font-semibold text-stone-700 hover:border-black/20"
            >
              Zur eigenen Wunschliste
            </Link>
          )}
        </div>
        {loading && (
          <div className="mt-10 flex min-h-[40vh] items-center justify-center gap-3 text-center text-stone-600">
            <LoadingSpinner size="sm" />
            <span>Wunschliste wird geladen...</span>
          </div>
        )}
        {!loading && activeIds.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-2xl">
              &#10084;
            </div>
            <h2 className="text-lg font-semibold text-stone-800">
              Noch keine Favoriten
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Finde Produkte, die dir gefallen, und speichere sie hier.
            </p>
            {!isSharedView && (
              <Link
                href="/products"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
              >
                Produkte entdecken
              </Link>
            )}
          </div>
        )}
        {!loading && activeIds.length > 0 && (
          <>
            <div className="mb-4 flex justify-end">
              <label className="inline-flex h-10 items-center rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-stone-700 shadow-sm">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortMode)}
                  aria-label="Sortierung"
                  className="bg-transparent pr-3 text-sm font-semibold text-stone-800 outline-none"
                >
                  <option value="featured">Empfohlen</option>
                  <option value="price_asc">Preis aufsteigend</option>
                  <option value="price_desc">Preis absteigend</option>
                  <option value="name_asc">Name A-Z</option>
                </select>
              </label>
            </div>
            <DisplayProductsList products={sortedProducts} />
          </>
        )}
      </div>
    </PageLayout>
  );
}
