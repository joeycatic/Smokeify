"use client";

import { useMemo, useState } from "react";
import type { ProductVariant } from "@/lib/shopify";
import { useCart } from "@/components/CartProvider";

export default function ProductDetailClient({
  product,
  variants,
}: {
  product: { title: string; vendor: string; descriptionHtml: string };
  variants: ProductVariant[];
  options: { name: string; values: string[] }[];
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants?.[0]?.id ?? ""
  );

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId]
  );

  const priceLabel = selectedVariant
    ? `€ ${Number(selectedVariant.price.amount).toFixed(2)}`
    : "";

  const { cart, addToCart } = useCart();
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addedPulse, setAddedPulse] = useState(false);
  
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-black/60">{product.vendor}</p>
        <h1 className="mt-1 text-3xl text-black font-semibold">{product.title}</h1>
        {selectedVariant && <p className="mt-3 text-xl font-semibold" style={{ color: '#196e41ff' }} >{priceLabel}</p>}
      </div>

      {variants.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Variant</p>
          <select
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="h-11 w-full rounded-md border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/30"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                {v.title} {!v.availableForSale ? "(Sold out)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-black/80 font-semibold">Quantity</p>
        <div className="inline-flex items-center rounded-md border border-black/15">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-11 w-11 text-black/80"
          >
            −
          </button>
          <div className="h-11 w-12 grid place-items-center text-sm text-black/80">{quantity}</div>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="h-11 w-11 text-black/80"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={!selectedVariant?.availableForSale}
        onClick={async () => {
          if (!selectedVariantId) {
            setToast({ type: "error", text: "Keine Variante gewahlt." });
            setTimeout(() => setToast(null), 1500);
            return;
          }

          const beforeQty =
            cart?.lines.find((line) => line.merchandise.id === selectedVariantId)
              ?.quantity ?? 0;

          try {
            const updated = await addToCart(selectedVariantId, quantity);
            const afterQty =
              updated?.lines.find((line) => line.merchandise.id === selectedVariantId)
                ?.quantity ?? 0;

            if (afterQty > beforeQty) {
              setToast({ type: "success", text: "Zum Warenkorb hinzugefugt." });
              setAddedPulse(true);
              setTimeout(() => setAddedPulse(false), 250);
            } else {
              setToast({ type: "error", text: "Nicht genug Bestand." });
            }
          } catch (e) {
            setToast({ type: "error", text: "Hinzufugen fehlgeschlagen." });
          } finally {
            setTimeout(() => setToast(null), 1500);
          }
        }}
        className={`h-12 w-full rounded-md bg-black px-4 text-sm font-semibold text-white transition-transform duration-200 hover:opacity-90 disabled:opacity-40 ${
          addedPulse ? "scale-[1.03]" : "scale-100"
        }`}
      >
        {selectedVariant?.availableForSale ? "Add to Cart" : "Sold out"}
      </button>
      {toast && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            toast.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="pt-4 border-t border-black/10">
        <p className="text-sm font-semibold mb-2 text-black/80">Description</p>
        <div
          className="prose prose-sm max-w-none text-black/80"
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
        />
      </div>
    </div>
  );
}
