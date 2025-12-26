"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

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
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated) return;
    setIds(readStoredIds());

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(readStoredIds());
    };
    const onWishlistChange = () => setIds(readStoredIds());
    window.addEventListener("storage", onStorage);
    window.addEventListener("wishlist:change", onWishlistChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wishlist:change", onWishlistChange);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/wishlist/items");
        if (!res.ok) return;
        const data = (await res.json()) as { ids: string[] };
        if (!cancelled) setIds(data.ids ?? []);
      } catch {
        if (!cancelled) setIds([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, session?.user?.id]);

  const toggle = (id: string) => {
    if (!isAuthenticated) {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
        writeStoredIds(next);
        return next;
      });
      return;
    }

    const willRemove = ids.includes(id);
    setIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    const method = willRemove ? "DELETE" : "POST";
    fetch("/api/wishlist/items", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    }).catch(() => {
      setIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    });
  };

  const isWishlisted = (id: string) => ids.includes(id);

  const clear = () => {
    if (!isAuthenticated) {
      setIds([]);
      writeStoredIds([]);
    }
  };

  return { ids, isWishlisted, toggle, clear };
}
