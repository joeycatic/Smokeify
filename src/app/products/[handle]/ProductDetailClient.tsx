"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProductVariant } from "@/lib/shopify";
import { useCart } from "@/components/CartProvider";

export default function ProductDetailClient({
  product,
  variants,
}: {
  product: { id: string; title: string; vendor: string; descriptionHtml: string };
  variants: ProductVariant[];
  options: { name: string; values: string[] }[];
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants?.[0]?.id ?? ""
  );
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle"
  );
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

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

  const isAvailable = Boolean(selectedVariant?.availableForSale);

  useEffect(() => {
    setNotifyStatus("idle");
    setNotifyMessage(null);
  }, [selectedVariantId, isAvailable]);
  
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
            -
          </button>
          <div className="h-11 w-12 grid place-items-center text-sm text-black/80">
            {quantity}
          </div>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="h-11 w-11 text-black/80"
          >
            +
          </button>
        </div>
        <div className="mt-3">
          {selectedVariant?.availableForSale ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-green-700">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-green-600"
              />
              Sofort versandfertig, Lieferzeit ca. 1-3 Werktage
            </p>
          ) : (
            <p className="flex items-center gap-2 text-xs font-semibold text-red-700">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-red-600"
              />
              Zur Zeit nicht lieferbar
            </p>
          )}
        </div>
      </div>

      {isAvailable ? (
        <button
          type="button"
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
          className={`h-12 w-full rounded-md bg-black px-4 text-sm font-semibold text-white transition-transform duration-200 hover:opacity-90 ${
            addedPulse ? "scale-[1.03]" : "scale-100"
          }`}
        >
          Add to Cart
        </button>
      ) : (
        <form
          className="space-y-2 rounded-md border border-black/10 bg-white/70 p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!selectedVariantId) {
              setNotifyStatus("error");
              setNotifyMessage("Bitte Variante auswahlen.");
              return;
            }
            const email = notifyEmail.trim();
            if (!email) {
              setNotifyStatus("error");
              setNotifyMessage("Bitte eine E-Mail angeben.");
              return;
            }
            setNotifyStatus("loading");
            setNotifyMessage(null);
            try {
              const res = await fetch("/api/back-in-stock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email,
                  productId: product.id,
                  productTitle: product.title,
                  variantId: selectedVariantId,
                  variantTitle: selectedVariant?.title ?? null,
                }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Request failed");
              }
              setNotifyStatus("ok");
              setNotifyMessage("Wir benachrichtigen dich, sobald der Artikel verfugbar ist.");
              setNotifyEmail("");
            } catch (error) {
              setNotifyStatus("error");
              setNotifyMessage("Speichern fehlgeschlagen. Bitte erneut versuchen.");
            }
          }}
        >
          <label className="block text-xs font-semibold text-black/70">
            Email fur Benachrichtigung
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={notifyEmail}
              onChange={(event) => setNotifyEmail(event.target.value)}
              placeholder="deine@email.de"
              className="h-10 w-full rounded-md border border-black/15 px-3 text-sm outline-none focus:border-black/30"
              required
            />
            <button
              type="submit"
              disabled={notifyStatus === "loading"}
              className="h-10 rounded-md border border-black/20 px-4 text-sm font-semibold text-black/70 hover:border-black/40 disabled:opacity-50"
            >
              Benachrichtigen
            </button>
          </div>
          {notifyMessage && (
            <p
              className={`text-xs font-semibold ${
                notifyStatus === "ok" ? "text-green-700" : "text-red-600"
              }`}
            >
              {notifyMessage}
            </p>
          )}
        </form>
      )}
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
