"use client";

import { useState } from "react";
import { HeartIcon as HeartIconOutline } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { useCart } from "@/components/CartProvider";
import { useWishlist } from "@/hooks/useWishlist";

type VariantOption = {
  name: string;
  value: string;
};

type VariantChoice = {
  id: string;
  title: string;
  available: boolean;
  options: VariantOption[];
};

const isMeaningfulVariantTitle = (title: string) =>
  !/^(default|default title)$/i.test(title.trim());

const normalizeOptions = (options?: VariantOption[]) => {
  if (!options?.length) return [];
  const seen = new Set<string>();
  const normalized: VariantOption[] = [];
  options.forEach((opt) => {
    const name = String(opt?.name ?? "").trim();
    const value = String(opt?.value ?? "").trim();
    if (!name || !value) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ name, value });
  });
  return normalized;
};

const serializeOptionsKey = (options?: VariantOption[]) => {
  if (!options?.length) return "";
  const parts = options.map(
    (opt) => `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`
  );
  parts.sort();
  return parts.join("&");
};

const getLineId = (variantId: string, options?: VariantOption[]) => {
  const key = serializeOptionsKey(options);
  return key ? `${variantId}::${key}` : variantId;
};

type Props = {
  productId: string;
  variantId: string | null;
  available: boolean;
  size?: "sm" | "lg";
  showWishlist?: boolean;
  showCart?: boolean;
  hideCartLabel?: boolean;
  itemTitle?: string;
  itemImageUrl?: string | null;
  itemImageAlt?: string | null;
  itemPrice?: { amount: string; currencyCode: string };
  itemQuantity?: number;
  itemHandle?: string;
};

export default function ProductCardActions({
  productId,
  variantId,
  available,
  size = "sm",
  showWishlist = true,
  showCart = true,
  hideCartLabel = false,
  itemTitle,
  itemImageUrl,
  itemImageAlt,
  itemPrice,
  itemQuantity = 1,
  itemHandle,
}: Props) {
  const { cart, addToCart, openAddedModal, openOutOfStockModal } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const [adding, setAdding] = useState(false);
  const [variantChoices, setVariantChoices] = useState<VariantChoice[] | null>(
    null
  );
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const wishlisted = isWishlisted(productId);
  const iconClass = size === "lg" ? "h-5 w-5" : "h-5 w-5";
  const cartIconClass = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const buttonClass =
    size === "lg"
      ? "rounded-full border p-2.5 transition"
      : "rounded-full border p-2.5 transition";
  const cartGapClass = hideCartLabel ? "gap-0 sm:gap-2" : "gap-2";

  const ensureVariantChoices = async () => {
    if (variantChoices) return variantChoices;
    setVariantLoading(true);
    setVariantError(null);
    try {
      const endpoint = itemHandle
        ? `/api/products/handle/${encodeURIComponent(itemHandle)}/variants`
        : `/api/products/${productId}/variants`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { variants?: VariantChoice[] };
      const next = data.variants ?? [];
      setVariantChoices(next);
      return next;
    } catch (error) {
      setVariantError(
        error instanceof Error ? error.message : "Varianten konnten nicht geladen werden."
      );
      return [];
    } finally {
      setVariantLoading(false);
    }
  };

  const addVariantToCart = async (
    variantToAdd: string,
    label?: string,
    options?: VariantOption[]
  ) => {
    setAdding(true);
    try {
      const normalizedOptions = normalizeOptions(options);
      const lineId = getLineId(variantToAdd, normalizedOptions);
      const beforeQty = cart?.lines.find((line) => line.id === lineId)?.quantity ?? 0;
      const updated = await addToCart(variantToAdd, 1, normalizedOptions);
      const afterQty =
        updated.lines.find((line) => line.id === lineId)?.quantity ?? 0;
      if (afterQty <= beforeQty) {
        openOutOfStockModal();
        return false;
      }
      if (itemTitle) {
        const title = label ? `${itemTitle} · ${label}` : itemTitle;
        openAddedModal({
          title,
          imageUrl: itemImageUrl ?? undefined,
          imageAlt: itemImageAlt ?? undefined,
          price: itemPrice,
          quantity: itemQuantity,
          productHandle: itemHandle,
        });
      }
      return true;
    } catch {
      openOutOfStockModal();
      return false;
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {showWishlist && (
        <button
          type="button"
          aria-label={
            wishlisted ? "Von Wunschliste entfernen" : "Zur Wunschliste"
          }
          aria-pressed={wishlisted}
          title="Zur Wunschliste"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(productId);
          }}
          className={`${buttonClass} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
            wishlisted
              ? "border-green-200 text-green-700"
              : "border-stone-200 text-stone-700 hover:border-green-200 hover:text-green-700"
          }`}
        >
          {wishlisted ? (
            <HeartIconSolid className={iconClass} />
          ) : (
            <HeartIconOutline className={iconClass} />
          )}
        </button>
      )}
      {showCart && (
        <button
          type="button"
          disabled={!available || adding}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const choices = await ensureVariantChoices();
            const hasOptions = choices.some(
              (choice) =>
                choice.options.length > 0 || isMeaningfulVariantTitle(choice.title)
            );
            if (!hasOptions) {
              const fallback = choices[0]?.id ?? variantId;
              if (!fallback) return;
              await addVariantToCart(fallback);
              return;
            }
            if (!itemTitle) return;
            openAddedModal({
              title: itemTitle,
              imageUrl: itemImageUrl ?? undefined,
              imageAlt: itemImageAlt ?? undefined,
              price: itemPrice,
              quantity: itemQuantity,
              productHandle: itemHandle,
              variantChoices: choices,
              confirmAdd: async ({ variantId, label, options }) =>
                addVariantToCart(variantId, label, options),
            });
          }}
          aria-label="In den Warenkorb"
          title="In den Warenkorb"
          className={`add-to-cart-sweep inline-flex items-center ${cartGapClass} rounded-full border font-semibold whitespace-nowrap transition cursor-pointer ${
            available && !adding
              ? "border-green-900 bg-green-800 text-white shadow-sm hover:bg-green-900"
              : "border-stone-200 text-stone-400"
          } ${size === "lg" ? "px-5 py-2.5 text-sm" : "px-3.5 py-2 text-sm"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
        >
          <ShoppingCartIcon className={cartIconClass} />
          {hideCartLabel ? (
            <>
              <span className="sr-only">In den Warenkorb</span>
              <span className="hidden sm:inline">In den Warenkorb</span>
            </>
          ) : (
            "In den Warenkorb"
          )}
        </button>
      )}
    </>
  );
}

