// app/products/ProductsClient.tsx
"use client";

import { useMemo, useState } from "react";
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

type Props = {
  initialProducts: Product[];
};

export default function ProductsClient({ initialProducts }: Props) {
  // Dynamische Preisgrenzen aus deinen Produkten
  const priceMaxBound = useMemo(() => {
    const prices = initialProducts
      .map((p) => Number(p.priceRange?.minVariantPrice?.amount ?? 0))
      .filter((n) => Number.isFinite(n));
    const max = prices.length ? Math.max(...prices) : 0;
    // runde bisschen auf, sieht nicer aus im Slider
    return Math.max(10, Math.ceil(max / 10) * 10);
  }, [initialProducts]);

  const priceMinBound = 0;

  const [filters, setFilters] = useState<ProductFilters>({
    categories: [],
    priceMin: priceMinBound,
    priceMax: priceMaxBound,
  });
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const filteredProducts = useMemo(() => {
    return filterProducts(initialProducts, filters);
  }, [initialProducts, filters]);

  const availableCategories = useMemo(() => {
    const categories = new Map<string, string>();
    initialProducts.forEach((p) => {
      p.categories?.forEach((c) => {
        categories.set(c.handle, c.title);
      });
    });
    return Array.from(categories.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [initialProducts]);

  const categoryTitleByHandle = useMemo(
    () => new Map(availableCategories),
    [availableCategories]
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
  }, [
    filters,
    categoryTitleByHandle,
    priceMinBound,
    priceMaxBound,
  ]);

  return (
    <div className="w-full text-stone-800">
      <div className="mt-6 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, categories: [] }))}
            className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
              filters.categories.length === 0
                ? "border-black bg-black text-white"
                : "border-black/10 bg-white text-black/70 hover:border-black/20"
            }`}
          >
            All
          </button>
          {availableCategories.map(([handle, title]) => {
            const active = filters.categories.includes(handle);
            return (
              <button
                key={handle}
                type="button"
                onClick={() => toggleCategory(handle)}
                aria-pressed={active}
                className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/70 hover:border-black/20"
                }`}
              >
                {title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Grid */}
      <div className="mt-8 text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ color: "#2f3e36" }}>
          Unsere Produkte
        </h1>
        <div
          className="mx-auto mb-4 rounded-xl"
          style={{ width: "80px", height: "3px", backgroundColor: "#16a34a" }}
        ></div>
        <p className="text-stone-600 text-lg font-medium">
          Premium equipment für premium Ergebnisse
        </p>
      </div>

      <div className="mt-4 mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={filters.searchQuery ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
          }
          placeholder="Suche produkte..."
          className="h-11 w-full sm:max-w-xs rounded-md border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/30"
        />
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-black/15 bg-white p-1">
            <button
              type="button"
              onClick={() => setLayout("grid")}
              className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition ${
                layout === "grid"
                  ? "bg-[#3a4b41] text-white"
                  : "text-[#2f3e36] hover:bg-[#3a4b41]/10"
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" />
              4x
            </button>
            <button
              type="button"
              onClick={() => setLayout("list")}
              className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition ${
                layout === "list"
                  ? "bg-[#3a4b41] text-white"
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
