import type { ProductFilters } from "@/data/types";
import type { SortMode } from "@/lib/productsQuery";

export type ProductsViewMode = "grid" | "list";

export type ProductsUrlState = {
  category: string;
  categories: string[];
  manufacturer: string;
  manufacturers: string[];
  priceMin?: number;
  priceMax?: number;
  searchQuery: string;
  sortBy: SortMode;
  view: ProductsViewMode;
};

export const PRODUCT_URL_STATE_KEYS = [
  "category",
  "categories",
  "manufacturer",
  "manufacturers",
  "priceMin",
  "priceMax",
  "searchQuery",
  "sortBy",
  "view",
] as const;

const SORT_MODES = new Set<SortMode>([
  "featured",
  "price_asc",
  "price_desc",
  "name_asc",
]);

const getSingle = (
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
) => {
  if (source instanceof URLSearchParams) return source.get(key) ?? "";
  const value = source[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

export const parseProductUrlCsv = (value?: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const parseProductsUrlState = (
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): ProductsUrlState => {
  const sortCandidate = getSingle(source, "sortBy") as SortMode;
  const viewCandidate = getSingle(source, "view");
  const category = getSingle(source, "category").trim();
  const manufacturer = getSingle(source, "manufacturer").trim();

  return {
    category,
    categories: unique(parseProductUrlCsv(getSingle(source, "categories"))),
    manufacturer,
    manufacturers: unique(parseProductUrlCsv(getSingle(source, "manufacturers"))),
    priceMin: parseNumber(getSingle(source, "priceMin")),
    priceMax: parseNumber(getSingle(source, "priceMax")),
    searchQuery: getSingle(source, "searchQuery").trim(),
    sortBy: SORT_MODES.has(sortCandidate) ? sortCandidate : "featured",
    view: viewCandidate === "list" ? "list" : "grid",
  };
};

export const hasProductsUrlState = (
  source: URLSearchParams | Record<string, string | string[] | undefined>,
) => {
  if (source instanceof URLSearchParams) {
    return PRODUCT_URL_STATE_KEYS.some((key) => source.has(key));
  }
  return PRODUCT_URL_STATE_KEYS.some((key) => source[key] !== undefined);
};

export const filtersFromProductsUrlState = (
  state: ProductsUrlState,
  bounds: { priceMinBound: number; priceMaxBound: number },
): ProductFilters => ({
  categories: unique([
    ...(state.category ? [state.category] : []),
    ...state.categories,
  ]),
  manufacturers: unique([
    ...(state.manufacturer ? [state.manufacturer] : []),
    ...state.manufacturers,
  ]),
  priceMin: state.priceMin ?? bounds.priceMinBound,
  priceMax: state.priceMax ?? bounds.priceMaxBound,
  searchQuery: state.searchQuery,
});

export const buildProductsSearchParams = ({
  filters,
  sortBy,
  view,
  priceMinBound,
  priceMaxBound,
}: {
  filters: ProductFilters;
  sortBy: SortMode;
  view: ProductsViewMode;
  priceMinBound: number;
  priceMaxBound: number;
}) => {
  const params = new URLSearchParams();
  if (filters.categories.length === 1) {
    params.set("category", filters.categories[0]);
  } else if (filters.categories.length > 1) {
    params.set("categories", filters.categories.join(","));
  }
  if (filters.manufacturers.length === 1) {
    params.set("manufacturer", filters.manufacturers[0]);
  } else if (filters.manufacturers.length > 1) {
    params.set("manufacturers", filters.manufacturers.join(","));
  }
  if (filters.priceMin > priceMinBound) {
    params.set("priceMin", String(filters.priceMin));
  }
  if (filters.priceMax < priceMaxBound) {
    params.set("priceMax", String(filters.priceMax));
  }
  if (filters.searchQuery?.trim()) {
    params.set("searchQuery", filters.searchQuery.trim());
  }
  if (sortBy !== "featured") {
    params.set("sortBy", sortBy);
  }
  if (view !== "grid") {
    params.set("view", view);
  }
  return params;
};

