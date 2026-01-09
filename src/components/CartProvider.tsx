"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AddedToCartModal from "@/components/AddedToCartModal";
import OutOfStockModal from "@/components/OutOfStockModal";
import type { Cart } from "@/lib/cart";

type AddedItem = {
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  quantity: number;
  productHandle?: string;
};

type CartCtx = {
  cart: Cart | null;
  loading: boolean;
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
  if (!res.ok) throw new Error("Failed to load cart");
  return res.json();
}

async function apiCartAction(payload: any): Promise<Cart> {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Cart action failed");
  return data;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [addedItem, setAddedItem] = useState<AddedItem | null>(null);
  const [addedOpen, setAddedOpen] = useState(false);
  const [outOfStockOpen, setOutOfStockOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const c = await apiGetCart();
      setCart(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const addToCart = async (variantId: string, quantity = 1) => {
    const c = await apiCartAction({ action: "add", variantId, quantity });
    setCart(c);
    return c;
  };

  const updateLine = async (lineId: string, quantity: number) => {
    const c = await apiCartAction({ action: "update", lineId, quantity });
    setCart(c);
  };

  const removeLines = async (lineIds: string[]) => {
    const c = await apiCartAction({ action: "remove", lineIds });
    setCart(c);
  };

  const value = useMemo(
    () => ({
      cart,
      loading,
      refresh,
      addToCart,
      updateLine,
      removeLines,
      openAddedModal: (item: AddedItem) => {
        setAddedItem(item);
        setAddedOpen(true);
      },
      closeAddedModal: () => setAddedOpen(false),
      openOutOfStockModal: () => setOutOfStockOpen(true),
      closeOutOfStockModal: () => setOutOfStockOpen(false),
    }),
    [cart, loading]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <AddedToCartModal
        open={addedOpen}
        item={addedItem}
        onClose={() => setAddedOpen(false)}
      />
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
