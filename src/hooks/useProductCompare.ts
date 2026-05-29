"use client";

import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  COMPARE_STORAGE_KEY,
  LEGACY_COMPARE_STORAGE_KEY,
  MAX_COMPARE_ITEMS,
} from "@/lib/storefrontKeys";

export { MAX_COMPARE_ITEMS };

type CompareContextValue = {
  ids: string[];
  isCompared: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
};

const compareFallback: CompareContextValue = {
  ids: [],
  isCompared: () => false,
  toggle: () => {},
  clear: () => {},
};

const CompareContext = createContext<CompareContextValue | null>(null);

function emitCompareChange(ids: string[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("compare:change", { detail: { ids } }));
}

function parseStoredIds(raw: string | null | undefined): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string").slice(0, MAX_COMPARE_ITEMS)
      : [];
  } catch {
    return [];
  }
}

function readSnapshot() {
  if (typeof window === "undefined") return "[]";
  const next = window.localStorage.getItem(COMPARE_STORAGE_KEY);
  if (next) return next;
  const legacy = window.localStorage.getItem(LEGACY_COMPARE_STORAGE_KEY);
  if (!legacy) return "[]";
  window.localStorage.setItem(COMPARE_STORAGE_KEY, legacy);
  window.localStorage.removeItem(LEGACY_COMPARE_STORAGE_KEY);
  return legacy;
}

function writeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const next = ids.slice(0, MAX_COMPARE_ITEMS);
  window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
  window.localStorage.removeItem(LEGACY_COMPARE_STORAGE_KEY);
  emitCompareChange(next);
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === COMPARE_STORAGE_KEY ||
      event.key === LEGACY_COMPARE_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };
  const onCompareChange = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener("compare:change", onCompareChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("compare:change", onCompareChange);
  };
}

export function ProductCompareProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => "[]");
  const ids = useMemo(() => parseStoredIds(snapshot), [snapshot]);

  const value = useMemo<CompareContextValue>(
    () => ({
      ids,
      isCompared: (id: string) => ids.includes(id),
      toggle: (id: string) => {
        if (!id) return;
        const next = ids.includes(id)
          ? ids.filter((entry) => entry !== id)
          : [...ids, id].slice(-MAX_COMPARE_ITEMS);
        writeIds(next);
      },
      clear: () => writeIds([]),
    }),
    [ids],
  );

  return createElement(CompareContext.Provider, { value }, children);
}

export function useProductCompare() {
  return useContext(CompareContext) ?? compareFallback;
}

