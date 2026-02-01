// app/products/ProductsClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bars3BottomLeftIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { Product, ProductFilters } from "@/data/types";
import { filterProducts } from "@/lib/filterProducts";
import DisplayProducts, {
  DisplayProductsList,
} from "@/components/DisplayProducts";
import FilterDrawer from "@/components/FilterDrawer"; // <- Datei wie besprochen erstellen
import { useSearchParams } from "next/navigation";

type Props = {
  initialProducts: Product[];
};

export default function ProductsClient({ initialProducts }: Props) {
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get("category") ?? "";
  const manufacturerParam = searchParams?.get("manufacturer") ?? "";
  const parentCategoryById = useMemo(() => {
    const map = new Map<
      string,
      { id: string; handle: string; title: string }
    >();
    initialProducts.forEach((product) => {
      product.categories?.forEach((category) => {
        if (!category.parentId) {
          map.set(category.id, {
            id: category.id,
            handle: category.handle,
            title: category.title,
          });
          return;
        }
        if (category.parent) {
          map.set(category.parent.id, {
            id: category.parent.id,
            handle: category.parent.handle,
            title: category.parent.title,
          });
        }
      });
    });
    return map;
  }, [initialProducts]);

  const normalizedProducts = useMemo(() => {
    return initialProducts.map((product) => {
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
  }, [initialProducts, parentCategoryById]);

  // Dynamische Preisgrenzen aus deinen Produkten
  const priceMaxBound = useMemo(() => {
    const prices = normalizedProducts
      .map((p) => Number(p.priceRange?.minVariantPrice?.amount ?? 0))
      .filter((n) => Number.isFinite(n));
    const max = prices.length ? Math.max(...prices) : 0;
    // runde bisschen auf, sieht nicer aus im Slider
    return Math.max(10, Math.ceil(max / 10) * 10);
  }, [normalizedProducts]);

  const priceMinBound = 0;

  const [filters, setFilters] = useState<ProductFilters>({
    categories: [],
    manufacturers: [],
    priceMin: priceMinBound,
    priceMax: priceMaxBound,
  });
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [isMobile, setIsMobile] = useState(false);
  const lastCategoryParamRef = useRef<string>("");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      setIsMobile(media.matches);
      setLayout("grid");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const filteredProducts = useMemo(() => {
    const results = filterProducts(normalizedProducts, filters);
    return [...results].sort(
      (a, b) => Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale)),
    );
  }, [normalizedProducts, filters]);

  const categoryHierarchy = useMemo(() => {
    const parents = new Map<string, string>();
    const childrenByParent = new Map<string, Map<string, string>>();
    normalizedProducts.forEach((product) => {
      product.categories?.forEach((category) => {
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
    return { parents, childrenByParent };
  }, [normalizedProducts, parentCategoryById]);

  const availableCategories = useMemo(() => {
    const children =
      categoryParam && categoryHierarchy.childrenByParent.get(categoryParam);
    if (children && children.size > 0) {
      return Array.from(children.entries()).sort((a, b) =>
        a[1].localeCompare(b[1]),
      );
    }
    return Array.from(categoryHierarchy.parents.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [categoryHierarchy, categoryParam]);

  const availableManufacturers = useMemo(() => {
    const manufacturers = new Set<string>();
    const categoryFilters = filters.categories ?? [];
    const sourceProducts =
      categoryFilters.length === 0
        ? normalizedProducts
        : normalizedProducts.filter((product) => {
            const handles = product.categories.map((c) => c.handle);
            return categoryFilters.some((handle) => handles.includes(handle));
          });
    sourceProducts.forEach((product) => {
      if (product.manufacturer) manufacturers.add(product.manufacturer);
    });
    return Array.from(manufacturers).sort((a, b) => a.localeCompare(b));
  }, [normalizedProducts, filters.categories]);

  const allCategoryTitlesByHandle = useMemo(() => {
    const categories = new Map<string, string>();
    normalizedProducts.forEach((p) => {
      p.categories?.forEach((c) => {
        categories.set(c.handle, c.title);
      });
    });
    return categories;
  }, [normalizedProducts]);

  useEffect(() => {
    if (!categoryParam) {
      lastCategoryParamRef.current = "";
      setFilters((prev) =>
        prev.categories.length === 0 ? prev : { ...prev, categories: [] },
      );
      return;
    }
    if (!allCategoryTitlesByHandle.has(categoryParam)) return;
    const didChangeParent = lastCategoryParamRef.current !== categoryParam;
    lastCategoryParamRef.current = categoryParam;
    setFilters((prev) => {
      if (!didChangeParent && prev.categories.length > 0) return prev;
      return { ...prev, categories: [categoryParam] };
    });
  }, [allCategoryTitlesByHandle, categoryParam, categoryHierarchy]);

  useEffect(() => {
    if (!manufacturerParam) {
      setFilters((prev) =>
        prev.manufacturers.length === 0 ? prev : { ...prev, manufacturers: [] },
      );
      return;
    }
    const normalized = manufacturerParam.trim();
    if (!normalized) return;
    const parts = normalized
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setFilters((prev) => ({
      ...prev,
      manufacturers: parts,
    }));
  }, [manufacturerParam]);

  const categoryTitleByHandle = useMemo(
    () => new Map(allCategoryTitlesByHandle),
    [allCategoryTitlesByHandle],
  );

  const resetFilters = () => {
    setFilters({
      categories: [],
      manufacturers: [],
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
      searchQuery: "",
    });
  };

  const toggleCategory = (handle: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: (() => {
        const hasParent = Boolean(categoryParam);
        const childHandles = hasParent
          ? categoryHierarchy.childrenByParent.get(categoryParam)?.keys() ?? []
          : [];
        const isChild =
          hasParent && Array.from(childHandles).includes(handle);
        if (prev.categories.includes(handle)) {
          const next = prev.categories.filter((c) => c !== handle);
          if (next.length === 0 && hasParent) {
            return [categoryParam];
          }
          return next;
        }
        const withoutParent = isChild
          ? prev.categories.filter((c) => c !== categoryParam)
          : prev.categories;
        return [...withoutParent, handle];
      })(),
    }));
  };

  const removeCategory = (handle: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== handle),
    }));
  };

  const resetPrice = () => {
    setFilters((prev) => ({
      ...prev,
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
    }));
  };

  const clearSearch = () => {
    setFilters((prev) => ({ ...prev, searchQuery: "" }));
  };

  const activeChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      onRemove: () => void;
    }> = [];

    filters.categories.forEach((handle) => {
      chips.push({
        key: `category-${handle}`,
        label: categoryTitleByHandle.get(handle) ?? handle,
        onRemove: () => removeCategory(handle),
      });
    });
    filters.manufacturers.forEach((manufacturer) => {
      chips.push({
        key: `manufacturer-${manufacturer}`,
        label: `Manufacturer: ${manufacturer}`,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            manufacturers: prev.manufacturers.filter(
              (item) => item !== manufacturer
            ),
          })),
      });
    });
    if (filters.priceMin > priceMinBound || filters.priceMax < priceMaxBound) {
      chips.push({
        key: "price",
        label: `EUR ${filters.priceMin.toFixed(2)} - EUR ${filters.priceMax.toFixed(2)}`,
        onRemove: resetPrice,
      });
    }

    if (filters.searchQuery?.trim()) {
      chips.push({
        key: "search",
        label: `Search: ${filters.searchQuery.trim()}`,
        onRemove: clearSearch,
      });
    }

    return chips;
  }, [filters, categoryTitleByHandle, priceMinBound, priceMaxBound]);

  return (
      <div className="w-full text-stone-800">
        {/* Products Header */}
        <div className="mt-3 rounded-3xl bg-[radial-gradient(120%_120%_at_70%_90%,#b8d39a_0%,#4f7b62_38%,#21443a_68%,#0f2924_100%)] px-6 py-10 text-white shadow-[0_30px_60px_rgba(10,25,20,0.35)] sm:px-10">
        <div className="text-center">
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Unsere Produkte
          </h1>
          <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-white/90" />
          <p className="mt-4 text-sm text-white/85 sm:text-base">
            Premium Equipment für premium Ergebnisse
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#3a4b41]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16.5" y2="16.5" />
              </svg>
            </span>
            <input
              type="search"
              value={filters.searchQuery ?? ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder="Produkte suchen..."
              className="h-12 w-full rounded-2xl border border-white/40 bg-white pl-12 pr-4 text-sm text-stone-700 shadow-[0_12px_30px_rgba(8,18,14,0.15)] outline-none focus:border-white/70 focus-visible:ring-2 focus-visible:ring-white/50"
            />
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="relative grid h-12 w-40 grid-cols-2 rounded-full border border-white/40 bg-white/95 p-[6px] shadow-sm overflow-hidden">
              <span
                className={`absolute top-[5px] bottom-[5px] rounded-full bg-[#254237] transition-all duration-200 ease-out ${
                  layout === "grid"
                    ? "left-[5px] right-[calc(50%-1px)]"
                    : "left-[calc(50%+1px)] right-[5px]"
                }`}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setLayout("grid")}
                className={`relative z-10 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full pb-0.5 text-sm font-semibold transition ${
                  layout === "grid"
                    ? "text-white"
                    : "text-[#2f3e36] hover:bg-[#3a4b41]/10"
                }`}
              >
                <Squares2X2Icon className="h-4 w-4" />
                {isMobile ? "2x" : "4x"}
              </button>
              <button
                type="button"
                onClick={() => setLayout("list")}
                className={`relative z-10 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full pb-0.5 text-sm font-semibold transition ${
                  layout === "list"
                    ? "text-white"
                    : "text-[#2f3e36] hover:bg-[#3a4b41]/10"
                }`}
              >
                <Bars3BottomLeftIcon className="h-4 w-4" />
                1x
              </button>
            </div>
            <FilterDrawer
              filters={filters}
              setFilters={setFilters}
              availableCategories={availableCategories}
              availableManufacturers={availableManufacturers}
              priceMinBound={priceMinBound}
              priceMaxBound={priceMaxBound}
              resultCount={filteredProducts.length}
              onReset={resetFilters}
              triggerClassName="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 bg-white/95 px-6 text-sm font-semibold text-black shadow-sm transition hover:border-white/70"
              triggerBadgeClassName="rounded-full bg-black/10 px-2.5 py-1 text-sm font-semibold text-black"
            />
          </div>
        </div>
      </div>
      {activeChips.length > 0 && (
        <div className="mt-6 mb-8 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-stone-700 hover:border-black/30"
            >
              <span>{chip.label}</span>
              <span className="text-sm">x</span>
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-stone-600 hover:text-stone-800"
          >
            Clear all
          </button>
        </div>
      )}

      <div>
        {layout === "grid" ? (
          <DisplayProducts
            products={filteredProducts}
            cols={isMobile ? 2 : 4}
            showManufacturer
            titleLines={3}
            showGrowboxSize
            hideCartLabel={isMobile && layout === "grid"}
          />
        ) : (
          <DisplayProductsList
            products={filteredProducts}
            showManufacturer
            showGrowboxSize
          />
        )}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-4">Keine Produkte gefunden</p>
          <button
            onClick={resetFilters}
            className="text-green-600 hover:text-green-700 font-medium"
          >
            Filter zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
