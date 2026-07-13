"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "smokeify_product_compare";
const CHANGE_EVENT = "smokeify:product-compare-change";
const MAX_PRODUCTS = 4;

const readIds = () => {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_PRODUCTS)
      : [];
  } catch {
    return [] as string[];
  }
};

const writeIds = (ids: string[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: ids }));
};

export function useProductCompare() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(readIds());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const toggle = useCallback((productId: string) => {
    const current = readIds();
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId].slice(-MAX_PRODUCTS);
    writeIds(next);
  }, []);

  const clear = useCallback(() => writeIds([]), []);
  const isCompared = useCallback((productId: string) => ids.includes(productId), [ids]);

  return { ids, toggle, clear, isCompared, maxProducts: MAX_PRODUCTS };
}
