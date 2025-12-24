// app/products/ProductsClient.tsx
"use client";

import { useMemo, useState } from "react";
import { Bars3BottomLeftIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import type { Product, ProductFilters } from "@/data/types";
import { filterProducts } from "@/lib/filterProducts";
import DisplayProducts, { DisplayProductsList } from "@/components/DisplayProducts";
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
    vendors: [],
    collections: [],
    priceMin: priceMinBound,
    priceMax: priceMaxBound,
  });
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const filteredProducts = useMemo(() => {
    return filterProducts(initialProducts, filters);
  }, [initialProducts, filters]);

  // verfügbare Hersteller
  const availableVendors = useMemo(() => {
    const vendors = new Set(initialProducts.map((p) => p.vendor).filter(Boolean));
    return Array.from(vendors).sort();
  }, [initialProducts]);

  // verfügbare Kategorien (Collections)
  const availableCollections = useMemo(() => {
    const collections = new Map<string, string>();
    initialProducts.forEach((p) => {
      p.collections?.forEach((c) => {
        collections.set(c.handle, c.title);
      });
    });
    return Array.from(collections.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [initialProducts]);

  const resetFilters = () => {
    setFilters({
      vendors: [],
      collections: [],
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
      searchQuery: "",
    });
  };

  const toggleCollection = (handle: string) => {
    setFilters((prev) => ({
      ...prev,
      collections: prev.collections.includes(handle)
        ? prev.collections.filter((c) => c !== handle)
        : [...prev.collections, handle],
    }));
  };

  return (
    <div className="w-full text-stone-800">
      {/* Products Grid */}
      <div className="mt-8 text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#2f3e36' }}>
            Our Products
        </h1>
        <div 
            className="mx-auto mb-4 rounded-xl" 
            style={{ width: '80px', height: '3px', backgroundColor: '#16a34a' }}
        ></div>
        <p className="text-stone-600 text-lg font-medium">
            Premium equipment for professional results
        </p>
      </div>

      <div className="mt-4 mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={filters.searchQuery ?? ""}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
          }
          placeholder="Search products..."
          className="h-11 w-full sm:max-w-xs rounded-md border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/30"
        />
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-black/15 bg-white p-1">
            <button
              type="button"
              onClick={() => setLayout("grid")}
              className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${
                layout === "grid" ? "bg-black text-white" : "text-black/70"
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" />
              4x
            </button>
            <button
              type="button"
              onClick={() => setLayout("list")}
              className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${
                layout === "list" ? "bg-black text-white" : "text-black/70"
              }`}
            >
              <Bars3BottomLeftIcon className="h-4 w-4" />
              1x
            </button>
          </div>
          <FilterDrawer
            filters={filters}
            setFilters={setFilters}
            availableVendors={availableVendors}
            availableCollections={availableCollections}
            priceMinBound={priceMinBound}
            priceMaxBound={priceMaxBound}
            resultCount={filteredProducts.length}
            onReset={resetFilters}
          />
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="mt-6 rounded-xl border border-black/10 bg-white p-4">
            <button
              type="button"
              onClick={() => setCategoriesOpen((s) => !s)}
              className="flex w-full items-center justify-between text-xs font-semibold tracking-widest text-black/60"
              aria-expanded={categoriesOpen}
            >
              CATEGORIES
              <span className="text-base">{categoriesOpen ? "−" : "+"}</span>
            </button>
            {categoriesOpen && (
              <div className="mt-3 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, collections: [] }))}
                  className={`rounded-md px-2 py-1 text-left text-sm transition ${
                    filters.collections.length === 0
                      ? "bg-black text-white"
                      : "text-black/70 hover:bg-black/5"
                  }`}
                >
                  All
                </button>
                {availableCollections.map(([handle, title]) => (
                  <button
                    key={handle}
                    type="button"
                    onClick={() => toggleCollection(handle)}
                    aria-pressed={filters.collections.includes(handle)}
                    className={`rounded-md px-2 py-1 text-left text-sm transition ${
                      filters.collections.includes(handle)
                        ? "bg-black text-white"
                        : "text-black/70 hover:bg-black/5"
                    }`}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div>
          {layout === "grid" ? (
            <DisplayProducts products={filteredProducts} cols={4} />
          ) : (
            <DisplayProductsList products={filteredProducts} />
          )}
        </div>
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

