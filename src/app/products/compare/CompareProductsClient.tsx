"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EmptyState from "@/components/common/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import ProductCardActions from "@/components/ProductCardActions";
import { useProductCompare } from "@/hooks/useProductCompare";
import type { Product } from "@/data/types";
import { shouldBypassImageOptimization } from "@/lib/storefrontImages";

const formatPrice = (value?: { amount: string; currencyCode: string } | null) =>
  value
    ? new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: value.currencyCode,
        minimumFractionDigits: 2,
      }).format(Number(value.amount))
    : "Preis auf Anfrage";

export default function CompareProductsClient() {
  const { ids, clear } = useProductCompare();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const shareInput = useRef<HTMLInputElement | null>(null);
  const sharedIds = useMemo(
    () => (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 4),
    [searchParams],
  );
  const activeIds = sharedIds.length ? sharedIds : ids;
  const isShared = sharedIds.length > 0;

  useEffect(() => {
    let cancelled = false;
    if (!activeIds.length) {
      setProducts([]);
      return;
    }
    setLoading(true);
    setError("");
    void fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: activeIds }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("compare");
        return (await response.json()) as Product[];
      })
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setError("Der Vergleich konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeIds]);

  const share = async () => {
    const url = `${window.location.origin}/products/compare?ids=${encodeURIComponent(activeIds.join(","))}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Vergleichslink kopiert.");
    } catch {
      shareInput.current?.focus();
      shareInput.current?.select();
      setNotice("Link markieren und manuell kopieren.");
    }
  };

  const shareUrl = typeof window === "undefined"
    ? ""
    : `${window.location.origin}/products/compare?ids=${encodeURIComponent(activeIds.join(","))}`;

  return (
    <div className="mx-auto w-full max-w-7xl pb-16 pt-6 text-[color:var(--gv-text)]">
      <section className="gv-panel rounded-[30px] px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="gv-chip">Vergleich</span>
            <h1 className="mt-4 font-[family:var(--font-syne)] text-4xl font-bold tracking-[-0.07em] sm:text-5xl">
              Produkte klar vergleichen
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--gv-text-muted)] sm:text-base">
              Prüfe Preis, Verfügbarkeit, Größe und Bewertung direkt nebeneinander.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="smk-button-secondary inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold">
              Produkte hinzufügen
            </Link>
            {activeIds.length ? (
              <button type="button" onClick={share} className="smk-button-secondary min-h-11 rounded-2xl px-4 text-sm font-semibold">
                Vergleich teilen
              </button>
            ) : null}
            {!isShared && ids.length ? (
              <button type="button" onClick={clear} className="min-h-11 rounded-2xl border border-[color:var(--gv-lime)]/30 bg-[color:var(--gv-lime)]/10 px-4 text-sm font-semibold text-[color:var(--gv-lime)]">
                Leeren
              </button>
            ) : null}
          </div>
        </div>
        {activeIds.length ? (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <input ref={shareInput} readOnly value={shareUrl} aria-label="Vergleichslink" className="gv-input h-11 min-w-0 flex-1 rounded-2xl px-4 text-sm" />
            {notice ? <p className="self-center text-sm font-semibold text-[color:var(--gv-lime)]" role="status">{notice}</p> : null}
          </div>
        ) : null}
      </section>

      {!activeIds.length ? (
        <EmptyState className="mt-8" eyebrow="Vergleich" title="Noch keine Produkte im Vergleich" description="Füge Produkte aus dem Katalog hinzu, um Unterschiede schneller zu sehen." actions={[{ label: "Produkte entdecken", href: "/products", tone: "primary" }]} />
      ) : null}
      {loading ? <div className="mt-8 flex min-h-48 items-center justify-center gap-3" role="status"><LoadingSpinner size="sm" /> Vergleich wird geladen...</div> : null}
      {error ? <p className="gv-panel mt-8 rounded-[24px] px-5 py-4 text-sm text-[color:var(--gv-error)]" role="alert">{error}</p> : null}

      {!loading && products.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <article key={product.id} className="gv-glass flex h-full flex-col rounded-[28px] p-4">
              <div className="relative aspect-square overflow-hidden rounded-[22px] bg-white">
                {product.featuredImage?.url ? <Image src={product.featuredImage.url} alt={product.featuredImage.altText ?? product.title} fill sizes="(max-width: 768px) 100vw, 25vw" unoptimized={shouldBypassImageOptimization(product.featuredImage.url)} className="object-contain" /> : null}
              </div>
              <div className="mt-4 min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">{product.manufacturer ?? "Smokeify"}</p>
                <h2 className="mt-2 text-xl font-semibold">{product.title}</h2>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ["Preis", formatPrice(product.priceRange?.minVariantPrice)],
                  ["Verfügbarkeit", product.availableForSale ? (product.lowStock ? "Geringer Bestand" : "Verfügbar") : "Ausverkauft"],
                  ["Setup-Größe", product.growboxSize ?? "Nicht angegeben"],
                  ["Bewertung", product.reviewSummary?.count ? `${product.reviewSummary.average.toFixed(1)} / 5` : "Noch keine"],
                ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--gv-border)] bg-white px-4 py-3"><dt className="text-[color:var(--gv-text-muted)]">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}
              </dl>
              <div className="mt-auto space-y-3 pt-4 [&>button]:w-full">
                <Link href={`/products/${product.handle}`} className="smk-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold">Produkt ansehen</Link>
                <ProductCardActions productId={product.id} variantId={product.defaultVariantId} available={product.availableForSale} showWishlist={false} itemTitle={product.title} itemImageUrl={product.featuredImage?.url} itemImageAlt={product.featuredImage?.altText ?? product.title} itemPrice={product.priceRange?.minVariantPrice} itemQuantity={1} itemHandle={product.handle} />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
