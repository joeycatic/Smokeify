"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Cart } from "@/lib/cart";
import { trackAnalyticsEvent } from "@/lib/analytics";

const AddedToCartModal = dynamic(() => import("@/components/AddedToCartModal"), {
  ssr: false,
});
const OutOfStockModal = dynamic(() => import("@/components/OutOfStockModal"), {
  ssr: false,
});

export type AddedItem = {
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: { amount: string; currencyCode: string };
  quantity: number;
  productHandle?: string;
  variantChoices?: Array<{
    id: string;
    title: string;
    available: boolean;
    options: Array<{ name: string; value: string }>;
  }>;
  confirmAdd?: (payload: {
    variantId: string;
    label?: string;
    options?: Array<{ name: string; value: string }>;
  }) => Promise<boolean>;
};

type CartCtx = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addToCart: (
    variantId: string,
    quantity?: number,
    options?: Array<{ name: string; value: string }>
  ) => Promise<Cart>;
  addManyToCart: (
    items: Array<{
      variantId: string;
      quantity?: number;
      options?: Array<{ name: string; value: string }>;
    }>
  ) => Promise<Cart>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
  removeLines: (lineIds: string[]) => Promise<void>;
  openAddedModal: (item: AddedItem) => void;
  closeAddedModal: () => void;
  openOutOfStockModal: () => void;
  closeOutOfStockModal: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

