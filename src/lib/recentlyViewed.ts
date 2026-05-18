export type RecentlyViewedItem = {
  handle: string;
  title: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  manufacturer?: string | null;
  price?: { amount: string; currencyCode: string } | null;
  viewedAt: number;
};

const STORAGE_KEY = "smokeify:recently-viewed:v1";
const MAX_ITEMS = 12;

const isBrowser = () => typeof window !== "undefined";

const isValidItem = (value: unknown): value is RecentlyViewedItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentlyViewedItem>;
  return (
    typeof item.handle === "string" &&
    item.handle.length > 0 &&
    typeof item.title === "string" &&
    item.title.length > 0 &&
    typeof item.viewedAt === "number"
  );
};

export const readRecentlyViewed = (): RecentlyViewedItem[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
};

export const pushRecentlyViewed = (
  item: Omit<RecentlyViewedItem, "viewedAt">,
): RecentlyViewedItem[] => {
  if (!isBrowser() || !item.handle || !item.title) return [];
  const current = readRecentlyViewed();
  const nextItem: RecentlyViewedItem = {
    ...item,
    viewedAt: Date.now(),
  };
  const deduped = current.filter((entry) => entry.handle !== item.handle);
  const next = [nextItem, ...deduped].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota/privacy errors and return computed state.
  }
  return next;
};
