"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/types";
import EmptyState from "@/components/common/EmptyState";
import { useProductCompare } from "@/hooks/useProductCompare";

type CompareApiResponse = {
  products?: Product[];
};

const formatPrice = (price?: { amount: string; currencyCode: string } | null) => {
  if (!price) return "Preis aufrufen";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
};

const getCategoryLabel = (product: Product) =>
  product.categories?.[0]?.title ?? product.collections?.[0]?.title ?? "Sortiment";

export default function CompareProductsClient() {
  const { ids, clear, toggle } = useProductCompare();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => ids.join(","), [ids]);

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/products/compare?ids=${encodeURIComponent(key)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((data: CompareApiResponse) => setProducts(data.products ?? []))
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setProducts([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ids.length, key]);

  if (ids.length === 0 && !loading) {
    return (
      <EmptyState
        eyebrow="Produktvergleich"
        title="Noch keine Produkte im Vergleich"
        description="Merke dir Produkte direkt aus dem Katalog oder von Produktseiten, um Preis, Kategorie, Bestand und Rolle im Setup nebeneinander zu prüfen."
        actions={[
          { label: "Produkte entdecken", href: "/products", tone: "primary" },
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[40px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_left,rgba(241,198,132,0.18),transparent_28%),linear-gradient(135deg,rgba(24,20,17,0.98),rgba(13,12,11,1))] px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.34)] sm:px-10">
        <div className="relative max-w-3xl">
          <p className="smk-kicker">Smokeify Compare</p>
          <h1 className="smk-heading mt-4 text-4xl text-[var(--smk-text)] sm:text-5xl">
            Produkte sauber gegeneinander prüfen.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
            Vergleiche deine favorisierten Smokeify Produkte nach Rolle im Setup,
            Preis, Marke und Verfügbarkeit. Die Auswahl bleibt lokal in deinem
            Browser und verändert keine Warenkorb- oder Checkout-Logik.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--smk-text-muted)]">
          {loading ? "Lädt..." : `${products.length} Produkte im Vergleich`}
        </p>
        <div className="flex gap-2">
          <Link
            href="/products"
            className="smk-button-secondary inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold"
          >
            Weitere Produkte
          </Link>
          <button
            type="button"
            onClick={clear}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--smk-border)] px-4 text-xs font-semibold text-[var(--smk-text-muted)] transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)]"
          >
            Vergleich leeren
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[32px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)]">
        <div
          className="grid min-w-[760px]"
          style={{ gridTemplateColumns: `180px repeat(${Math.max(products.length, 1)}, minmax(190px, 1fr))` }}
        >
          <div className="border-b border-r border-[var(--smk-border)] p-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
            Merkmal
          </div>
          {products.map((product) => (
            <div key={product.id} className="border-b border-r border-[var(--smk-border)] p-4">
              <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl bg-white">
                {product.featuredImage ? (
                  <Image
                    src={product.featuredImage.url}
                    alt={product.featuredImage.altText ?? product.title}
                    fill
                    sizes="220px"
                    className="object-contain p-4"
                  />
                ) : null}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--smk-text-dim)]">
                {product.manufacturer ?? "Smokeify"}
              </p>
              <Link
                href={`/products/${product.handle}`}
                className="mt-1 block text-sm font-semibold leading-5 text-[var(--smk-text)] transition hover:text-[var(--smk-accent)]"
              >
                {product.title}
              </Link>
              <button
                type="button"
                onClick={() => toggle(product.id)}
                className="mt-3 text-xs font-semibold text-[var(--smk-text-dim)] transition hover:text-[var(--smk-text)]"
              >
                Entfernen
              </button>
            </div>
          ))}

          {[
            ["Preis", products.map((product) => formatPrice(product.priceRange?.minVariantPrice))],
            ["Kategorie", products.map(getCategoryLabel)],
            ["Verfügbarkeit", products.map((product) => (product.availableForSale ? "Verfügbar" : "Ausverkauft"))],
            ["Bestand", products.map((product) =>
              product.defaultVariantAvailableQuantity != null
                ? `${product.defaultVariantAvailableQuantity} verfügbar`
                : "Nicht angegeben",
            )],
            ["Bewertung", products.map((product) =>
              product.reviewSummary && product.reviewSummary.count > 0
                ? `${product.reviewSummary.average.toFixed(1)} / 5 (${product.reviewSummary.count})`
                : "Noch keine Bewertungen",
            )],
            ["Growbox-Größe", products.map((product) => product.growboxSize ?? "Nicht zutreffend")],
          ].map(([label, values]) => (
            <div key={label as string} className="contents">
              <div className="border-b border-r border-[var(--smk-border)] p-4 text-sm font-semibold text-[var(--smk-text)]">
                {label as string}
              </div>
              {(values as string[]).map((value, index) => (
                <div
                  key={`${label}-${index}`}
                  className="border-b border-r border-[var(--smk-border)] p-4 text-sm text-[var(--smk-text-muted)]"
                >
                  {value}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
