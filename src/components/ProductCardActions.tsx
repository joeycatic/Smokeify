"use client";

import { useState } from "react";
import { HeartIcon as HeartIconOutline } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { useCart } from "@/components/CartProvider";
import { useWishlist } from "@/hooks/useWishlist";

type Props = {
  productId: string;
  variantId: string | null;
  available: boolean;
  size?: "sm" | "lg";
  itemTitle?: string;
  itemImageUrl?: string | null;
  itemImageAlt?: string | null;
  itemPrice?: { amount: string; currencyCode: string };
  itemQuantity?: number;
};

export default function ProductCardActions({
  productId,
  variantId,
  available,
  size = "sm",
  itemTitle,
  itemImageUrl,
  itemImageAlt,
  itemPrice,
  itemQuantity = 1,
}: Props) {
  const { cart, addToCart, openAddedModal, openOutOfStockModal } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const [adding, setAdding] = useState(false);
  const canAdd = Boolean(variantId) && available && !adding;
  const wishlisted = isWishlisted(productId);
  const iconClass = size === "lg" ? "h-5 w-5" : "h-5 w-5";
  const buttonClass =
    size === "lg"
      ? "rounded-full border p-3 transition"
      : "rounded-full border p-3 transition";

  return (
    <>
      <button
        type="button"
        aria-label={wishlisted ? "Von Wunschliste entfernen" : "Zur Wunschliste"}
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
      <button
        type="button"
        disabled={!canAdd}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!variantId) return;
          setAdding(true);
          try {
            const beforeQty =
              cart?.lines.find((line) => line.merchandise.id === variantId)
                ?.quantity ?? 0;
            const updated = await addToCart(variantId, 1);
            const afterQty =
              updated.lines.find((line) => line.merchandise.id === variantId)
                ?.quantity ?? 0;
            if (afterQty <= beforeQty) {
              openOutOfStockModal();
              return;
            }
            if (itemTitle) {
              openAddedModal({
                title: itemTitle,
                imageUrl: itemImageUrl ?? undefined,
                imageAlt: itemImageAlt ?? undefined,
                price: itemPrice,
                quantity: itemQuantity,
              });
            }
          } catch {
            openOutOfStockModal();
          } finally {
            setAdding(false);
          }
        }}
        aria-label="In den Warenkorb"
        title="In den Warenkorb"
        className={`add-to-cart-sweep inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap transition cursor-pointer ${
          canAdd
            ? "border-green-900 bg-green-800 text-white shadow-sm hover:bg-green-900"
            : "border-stone-200 text-stone-400"
        } ${size === "lg" ? "px-6 py-3 text-sm" : "px-4 py-2.5 text-sm"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
      >
        <ShoppingCartIcon className={size === "lg" ? "h-5 w-5" : "h-5 w-5"} />
        In den Warenkorb
      </button>
    </>
  );
}
