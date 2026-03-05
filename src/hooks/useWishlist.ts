"use client";

import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

const STORAGE_KEY = "wishlist";
const REMOTE_WISHLIST_TTL_MS = 30_000;

type RemoteWishlistCache = {
  userId: string | null;
  ids: string[] | null;
  request: Promise<string[]> | null;
  fetchedAt: number;
};

type WishlistContextValue = {
  ids: string[];
  isWishlisted: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
};

declare global {
  interface Window {
    __smokeifyWishlistCache?: RemoteWishlistCache;
  }
}

const fallbackCache: RemoteWishlistCache = {
  userId: null,
  ids: null,
  request: null,
  fetchedAt: 0,
};
const WISHLIST_UNAVAILABLE_ERROR = "Wishlist context unavailable";
const wishlistFallback: WishlistContextValue = {
  ids: [],
  isWishlisted: () => false,
  toggle: () => {
    throw new Error(WISHLIST_UNAVAILABLE_ERROR);
  },
  clear: () => {},
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function getRemoteCache(): RemoteWishlistCache {
  if (typeof window === "undefined") return fallbackCache;
  if (!window.__smokeifyWishlistCache) {
    window.__smokeifyWishlistCache = {
      userId: null,
      ids: null,
      request: null,
      fetchedAt: 0,
    };
  }
  return window.__smokeifyWishlistCache;
}

function emitWishlistChange(ids: string[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wishlist:change", { detail: { ids } }));
}

function readStoredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  emitWishlistChange(ids);
}

async function loadRemoteWishlist(userId: string): Promise<string[]> {
  const cache = getRemoteCache();
  const cachedIds = cache.ids;
  const hasFreshCache =
    cache.userId === userId &&
    cachedIds !== null &&
    Date.now() - cache.fetchedAt < REMOTE_WISHLIST_TTL_MS;

  if (hasFreshCache) return cachedIds;
  if (cache.userId === userId && cache.request) return cache.request;

  cache.userId = userId;
  cache.request = fetch("/api/wishlist/items")
    .then(async (res) => {
      if (!res.ok) return [];
      const data = (await res.json()) as { ids?: string[] };
      const ids = Array.isArray(data.ids)
        ? data.ids.filter((id) => typeof id === "string")
        : [];
      cache.ids = ids;
      cache.fetchedAt = Date.now();
      return ids;
    })
    .catch(() => [])
    .finally(() => {
      cache.request = null;
    });

  return cache.request;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [ids, setIds] = useState<string[]>(() => readStoredIds());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(readStoredIds());
    };
    const onWishlistChange = (event: Event) => {
      const custom = event as CustomEvent<{ ids?: string[] }>;
      if (custom.detail?.ids) {
        setIds(custom.detail.ids);
      } else {
        setIds(readStoredIds());
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("wishlist:change", onWishlistChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wishlist:change", onWishlistChange);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const next = await loadRemoteWishlist(userId);
      if (!cancelled) setIds(next);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, session?.user?.id]);

  const value = useMemo<WishlistContextValue>(() => {
    const toggle = (id: string) => {
      if (!isAuthenticated) {
        setIds((prev) => {
          const next = prev.includes(id)
            ? prev.filter((p) => p !== id)
            : [...prev, id];
          writeStoredIds(next);
          return next;
        });
        return;
      }

      const previous = ids;
      const willRemove = previous.includes(id);
      const next = willRemove
        ? previous.filter((p) => p !== id)
        : [...previous, id];

      const cache = getRemoteCache();
      cache.userId = session?.user?.id ?? null;
      cache.ids = next;
      cache.fetchedAt = Date.now();

      setIds(next);
      emitWishlistChange(next);

      const method = willRemove ? "DELETE" : "POST";
      fetch("/api/wishlist/items", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      }).catch(() => {
        const rollbackCache = getRemoteCache();
        rollbackCache.userId = session?.user?.id ?? null;
        rollbackCache.ids = previous;
        rollbackCache.fetchedAt = Date.now();
        setIds(previous);
        emitWishlistChange(previous);
      });
    };

    const clear = () => {
      if (!isAuthenticated) {
        setIds([]);
        writeStoredIds([]);
        return;
      }
      const cache = getRemoteCache();
      cache.userId = session?.user?.id ?? null;
      cache.ids = [];
      cache.fetchedAt = Date.now();
      setIds([]);
      emitWishlistChange([]);
    };

    return {
      ids,
      isWishlisted: (id: string) => ids.includes(id),
      toggle,
      clear,
    };
  }, [ids, isAuthenticated, session?.user?.id]);

  return createElement(WishlistContext.Provider, { value }, children);
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "useWishlist was called outside WishlistProvider. Returning fallback context."
      );
    }
    return wishlistFallback;
  }
  return context;
}
