// components/ProductFilter.tsx
"use client";

import { useState } from "react";

export default function ProductFilter() {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);

  const categories = [
    "Grow Lights",
    "Nährstoffe",
    "Zelte",
    "Belüftung",
    "Zubehör"
  ];

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const resetFilters = () => {
    setPriceRange([0, 500]);
    setSelectedCategories([]);
    setInStockOnly(false);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 sticky top-6">
      <h2 className="text-lg font-bold text-stone-800 mb-4">Filter</h2>

      {/* Kategorien */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Kategorien
        </h3>
        <div className="space-y-2">
          {categories.map((category) => (
            <label
              key={category}
              className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded transition"
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(category)}
                onChange={() => toggleCategory(category)}
                className="w-4 h-4 accent-[#2f3e36] cursor-pointer"
              />
              <span className="text-sm text-stone-700">{category}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Preisbereich */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Preisbereich
        </h3>
        <div className="space-y-3">
          <input
            type="range"
            min="0"
            max="500"
            value={priceRange[1]}
            onChange={(e) => setPriceRange([0, Number(e.target.value)])}
            className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#2f3e36]"
          />
          <div className="flex justify-between text-sm text-stone-600">
            <span>0 EUR</span>
            <span className="font-semibold text-[#2f3e36]">{priceRange[1]} EUR</span>
          </div>
        </div>
      </div>

      {/* Verfügbarkeit */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Verfügbarkeit
        </h3>
        <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded transition">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 accent-[#2f3e36] cursor-pointer"
          />
          <span className="text-sm text-stone-700">Nur auf Lager</span>
        </label>
      </div>

      {/* Filter zurücksetzen */}
      <button
        onClick={resetFilters}
        className="w-full py-2 text-sm font-medium text-[#2f3e36] border border-[#2f3e36] rounded-lg hover:bg-[#2f3e36] hover:text-white transition"
      >
        Filter zurücksetzen
      </button>
    </div>
  );
}