// app/products/ProductsClient.tsx
"use client";

import { useMemo, useState } from "react";
import type { Product, ProductFilters } from "@/data/types";
import { filterProducts } from "@/lib/filterProducts";
import DisplayProducts from "@/lib/displayProducts";
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
    });
  };

  return (
    <div className="w-full text-stone-800">
      {/* Header + Filter Button */}
      <div className="ml-auto mb-10">
        

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

      {/* Products Grid */}
      <div className="text-center">
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

      <DisplayProducts products={filteredProducts} cols={3} />

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
