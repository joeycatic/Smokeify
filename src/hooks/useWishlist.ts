"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wishlist";

function readStoredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("wishlist:change"));
}

export function useWishlist() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readStoredIds());

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(readStoredIds());
    };
    const onWishlistChange = () => setIds(readStoredIds());
    window.addEventListener("storage", onStorage);
    window.addEventListener("wishlist:change", onWishlistChange);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = (id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      writeStoredIds(next);
      return next;
    });
  };

  const isWishlisted = (id: string) => ids.includes(id);

  const clear = () => {
    setIds([]);
    writeStoredIds([]);
  };

  return { ids, isWishlisted, toggle, clear };
}
