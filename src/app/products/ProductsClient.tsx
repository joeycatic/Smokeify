// app/products/ProductsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
    priceMin: priceMinBound,
    priceMax: priceMaxBound,
  });
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => setLayout(media.matches ? "list" : "grid");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const filteredProducts = useMemo(() => {
    return filterProducts(normalizedProducts, filters);
  }, [normalizedProducts, filters]);

  const availableCategories = useMemo(() => {
    const categories = new Map<string, string>();
    normalizedProducts.forEach((p) => {
      p.categories?.forEach((c) => {
        if (c.parentId) return;
        categories.set(c.handle, c.title);
      });
    });
    return Array.from(categories.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [normalizedProducts]);

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
      setFilters((prev) =>
        prev.categories.length === 0 ? prev : { ...prev, categories: [] },
      );
      return;
    }
    if (!allCategoryTitlesByHandle.has(categoryParam)) return;
    setFilters((prev) => {
      if (
        prev.categories.length === 1 &&
        prev.categories[0] === categoryParam
      ) {
        return prev;
      }
      return {
        ...prev,
        categories: [categoryParam],
      };
    });
  }, [allCategoryTitlesByHandle, categoryParam]);

  const categoryTitleByHandle = useMemo(
    () => new Map(allCategoryTitlesByHandle),
    [allCategoryTitlesByHandle],
  );

  const resetFilters = () => {
    setFilters({
      categories: [],
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
      searchQuery: "",
    });
  };

  const toggleCategory = (handle: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(handle)
        ? prev.categories.filter((c) => c !== handle)
        : [...prev.categories, handle],
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
      {/* Products Grid */}
      <div className="mt-8 text-center">
        <h1
          className="text-2xl font-bold mb-4 sm:text-3xl"
          style={{ color: "#2f3e36" }}
        >
          Unsere Produkte
        </h1>
        <div className="mx-auto mb-4 h-1 w-24 rounded-full bg-[#2f3e36]" />
        <p className="text-stone-600 text-base font-medium sm:text-lg">
          Premium equipment für premium Ergebnisse
        </p>
      </div>

      <div className="mt-4 mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5c6f64]">
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
            className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm text-stone-700 shadow-[0_10px_30px_rgba(15,23,42,0.08)] outline-none focus:border-[#2f3e36]/40 focus-visible:ring-2 focus-visible:ring-emerald-600/20"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative grid h-11 w-36 grid-cols-2 rounded-full border border-black/15 bg-white p-[6px] shadow-sm overflow-hidden">
            <span
              className={`absolute top-[5px] bottom-[5px] rounded-full bg-[#3a4b41] transition-all duration-200 ease-out ${
                layout === "grid"
                  ? "left-[5px] right-[calc(50%-1px)]"
                  : "left-[calc(50%+1px)] right-[5px]"
              }`}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setLayout("grid")}
              className={`relative z-10 inline-flex h-8 w-full items-center justify-center gap-2 rounded-full pb-0.5 text-xs font-semibold transition ${
                layout === "grid"
                  ? "text-white"
                  : "text-[#2f3e36] hover:bg-[#3a4b41]/10"
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" />
              4x
            </button>
            <button
              type="button"
              onClick={() => setLayout("list")}
              className={`relative z-10 inline-flex h-8 w-full items-center justify-center gap-2 rounded-full pb-0.5 text-xs font-semibold transition ${
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
            priceMinBound={priceMinBound}
            priceMaxBound={priceMaxBound}
            resultCount={filteredProducts.length}
            onReset={resetFilters}
          />
        </div>
      </div>
      {activeChips.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
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
          <DisplayProducts products={filteredProducts} cols={4} />
        ) : (
          <DisplayProductsList products={filteredProducts} />
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