async function apiGetCart(): Promise<Cart> {
  const res = await fetch("/api/cart", { method: "GET" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to load cart");
  }
  return res.json();
}

async function apiCartAction(payload: unknown): Promise<Cart> {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Cart action failed");
  return data;
}

const normalizeError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const toItemPayload = (line: Cart["lines"][number], quantity: number) => {
  const unitPrice = Number(line.merchandise.price.amount);
  return {
    item_id: line.merchandise.id,
    item_name: line.merchandise.product.title,
    item_variant: line.merchandise.title,
    item_brand: line.merchandise.product.manufacturer ?? undefined,
    item_category: line.merchandise.product.categories?.[0]?.name,
    price: Number.isFinite(unitPrice) ? unitPrice : undefined,
    quantity,
  };
};

const trackAddToCart = (line: Cart["lines"][number] | undefined, quantity: number) => {
  if (!line) return;
  const unitPrice = Number(line.merchandise.price.amount);
  const value = Number.isFinite(unitPrice) ? unitPrice * quantity : undefined;
    trackAnalyticsEvent("add_to_cart", {
    currency: line.merchandise.price.currencyCode,
    value,
    items: [toItemPayload(line, quantity)],
  });
};

const trackRemoveFromCart = (
  line: Cart["lines"][number] | undefined,
  quantity: number,
) => {
  if (!line || quantity <= 0) return;
  const unitPrice = Number(line.merchandise.price.amount);
  const value = Number.isFinite(unitPrice) ? unitPrice * quantity : undefined;
    trackAnalyticsEvent("remove_from_cart", {
    currency: line.merchandise.price.currencyCode,
    value,
    items: [toItemPayload(line, quantity)],
  });
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedItem, setAddedItem] = useState<AddedItem | null>(null);
  const [addedOpen, setAddedOpen] = useState(false);
  const [outOfStockOpen, setOutOfStockOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await apiGetCart();
      setCart(c);
    } catch (err) {
      setError(normalizeError(err, "Failed to load cart"));
    } finally {
      setLoading(false);
    }
  };

  const shouldLoadCartImmediately =
    pathname === "/cart" ||
    pathname?.startsWith("/checkout") ||
    pathname?.startsWith("/order");

  useEffect(() => {
    if (shouldLoadCartImmediately) {
      void refresh();
      return;
    }
    const timer = window.setTimeout(() => {
      void refresh();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [shouldLoadCartImmediately]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void refresh();
  }, [status]);

  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 3000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const addToCart = async (
    variantId: string,
    quantity = 1,
    options?: Array<{ name: string; value: string }>
  ) => {
    try {
      const c = await apiCartAction({ action: "add", variantId, quantity, options });
      setCart(c);
      const addedLine = c.lines.find((line) => line.merchandise.id === variantId);
      trackAddToCart(addedLine, quantity);
      setError(null);
      setErrorToast(null);
      return c;
    } catch (err) {
      const message = normalizeError(err, "Cart action failed");
      setError(message);
      setErrorToast(message);
      throw err;
    }
  };

  const addManyToCart = async (
    items: Array<{
      variantId: string;
      quantity?: number;
      options?: Array<{ name: string; value: string }>;
    }>
  ) => {
    const normalized = items
      .map((item) => ({
        variantId: item.variantId,
        quantity: Math.max(1, Math.floor(Number(item.quantity ?? 1))),
        options: item.options,
      }))
      .filter((item) => item.variantId);
    if (normalized.length === 0) {
      throw new Error("No items to add");
    }
    try {
      const c = await apiCartAction({ action: "addMany", items: normalized });
      setCart(c);
      setError(null);
      setErrorToast(null);
      normalized.forEach((item) => {
        const line = c.lines.find((entry) => entry.merchandise.id === item.variantId);
        trackAddToCart(line, item.quantity);
      });
      return c;
    } catch (err) {
      const message = normalizeError(err, "Cart action failed");
      setError(message);
      setErrorToast(message);
      throw err;
    }
  };

  const updateLine = async (lineId: string, quantity: number) => {
    try {
      const beforeLine = cart?.lines.find((line) => line.id === lineId);
      const beforeQty = beforeLine?.quantity ?? 0;
      const c = await apiCartAction({ action: "update", lineId, quantity });
      setCart(c);
      const updatedLine = c.lines.find((line) => line.id === lineId);
      const updatedQty = updatedLine?.quantity ?? 0;
      if (beforeLine && updatedQty < beforeQty) {
        trackRemoveFromCart(beforeLine, beforeQty - updatedQty);
      }
      if (quantity > updatedQty) {
        const message = "Nicht genug Bestand verfügbar.";
        setError(message);
        setErrorToast(message);
        setOutOfStockOpen(true);
        return;
      }
      setError(null);
      setErrorToast(null);
    } catch (err) {
      const message = normalizeError(err, "Cart update failed");
      setError(message);
      setErrorToast(message);
    }
  };

  const removeLines = async (lineIds: string[]) => {
    try {
      const removedLines =
        cart?.lines.filter((line) => lineIds.includes(line.id)) ?? [];
      const c = await apiCartAction({ action: "remove", lineIds });
      setCart(c);
      removedLines.forEach((line) => trackRemoveFromCart(line, line.quantity));
      setError(null);
      setErrorToast(null);
    } catch (err) {
      const message = normalizeError(err, "Cart update failed");
      setError(message);
      setErrorToast(message);
    }
  };

  const value = useMemo(
    () => ({
      cart,
      loading,
      error: errorToast,
      refresh,
      addToCart,
      addManyToCart,
      updateLine,
      removeLines,
      openAddedModal: (item: AddedItem) => {
        setAddedItem(item);
        setAddedOpen(true);
        if (!item.confirmAdd) {
          window.dispatchEvent(
            new CustomEvent<AddedItem>("cart:item-added", { detail: item })
          );
        }
      },
      closeAddedModal: () => setAddedOpen(false),
      openOutOfStockModal: () => setOutOfStockOpen(true),
      closeOutOfStockModal: () => setOutOfStockOpen(false),
    }),
    [cart, loading, errorToast]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {(!isMobile || addedItem?.confirmAdd) && (
        <AddedToCartModal
          open={addedOpen}
          item={addedItem}
          onClose={() => setAddedOpen(false)}
          cartSubtotal={cart ? Number(cart.cost.subtotalAmount.amount) : undefined}
        />
      )}
      <OutOfStockModal
        open={outOfStockOpen}
        onClose={() => setOutOfStockOpen(false)}
      />
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
