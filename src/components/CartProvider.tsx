"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AddedToCartModal from "@/components/AddedToCartModal";
import OutOfStockModal from "@/components/OutOfStockModal";
import type { Cart } from "@/lib/cart";

export type AddedItem = {
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: { amount: string; currencyCode: string };
  quantity: number;
  productHandle?: string;
};

type CartCtx = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<Cart>;
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

async function apiCartAction(payload: any): Promise<Cart> {
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    refresh();
  }, []);

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

  const addToCart = async (variantId: string, quantity = 1) => {
    try {
      const c = await apiCartAction({ action: "add", variantId, quantity });
      setCart(c);
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

  const updateLine = async (lineId: string, quantity: number) => {
    try {
      const c = await apiCartAction({ action: "update", lineId, quantity });
      setCart(c);
      const updatedLine = c.lines.find((line) => line.id === lineId);
      const updatedQty = updatedLine?.quantity ?? 0;
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
      const c = await apiCartAction({ action: "remove", lineIds });
      setCart(c);
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
      updateLine,
      removeLines,
      openAddedModal: (item: AddedItem) => {
        setAddedItem(item);
        setAddedOpen(true);
        window.dispatchEvent(
          new CustomEvent<AddedItem>("cart:item-added", { detail: item })
        );
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
      {!isMobile && (
        <AddedToCartModal
          open={addedOpen}
          item={addedItem}
          onClose={() => setAddedOpen(false)}
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
