"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { Product } from "@/data/types";
import { useProductCompare } from "@/hooks/useProductCompare";

type CompareApiResponse = {
  products?: Product[];
};

export default function CompareTray() {
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
        if ((error as Error).name !== "AbortError") {
          setProducts([]);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ids.length, key]);

  if (ids.length === 0) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[850] mx-auto max-w-5xl rounded-[28px] border border-[var(--smk-border)] bg-[linear-gradient(180deg,rgba(27,23,20,0.98),rgba(12,12,11,0.99))] p-3 text-[var(--smk-text)] shadow-2xl shadow-black/50 backdrop-blur-xl sm:inset-x-6 sm:bottom-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="smk-kicker text-[10px]">Produktvergleich</p>
          <p className="mt-1 text-sm font-semibold text-[var(--smk-text)]">
            {loading ? "Vergleich wird geladen..." : `${ids.length} Produkte vorgemerkt`}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto sm:justify-center">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex min-w-[210px] items-center gap-2 rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-2"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white">
                {product.featuredImage ? (
                  <Image
                    src={product.featuredImage.url}
                    alt={product.featuredImage.altText ?? product.title}
                    fill
                    sizes="44px"
                    className="object-contain p-1.5"
                  />
                ) : null}
              </div>
              <Link
                href={`/products/${product.handle}`}
                className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--smk-text)] transition hover:text-[var(--smk-accent)]"
              >
                {product.title}
              </Link>
              <button
                type="button"
                onClick={() => toggle(product.id)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--smk-border)] text-[var(--smk-text-muted)] transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)]"
                aria-label={`${product.title} aus Vergleich entfernen`}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={clear}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--smk-border)] px-4 text-xs font-semibold text-[var(--smk-text-muted)] transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)]"
          >
            Leeren
          </button>
          <Link
            href="/products/compare"
            className="smk-button-primary inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold"
          >
            Vergleichen
          </Link>
        </div>
      </div>
    </aside>
  );
}
