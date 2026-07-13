"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useCart } from "@/components/CartProvider";

type Recommendation = {
  id: string;
  title: string;
  handle: string;
  variantId: string | null;
  availableForSale: boolean;
  imageUrl: string | null;
  price: { amount: string; currencyCode: string } | null;
};

export default function CartCrossSells({
  handles,
}: {
  handles: string[];
}) {
  const { addToCart } = useCart();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const uniqueHandles = useMemo(() => handles.slice(0, 3), [handles]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      uniqueHandles.map(async (handle) => {
        const response = await fetch(`/api/recommendations?handle=${encodeURIComponent(handle)}`);
        const data = (await response.json().catch(() => null)) as
          | { results?: Recommendation[] }
          | null;
        return data?.results ?? [];
      }),
    ).then((groups) => {
      if (cancelled) return;
      const selected = new Map<string, Recommendation>();
      groups.flat().forEach((item) => {
        if (
          selected.size < 4 &&
          item.variantId &&
          item.availableForSale &&
          !uniqueHandles.includes(item.handle)
        ) {
          selected.set(item.id, item);
        }
      });
      setItems(Array.from(selected.values()));
    });
    return () => {
      cancelled = true;
    };
  }, [uniqueHandles]);

  if (items.length === 0) return null;

  return (
    <section className="mt-8 overflow-hidden rounded-[30px] border border-[color:var(--gv-border)] bg-[linear-gradient(135deg,var(--gv-lime-glow),transparent_35%),var(--gv-dark)]">
      <div className="border-b border-[color:var(--gv-border)] px-5 py-4">
        <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-bold uppercase tracking-[.2em] text-[color:var(--gv-lime)]">
          Setup ergänzen
        </p>
        <h2 className="mt-1 font-[family:var(--font-syne)] text-xl font-bold text-[color:var(--gv-text)]">
          Passend zu deinem Warenkorb
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article key={item.id} className="border-b border-[color:var(--gv-border)] p-4 last:border-b-0 sm:border-r xl:border-b-0">
            <div className="flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.title} fill className="object-contain p-1" sizes="64px" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-[color:var(--gv-text)]">{item.title}</p>
                {item.price ? (
                  <p className="mt-1 text-sm font-bold text-[color:var(--gv-lime)]">
                    {new Intl.NumberFormat("de-DE", { style: "currency", currency: item.price.currencyCode }).format(Number(item.price.amount))}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={pending === item.id || !item.variantId}
              onClick={async () => {
                if (!item.variantId) return;
                setPending(item.id);
                try {
                  await addToCart(item.variantId, 1);
                } finally {
                  setPending(null);
                }
              }}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--gv-lime)]/25 bg-[color:var(--gv-lime)]/10 px-3 text-xs font-bold text-[color:var(--gv-lime)] hover:bg-[color:var(--gv-lime)] hover:text-[color:var(--gv-forest)] disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              {pending === item.id ? "Wird ergänzt …" : "Hinzufügen"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
