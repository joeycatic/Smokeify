import { buildMerchantItemId } from "@/lib/merchantFeed";

export type ProductVariant = {
  id: string;
  title: string;
  sku?: string | null;
  options?: Array<{ name: string; value: string; imagePosition?: number | null }>;
  availableForSale: boolean;
  lowStock?: boolean;
  availableQuantity?: number;
  lowStockThreshold?: number;
  price: { amount: string; currencyCode: string };
  compareAt?: { amount: string; currencyCode: string } | null;
};

type AnalyticsProduct = {
  id: string;
  title: string;
  manufacturer?: string | null;
  categories?: Array<{ handle: string; title: string; parentId?: string | null }>;
};

export const formatSelectedOptions = (
  options?: Array<{ name: string; value: string }>,
) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

export function buildProductOptionGroups(
  variants: ProductVariant[],
  fallbackOptions: Array<{ name: string; values: string[] }>,
) {
  const map = new Map<string, Set<string>>();
  variants.forEach((variant) => {
    variant.options?.forEach((option) => {
      const set = map.get(option.name) ?? new Set<string>();
      set.add(option.value);
      map.set(option.name, set);
    });
  });
  if (map.size === 0 && fallbackOptions.length > 0) {
    fallbackOptions.forEach((option) => {
      map.set(option.name, new Set(option.values));
    });
  }
  return Array.from(map.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }));
}
export function buildSelectedCartOptions(input: {
  optionGroups: Array<{ name: string; values: string[] }>;
  selectedOptions: Record<string, string>;
  selectedVariant?: ProductVariant | null;
}) {
  const fromGroups = input.optionGroups
    .map((opt) => ({
      name: opt.name,
      value: input.selectedOptions[opt.name] ?? "",
    }))
    .filter((entry) => entry.name && entry.value);
  if (fromGroups.length > 0) return fromGroups;
  return (
    input.selectedVariant?.options
      ?.map((opt) => ({ name: opt.name, value: opt.value }))
      .filter((entry) => entry.name && entry.value) ?? []
  );
}

export function buildLineOptionsKey(
  options?: Array<{ name: string; value: string }>,
) {
  if (!options?.length) return "";
  return options
    .map(
      (opt) =>
        `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`,
    )
    .sort()
    .join("&");
}

export const buildItemPayload = (
  product: AnalyticsProduct,
  variant: ProductVariant | null | undefined,
  quantity: number,
  optionsText?: string,
) => {
  if (!variant) return null;
  return {
    product_id: product.id,
    item_id: buildMerchantItemId(variant.id),
    item_name: product.title,
    item_brand: product.manufacturer ?? undefined,
    item_category: product.categories?.[0]?.title,
    item_variant: optionsText || variant.title,
    price: Number(variant.price.amount),
    quantity,
  };
};

export function formatDetailPrice(price?: {
  amount: string;
  currencyCode: string;
}) {
  if (!price) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: price.currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(price.amount));
}
