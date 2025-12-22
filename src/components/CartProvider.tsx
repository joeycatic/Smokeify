"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ShopifyCart } from "@/lib/shopifyCart";

type CartCtx = {
  cart: ShopifyCart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<ShopifyCart>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
  removeLines: (lineIds: string[]) => Promise<void>;
};

const CartContext = createContext<CartCtx | null>(null);

async function apiGetCart(): Promise<ShopifyCart> {
  const res = await fetch("/api/cart", { method: "GET" });
  if (!res.ok) throw new Error("Failed to load cart");
  return res.json();
}

async function apiCartAction(payload: any): Promise<ShopifyCart> {
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
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [loading, setLoading] = useState(true);

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
    () => ({ cart, loading, refresh, addToCart, updateLine, removeLines }),
    [cart, loading]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
