"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useCart } from "@/components/CartProvider";

export type FBTProduct = {
  id: string;
  title: string;
  handle: string;
  variantId: string | null;
  imageUrl: string | null;
  price: { amount: string; currencyCode: string } | null;
  availableForSale: boolean;
};

type Props = {
  currentProduct: {
    title: string;
    imageUrl: string | null;
    variantId: string | null;
    price: { amount: string; currencyCode: string } | null;
    availableForSale: boolean;
  };
  items: FBTProduct[];
};

const formatPrice = (price: { amount: string; currencyCode: string } | null) => {
  if (!price) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
};

export default function FrequentlyBoughtTogether({ currentProduct, items }: Props) {
  const { addManyToCart } = useCart();
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    items.filter((item) => item.availableForSale && item.variantId).map((item) => item.id)
  );
  const [currentQty, setCurrentQty] = useState(1);
  const [bundleQuantities, setBundleQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const total = useMemo(() => {
    const base = Number(currentProduct.price?.amount ?? 0) * currentQty;
    const extras = selectedItems.reduce(
      (sum, item) =>
        sum + Number(item.price?.amount ?? 0) * (bundleQuantities[item.id] ?? 1),
      0
    );
    return base + extras;
  }, [bundleQuantities, currentProduct.price?.amount, currentQty, selectedItems]);

  if (items.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">Häufig zusammen gekauft</h2>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[{ id: "current", imageUrl: currentProduct.imageUrl, title: currentProduct.title }, ...items]
          .slice(0, 4)
          .map((item, index, arr) => (
            <div key={item.id} className="flex items-center gap-2">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-md border border-black/10 object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-md border border-dashed border-black/10 bg-stone-50" />
              )}
              {index < arr.length - 1 ? (
                <span className="text-sm font-semibold text-stone-400">+</span>
              ) : null}
            </div>
          ))}
      </div>

      <div className="mt-4 space-y-2">
        <label className="flex items-center justify-between gap-4 rounded-md bg-stone-50 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-3">
            <input type="checkbox" checked disabled />
            <span>{currentProduct.title}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={currentQty}
              onChange={(event) =>
                setCurrentQty(
                  Math.max(1, Math.min(10, Math.floor(Number(event.target.value) || 1)))
                )
              }
              className="h-8 w-16 rounded-md border border-black/15 bg-white px-2 text-xs"
              aria-label="Menge Hauptprodukt"
            />
          </span>
          <span className="font-semibold text-stone-800">{formatPrice(currentProduct.price)}</span>
        </label>

        {items.map((item) => (
          <label
            key={item.id}
            className={`flex items-center justify-between gap-4 rounded-md px-3 py-2 text-sm ${
              item.availableForSale ? "bg-stone-50" : "bg-stone-100 text-stone-500"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                disabled={!item.availableForSale || !item.variantId || submitting}
                onChange={() =>
                  setSelectedIds((prev) =>
                    prev.includes(item.id)
                      ? prev.filter((id) => id !== item.id)
                      : [...prev, item.id]
                  )
                }
              />
              <span>{item.title}</span>
              <input
                type="number"
                min={1}
                max={10}
                value={bundleQuantities[item.id] ?? 1}
                disabled={!selectedIds.includes(item.id) || submitting}
                onChange={(event) =>
                  setBundleQuantities((prev) => ({
                    ...prev,
                    [item.id]: Math.max(
                      1,
                      Math.min(10, Math.floor(Number(event.target.value) || 1)
                    )),
                  }))
                }
                className="h-8 w-16 rounded-md border border-black/15 bg-white px-2 text-xs"
                aria-label={`Menge ${item.title}`}
              />
            </span>
            <span className="font-semibold text-stone-800">{formatPrice(item.price)}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-700">
          Gesamtpreis:{" "}
          <span className="font-semibold">
            {new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
            }).format(total)}
          </span>
        </p>
        <button
          type="button"
          disabled={
            submitting ||
            !currentProduct.availableForSale ||
            !currentProduct.variantId
          }
          onClick={async () => {
            if (!currentProduct.variantId) return;
            setSubmitting(true);
            setMessage(null);
            try {
              await addManyToCart([
                { variantId: currentProduct.variantId, quantity: currentQty },
                ...selectedItems
                  .filter((item) => Boolean(item.variantId))
                  .map((item) => ({
                    variantId: item.variantId as string,
                    quantity: bundleQuantities[item.id] ?? 1,
                  })),
              ]);
              setMessage("Bundle zum Warenkorb hinzugefügt.");
            } catch {
              setMessage("Hinzufügen fehlgeschlagen.");
            } finally {
              setSubmitting(false);
            }
          }}
          className="h-10 rounded-md bg-[#2f3e36] px-4 text-sm font-semibold text-white hover:bg-[#24312b] disabled:opacity-60"
        >
          {submitting ? "Hinzufügen..." : "Bundle hinzufügen"}
        </button>
      </div>

      {message ? (
        <p className="mt-2 text-xs text-stone-600">{message}</p>
      ) : null}
    </section>
  );
}
