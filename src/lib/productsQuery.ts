import { unstable_cache } from "next/cache";
import type { Product, ProductFilters } from "@/data/types";
import { getProducts } from "@/lib/catalog";
import { filterProducts } from "@/lib/filterProducts";

export type SortMode = "featured" | "price_asc" | "price_desc" | "name_asc";

export type ProductsQueryParams = {
  categoryParam?: string;
  manufacturerParam?: string;
  categories?: string[];
  manufacturers?: string[];
  priceMin?: number;
  priceMax?: number;
  searchQuery?: string;
  sortBy?: SortMode;
  offset?: number;
  limit?: number;
};

export type ProductsQueryResult = {
  products: Product[];
  total: number;
  priceMinBound: number;
  priceMaxBound: number;
  availableCategories: Array<[string, string]>;
  availableManufacturers: string[];
  allCategoryTitles: Array<[string, string]>;
};

type CatalogMeta = {
  normalizedProducts: Product[];
  parentCategoryById: Map<string, { id: string; handle: string; title: string }>;
  priceMinBound: number;
  priceMaxBound: number;
  categoryHierarchy: {
    parents: Map<string, string>;
    childrenByParent: Map<string, Map<string, string>>;
  };
  allCategoryTitles: Map<string, string>;
};

const getCachedCatalogMeta = unstable_cache(
  async (): Promise<CatalogMeta> => {
    const initialProducts = await getProducts(500);
    const parentCategoryById = new Map<
      string,
      { id: string; handle: string; title: string }
    >();

    initialProducts.forEach((product) => {
      product.categories?.forEach((category) => {
        if (!category.parentId) {
          parentCategoryById.set(category.id, {
            id: category.id,
            handle: category.handle,
            title: category.title,
          });
          return;
        }
        if (category.parent) {
          parentCategoryById.set(category.parent.id, {
            id: category.parent.id,
            handle: category.parent.handle,
            title: category.parent.title,
          });
        }
      });
    });

    const normalizedProducts = initialProducts.map((product) => {
      if (!product.categories?.length) return product;
      const categories = [...product.categories];
      const handles = new Set(categories.map((category) => category.handle));
      categories.forEach((category) => {
        if (!category.parentId) return;
        const parent =
          parentCategoryById.get(category.parentId) ?? category.parent;
        if (!parent || handles.has(parent.handle)) return;
        categories.push({ ...parent, parentId: null, parent: null });
        handles.add(parent.handle);
      });
      return { ...product, categories };
    });

    const prices = normalizedProducts
      .map((p) => Number(p.priceRange?.minVariantPrice?.amount ?? 0))
      .filter((n) => Number.isFinite(n));
    const max = prices.length ? Math.max(...prices) : 0;
    const priceMaxBound = Math.max(10, Math.ceil(max / 10) * 10);
    const priceMinBound = 0;

    const parents = new Map<string, string>();
    const childrenByParent = new Map<string, Map<string, string>>();
    const allCategoryTitles = new Map<string, string>();

    normalizedProducts.forEach((product) => {
      product.categories?.forEach((category) => {
        allCategoryTitles.set(category.handle, category.title);
        if (!category.parentId) {
          parents.set(category.handle, category.title);
          return;
        }
        const parent =
          category.parent ?? parentCategoryById.get(category.parentId);
        if (!parent) return;
        parents.set(parent.handle, parent.title);
        const bucket =
          childrenByParent.get(parent.handle) ?? new Map<string, string>();
        bucket.set(category.handle, category.title);
        childrenByParent.set(parent.handle, bucket);
      });
    });

    return {
      normalizedProducts,
      parentCategoryById,
      priceMinBound,
      priceMaxBound,
      categoryHierarchy: { parents, childrenByParent },
      allCategoryTitles,
    };
  },
  ["products-query-catalog"],
  { revalidate: 30 },
);

function sortProducts(products: Product[], sortBy: SortMode): Product[] {
  const toPrice = (product: Product) =>
    Number(product.priceRange?.minVariantPrice?.amount ?? 0);
  const indexById = new Map(products.map((product, index) => [product.id, index]));

  return [...products].sort((a, b) => {
    if (sortBy === "price_asc") {
      const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
      if (stockDelta !== 0) return stockDelta;
      return toPrice(a) - toPrice(b);
    }
    if (sortBy === "price_desc") {
      const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
      if (stockDelta !== 0) return stockDelta;
      return toPrice(b) - toPrice(a);
    }
    if (sortBy === "name_asc") {
      const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
      if (stockDelta !== 0) return stockDelta;
      return a.title.localeCompare(b.title);
    }

    const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
    if (stockDelta !== 0) return stockDelta;
    return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
  });
}

export async function queryProducts(
  params: ProductsQueryParams,
): Promise<ProductsQueryResult> {
  const {
    categoryParam = "",
    manufacturerParam = "",
    categories = [],
    manufacturers = [],
    priceMin,
    priceMax,
    searchQuery = "",
    sortBy = "featured",
    offset = 0,
    limit = 24,
  } = params;

  const catalog = await getCachedCatalogMeta();
  const safePriceMin =
    Number.isFinite(priceMin) && typeof priceMin === "number"
      ? priceMin
      : catalog.priceMinBound;
  const safePriceMax =
    Number.isFinite(priceMax) && typeof priceMax === "number"
      ? priceMax
      : catalog.priceMaxBound;

  const mergedManufacturers = [
    ...manufacturers,
    ...manufacturerParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];

  const normalizedCategoryParam = categoryParam.trim();
  const mergedCategories = categories.length
    ? categories
    : normalizedCategoryParam
      ? [normalizedCategoryParam]
      : [];

  const filters: ProductFilters = {
    categories: mergedCategories,
    manufacturers: mergedManufacturers,
    priceMin: safePriceMin,
    priceMax: safePriceMax,
    searchQuery,
  };

  const filteredProducts = filterProducts(catalog.normalizedProducts, filters);
  const sortedProducts = sortProducts(filteredProducts, sortBy);

  const activeCategory = normalizedCategoryParam;
  const availableCategories = (() => {
    const children =
      activeCategory && catalog.categoryHierarchy.childrenByParent.get(activeCategory);
    if (children && children.size > 0) {
      return Array.from(children.entries()).sort((a, b) =>
        a[1].localeCompare(b[1]),
      );
    }
    return Array.from(catalog.categoryHierarchy.parents.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  })();

  const availableManufacturers = (() => {
    const set = new Set<string>();
    const categoryFilters = filters.categories ?? [];
    const sourceProducts =
      categoryFilters.length === 0
        ? catalog.normalizedProducts
        : catalog.normalizedProducts.filter((product) => {
            const handles = product.categories.map((c) => c.handle);
            return categoryFilters.some((handle) => handles.includes(handle));
          });
    sourceProducts.forEach((product) => {
      if (product.manufacturer) set.add(product.manufacturer);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  })();

  return {
    products: sortedProducts.slice(offset, offset + limit),
    total: sortedProducts.length,
    priceMinBound: catalog.priceMinBound,
    priceMaxBound: catalog.priceMaxBound,
    availableCategories,
    availableManufacturers,
    allCategoryTitles: Array.from(catalog.allCategoryTitles.entries()),
  };
}

