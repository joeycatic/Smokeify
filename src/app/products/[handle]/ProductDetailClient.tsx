"use client";

import { useEffect, useMemo, useState } from "react";
import { CubeIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useCart } from "@/components/CartProvider";

type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  lowStock?: boolean;
  availableQuantity?: number;
  lowStockThreshold?: number;
  price: { amount: string; currencyCode: string };
  compareAt?: { amount: string; currencyCode: string } | null;
};
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ProductDetailClient({
  product,
  variants,
  imageUrl,
  imageAlt,
}: {
  product: {
    id: string;
    title: string;
    descriptionHtml: string;
    technicalDetailsHtml?: string;
    shortDescription?: string | null;
    manufacturer?: string | null;
  };
  variants: ProductVariant[];
  imageUrl?: string | null;
  imageAlt?: string | null;
}) {
  const [quantity, setQuantity] = useState(1);
  const [qtyPulse, setQtyPulse] = useState<"inc" | "dec" | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants?.[0]?.id ?? "",
  );
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId],
  );

  const priceLabel = selectedVariant ? formatPrice(selectedVariant.price) : "";
  const compareAtLabel =
    selectedVariant?.compareAt &&
    selectedVariant.compareAt.amount !== selectedVariant.price.amount
      ? formatPrice(selectedVariant.compareAt)
      : null;

  const { cart, addToCart, openAddedModal } = useCart();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [addedPulse, setAddedPulse] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isAvailable = Boolean(selectedVariant?.availableForSale);
  const cartQuantity =
    cart?.lines.find((line) => line.merchandise.id === selectedVariantId)
      ?.quantity ?? 0;
  const effectiveAvailable =
    (selectedVariant?.availableQuantity ?? 0) - cartQuantity;
  const isLowStock =
    Boolean(selectedVariant?.availableForSale) &&
    selectedVariant?.lowStockThreshold !== undefined &&
    effectiveAvailable > 0 &&
    effectiveAvailable <= (selectedVariant?.lowStockThreshold ?? 0);

  useEffect(() => {
    setNotifyStatus("idle");
    setNotifyMessage(null);
  }, [selectedVariantId, isAvailable]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        {product.manufacturer && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            {product.manufacturer}
          </p>
        )}
        <h1 className="mt-1 text-2xl text-black font-semibold sm:text-3xl">
          {product.title}
        </h1>
        {selectedVariant && (
          <div className="mt-3 flex items-baseline gap-2">
            {compareAtLabel && (
              <span className="text-base font-semibold text-yellow-600 line-through">
                {compareAtLabel}
              </span>
            )}
            <span className="text-lg font-semibold text-black sm:text-xl">
              {priceLabel}
            </span>
          </div>
        )}
      </div>

      {variants.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Variant</p>
          <select
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="h-11 w-full rounded-md border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
            aria-label="Menge verringern"
            onClick={() => {
              setQuantity((q) => Math.max(1, q - 1));
              setQtyPulse("dec");
              setTimeout(() => setQtyPulse(null), 160);
            }}
            className={`h-9 w-9 text-base font-semibold text-black/80 transition-transform duration-150 ${
              qtyPulse === "dec" ? "scale-95" : "scale-100"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
          >
            <span className="inline-block scale-x-150">-</span>
          </button>
          <div className="h-9 w-10 grid place-items-center text-sm font-semibold text-black/80">
            {quantity}
          </div>
          <button
            type="button"
            aria-label="Menge erhöhen"
            onClick={() => {
              setQuantity((q) => q + 1);
              setQtyPulse("inc");
              setTimeout(() => setQtyPulse(null), 160);
            }}
            className={`h-9 w-9 text-base font-semibold text-black/80 transition-transform duration-150 ${
              qtyPulse === "inc" ? "scale-105" : "scale-100"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
          >
            +
          </button>
        </div>
        <div className="mt-3">
          {selectedVariant?.availableForSale ? (
            <div className="space-y-1">
              {isLowStock ? (
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-amber-600"
                  />
                  Geringer Bestand
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-xs font-semibold text-green-700">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-green-600"
                />
                Sofort versandfertig, Lieferzeit ca. 1-3 Werktage
              </p>
            </div>
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
              cart?.lines.find(
                (line) => line.merchandise.id === selectedVariantId,
              )?.quantity ?? 0;

            try {
              const updated = await addToCart(selectedVariantId, quantity);
              const afterQty =
                updated?.lines.find(
                  (line) => line.merchandise.id === selectedVariantId,
                )?.quantity ?? 0;

              if (afterQty > beforeQty) {
                setToast({
                  type: "success",
                  text: "Zum Warenkorb hinzugefugt.",
                });
                setAddedPulse(true);
                setTimeout(() => setAddedPulse(false), 250);
                if (isMobile && selectedVariant) {
                  openAddedModal({
                    title: product.title,
                    imageUrl: imageUrl ?? undefined,
                    imageAlt: imageAlt ?? product.title,
                    price: selectedVariant.price,
                    quantity,
                  });
                }
              } else {
                setToast({ type: "error", text: "Nicht genug Bestand." });
              }
            } catch (e) {
              setToast({ type: "error", text: "Hinzufugen fehlgeschlagen." });
            } finally {
              setTimeout(() => setToast(null), 1500);
            }
          }}
          className={`h-12 w-full rounded-md bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
            addedPulse ? "scale-[1.03]" : "scale-100"
          }`}
        >
          In den Warenkorb
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
              setNotifyMessage(
                "Wir benachrichtigen dich, sobald der Artikel verfugbar ist.",
              );
              setNotifyEmail("");
            } catch (error) {
              setNotifyStatus("error");
              setNotifyMessage(
                "Speichern fehlgeschlagen. Bitte erneut versuchen.",
              );
            }
          }}
        >
          <label
            htmlFor="notify-email"
            className="block text-xs font-semibold text-black/70"
          >
            Email fur Benachrichtigung
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="notify-email"
              type="email"
              value={notifyEmail}
              onChange={(event) => setNotifyEmail(event.target.value)}
              placeholder="deine@email.de"
              className="h-10 w-full rounded-md border border-black/15 px-3 text-sm outline-none focus:border-black/30 focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              required
            />
            <button
              type="submit"
              disabled={notifyStatus === "loading"}
              className="h-10 rounded-md border border-black/20 px-4 text-sm font-semibold text-black/70 hover:border-black/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {notifyStatus === "loading" ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Bitte warten...
                </span>
              ) : (
                "Benachrichtigen"
              )}
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
            toast.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {toast.text}
        </div>
      )}

      {product.shortDescription ? (
        <div className="rounded-lg border border-black/10 bg-white/80 px-4 py-3 text-[15px] leading-6 text-stone-700 shadow-sm">
          <div className="border-l-2 border-emerald-700/40 pl-3">
            {product.shortDescription}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {product.technicalDetailsHtml ? (
          <div className="rounded-xl border border-black/10 bg-white">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-sm font-semibold text-black/80">
                  <CubeIcon className="h-5 w-5 text-black/60" />
                  Technische Details
                </span>
                <PlusIcon className="h-5 w-5 text-black/60 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
                <div className="overflow-hidden px-5 pb-5">
                  <div
                    className="product-description"
                    dangerouslySetInnerHTML={{
                      __html: product.technicalDetailsHtml,
                    }}
                  />
                </div>
              </div>
            </details>
          </div>
        ) : null}
        <div className="rounded-xl border border-black/10 bg-white">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-sm font-semibold text-black/80">
                <CubeIcon className="h-5 w-5 text-black/60" />
                Versand & Rücksendungen
              </span>
              <PlusIcon className="h-5 w-5 text-black/60 transition-transform duration-300 group-open:rotate-45" />
            </summary>
            <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
              <div className="overflow-hidden px-5 pb-5 text-sm text-black/70">
                <p>
                  Lieferzeit in der Regel 1-3 Werktage nach Bestätigung der
                  Verfügbarkeit. Ruecksendungen innerhalb von 14 Tagen möglich.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-black/70">
                  <a
                    className="underline decoration-black/30 underline-offset-4 hover:decoration-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    href="/pages/shipping"
                  >
                    Versanddetails
                  </a>
                  <a
                    className="underline decoration-black/30 underline-offset-4 hover:decoration-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    href="/pages/return"
                  >
                    Rücksendungen
                  </a>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function formatPrice(price?: { amount: string; currencyCode: string }) {
  if (!price) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
}
