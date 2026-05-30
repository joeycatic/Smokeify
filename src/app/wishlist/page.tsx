"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWishlist } from "@/hooks/useWishlist";
import type { Product } from "@/data/types";
import { DisplayProductsList } from "@/components/DisplayProducts";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";

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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-[var(--smk-text)] sm:px-6 sm:py-10">
        <section className="rounded-[40px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_left,rgba(241,198,132,0.16),transparent_26%),linear-gradient(135deg,rgba(24,20,17,0.99),rgba(12,11,10,1))] px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.32)] sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="smk-kicker">Smokeify Merkliste</p>
            <h1 className="smk-heading mt-3 text-4xl text-[var(--smk-text)]">
              Wunschliste
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)]">
              Sammle Produkte für Setup-Entscheidungen, teile deine Auswahl oder
              halte Favoriten für deinen nächsten Einkauf griffbereit.
            </p>
          </div>
          {!isSharedView && ids.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={shareWishlist}
                className="smk-button-secondary h-10 rounded-full px-4 text-xs font-semibold"
              >
                Wunschliste teilen
              </button>
              {shareNotice && (
                <span className="text-xs text-[var(--smk-text-muted)]">{shareNotice}</span>
              )}
            </div>
          )}
          {isSharedView && (
            <Link
              href="/wishlist"
              className="smk-button-secondary inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold"
            >
              Zur eigenen Wunschliste
            </Link>
          )}
        </div>
        {isSharedView ? (
          <p className="mt-4 rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--smk-text-muted)]">
            Du siehst eine geteilte Wunschliste.
          </p>
        ) : null}
        </section>
        {loading && (
          <div className="flex min-h-[40vh] items-center justify-center gap-3 text-center text-[var(--smk-text-muted)]">
            <LoadingSpinner size="sm" />
            <span>Wunschliste wird geladen...</span>
          </div>
        )}
        {!loading && activeIds.length === 0 && (
          <EmptyState
            eyebrow="Wunschliste"
            title="Noch keine Favoriten"
            description="Finde Produkte, die zu deinem Setup passen, und speichere sie hier für später."
            actions={
              isSharedView
                ? []
                : [{ label: "Produkte entdecken", href: "/products", tone: "primary" }]
            }
          />
        )}
        {!loading && activeIds.length > 0 && (
          <>
            <div className="flex justify-end">
              <label className="inline-flex h-10 items-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.06)] px-3 text-xs font-semibold text-[var(--smk-text-muted)] shadow-sm">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortMode)}
                  aria-label="Sortierung"
                  className="bg-transparent pr-3 text-sm font-semibold text-[var(--smk-text)] outline-none"
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
  );
}
