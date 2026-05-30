import type { Product } from "@/data/types";

export type ProductBadgeTone = "emerald" | "neutral";

export type ProductBadge = {
  label: string;
  tone: ProductBadgeTone;
};

const BADGE_LIMIT = 3;

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const collectTokens = (product: Product) => {
  const parts = [
    product.title,
    product.description,
    product.shortDescription,
    product.manufacturer,
    product.growboxSize,
    ...product.tags,
    ...product.categories.flatMap((category) => [
      category.title,
      category.handle,
      category.parent?.title,
      category.parent?.handle,
    ]),
    ...product.collections.flatMap((collection) => [collection.title, collection.handle]),
  ];

  return normalize(parts.filter(Boolean).join(" "));
};

const pushBadge = (
  badges: ProductBadge[],
  seen: Set<string>,
  label: string,
  tone: ProductBadgeTone,
) => {
  if (seen.has(label) || badges.length >= BADGE_LIMIT) return;
  seen.add(label);
  badges.push({ label, tone });
};

export function getProductBadges(product: Product, limit = BADGE_LIMIT) {
  const text = collectTokens(product);
  const badges: ProductBadge[] = [];
  const seen = new Set<string>();
  const productLimit = Math.max(0, limit);
  const addBadge = (label: string, tone: ProductBadgeTone) => {
    if (badges.length >= productLimit) return;
    pushBadge(badges, seen, label, tone);
  };

  if (product.tags.some((tag) => normalize(tag).includes("vault"))) {
    addBadge("Vault geprüft", "emerald");
  }

  if (product.tags.some((tag) => normalize(tag).includes("analy"))) {
    addBadge("Analyzer-Empfehlung", "emerald");
  }

  if (product.bestsellerScore != null && product.bestsellerScore > 0) {
    addBadge("Bestseller", "neutral");
  }

  if (
    text.includes("starter") ||
    text.includes("basic") ||
    text.includes("anfänger") ||
    text.includes("anfaenger") ||
    text.includes("einsteiger")
  ) {
    addBadge("Einsteigerfreundlich", "emerald");
  }

  if (text.includes("silent") || text.includes("leise") || text.includes("quiet")) {
    addBadge("Leise", "emerald");
  }

  if (
    text.includes("compact") ||
    text.includes("kompakt") ||
    text.includes("stealth")
  ) {
    addBadge("Kompakt", "neutral");
  }

  if (
    text.includes("premium") ||
    text.includes("pro") ||
    text.includes("high-end")
  ) {
    addBadge("Premium", "neutral");
  }

  if (
    text.includes("preset") ||
    text.includes("kompatibel") ||
    text.includes("compatible") ||
    text.includes("set")
  ) {
    addBadge("Setup-kompatibel", "emerald");
  }

  if (text.includes("60x60")) {
    addBadge("Für 60x60 geeignet", "emerald");
  }

  if (text.includes("80x80")) {
    addBadge("Für 80x80 geeignet", "emerald");
  }

  return badges.slice(0, productLimit);
}


