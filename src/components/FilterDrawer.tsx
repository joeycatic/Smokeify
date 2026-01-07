"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductFilters } from "@/data/types";

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-black/10">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-stone-800">{title}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-black/70"
          aria-hidden
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FilterDrawer({
  filters,
  setFilters,
  availableVendors,
  availableCollections,
  priceMinBound = 0,
  priceMaxBound = 10000,
  resultCount,
  onReset,
}: {
  filters: ProductFilters;
  setFilters: React.Dispatch<React.SetStateAction<ProductFilters>>;
  availableVendors: string[];
  availableCollections: Array<[handle: string, title: string]>;
  priceMinBound?: number;
  priceMaxBound?: number;
  resultCount: number;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"price" | "cat" | "vendor" | null>(
    "price"
  );
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [collectionQuery, setCollectionQuery] = useState("");
  const trackRef = useRef<HTMLDivElement | null>(null);

  // ESC schließt + body lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const activeCount = useMemo(() => {
    let c = 0;
    c += filters.vendors.length;
    c += filters.collections.length;
    if (filters.priceMin > priceMinBound || filters.priceMax < priceMaxBound)
      c += 1;
    if (filters.searchQuery?.trim()) c += 1;
    return c;
  }, [filters, priceMinBound, priceMaxBound]);

  const toggleVendor = (vendor: string) => {
    setFilters((prev) => ({
      ...prev,
      vendors: prev.vendors.includes(vendor)
        ? prev.vendors.filter((v) => v !== vendor)
        : [...prev.vendors, vendor],
    }));
  };

  const toggleCollection = (handle: string) => {
    setFilters((prev) => ({
      ...prev,
      collections: prev.collections.includes(handle)
        ? prev.collections.filter((c) => c !== handle)
        : [...prev.collections, handle],
    }));
  };

  const collectionMap = useMemo(
    () => new Map(availableCollections),
    [availableCollections]
  );

  const filteredCollections = useMemo(() => {
    if (!collectionQuery.trim()) return availableCollections;
    const query = collectionQuery.trim().toLowerCase();
    return availableCollections.filter(([, title]) =>
      title.toLowerCase().includes(query)
    );
  }, [availableCollections, collectionQuery]);

  const filteredVendors = useMemo(() => {
    if (!vendorQuery.trim()) return availableVendors;
    const query = vendorQuery.trim().toLowerCase();
    return availableVendors.filter((vendor) =>
      vendor.toLowerCase().includes(query)
    );
  }, [availableVendors, vendorQuery]);

  const activeFilters = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      onRemove: () => void;
    }> = [];

    filters.collections.forEach((handle) => {
      const title = collectionMap.get(handle) ?? handle;
      items.push({
        key: `collection-${handle}`,
        label: `Category: ${title}`,
        onRemove: () => toggleCollection(handle),
      });
    });

    filters.vendors.forEach((vendor) => {
      items.push({
        key: `vendor-${vendor}`,
        label: `Brand: ${vendor}`,
        onRemove: () => toggleVendor(vendor),
      });
    });

    if (filters.priceMin > priceMinBound || filters.priceMax < priceMaxBound) {
      items.push({
        key: "price",
        label: `Price: EUR ${filters.priceMin.toFixed(
          2
        )} - EUR ${filters.priceMax.toFixed(2)}`,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            priceMin: priceMinBound,
            priceMax: priceMaxBound,
          })),
      });
    }

    if (filters.searchQuery?.trim()) {
      items.push({
        key: "search",
        label: `Search: ${filters.searchQuery.trim()}`,
        onRemove: () => setFilters((prev) => ({ ...prev, searchQuery: "" })),
      });
    }

    return items;
  }, [filters, collectionMap, priceMinBound, priceMaxBound, setFilters]);

  const priceRange = Math.max(priceMaxBound - priceMinBound, 1);
  const minPercent = ((filters.priceMin - priceMinBound) / priceRange) * 100;
  const maxPercent = ((filters.priceMax - priceMinBound) / priceRange) * 100;

  const valueFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return priceMinBound;
    const ratio = (clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    const raw = priceMinBound + clamped * (priceMaxBound - priceMinBound);
    return Math.max(1, Math.round(raw));
  };

  const updateMin = (value: number) => {
    const nextValue = Math.max(1, Math.round(value));
    setFilters((f) => ({
      ...f,
      priceMin: Math.min(nextValue, f.priceMax),
    }));
  };

  const updateMax = (value: number) => {
    const nextValue = Math.max(1, Math.round(value));
    setFilters((f) => ({
      ...f,
      priceMax: Math.max(nextValue, f.priceMin),
    }));
  };

  return (
    <>
      {/* Trigger */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-black/20"
        >
          Filter
          {activeCount > 0 && (
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold text-black/70">
              {activeCount}
            </span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.button
              type="button"
              aria-label="Close filter"
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Drawer */}
            <motion.aside
              className="fixed right-0 top-0 h-dvh w-full sm:w-[420px] bg-white z-50 flex flex-col"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.26, ease: "easeInOut" }}
              role="dialog"
              aria-modal="true"
              aria-label="Filter panel"
            >
              {/* Header */}
              <div className="h-14 px-5 border-b border-black/10 flex items-center justify-between">
                <div className="w-8" />
                <div className="text-sm font-semibold text-stone-800">
                  Filter
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 grid place-items-center text-xl"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5">
                <div className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-stone-500">
                      Active filters
                    </p>
                    {activeFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={onReset}
                        className="text-xs font-semibold text-stone-600 hover:text-stone-800"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {activeFilters.length === 0 ? (
                    <p className="mt-2 text-xs text-stone-500">
                      No filters applied.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeFilters.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={filter.onRemove}
                          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-700 hover:border-black/30"
                        >
                          <span>{filter.label}</span>
                          <span className="text-sm">x</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* PRICE */}
                <Accordion
                  title="Price"
                  open={section === "price"}
                  onToggle={() =>
                    setSection((s) => (s === "price" ? null : "price"))
                  }
                >
                  <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                    <label className="flex flex-col gap-1">
                      <span className="text-stone-500">Min</span>
                      <input
                        type="number"
                        min={1}
                        max={filters.priceMax}
                        step="1"
                        value={String(
                          Math.max(1, Math.round(filters.priceMin))
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") return;
                          updateMin(Number(raw));
                        }}
                        className="h-9 rounded-md border border-black/10 px-2 text-sm outline-none focus:border-black/30"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-stone-500">Max</span>
                      <input
                        type="number"
                        min={Math.max(1, Math.round(filters.priceMin))}
                        max={Math.max(1, Math.round(priceMaxBound))}
                        step="1"
                        value={String(
                          Math.max(1, Math.round(filters.priceMax))
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") return;
                          updateMax(Number(raw));
                        }}
                        className="h-9 rounded-md border border-black/10 px-2 text-sm outline-none focus:border-black/30"
                      />
                    </label>
                  </div>

                  {/* Single bar with two thumbs */}
                  <div className="relative mt-2 h-6">
                    <div
                      ref={trackRef}
                      className="absolute left-2 right-2 top-0 h-6 select-none touch-none"
                      onPointerDown={(e) => {
                        const value = valueFromClientX(e.clientX);
                        const distToMin = Math.abs(value - filters.priceMin);
                        const distToMax = Math.abs(value - filters.priceMax);
                        const nextThumb =
                          distToMin <= distToMax ? "min" : "max";
                        setActiveThumb(nextThumb);
                        if (nextThumb === "min") updateMin(value);
                        else updateMax(value);
                        trackRef.current?.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (!activeThumb) return;
                        const value = valueFromClientX(e.clientX);
                        if (activeThumb === "min") updateMin(value);
                        else updateMax(value);
                      }}
                      onPointerUp={(e) => {
                        setActiveThumb(null);
                        trackRef.current?.releasePointerCapture(e.pointerId);
                      }}
                      onPointerCancel={(e) => {
                        setActiveThumb(null);
                        trackRef.current?.releasePointerCapture(e.pointerId);
                      }}
                    >
                      <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-black/10" />
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-green-700"
                        style={{
                          left: `${Math.max(0, Math.min(100, minPercent))}%`,
                          right: `${Math.max(
                            0,
                            Math.min(100, 100 - maxPercent)
                          )}%`,
                        }}
                      />
                      <div
                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-black/60 bg-white shadow-sm ${
                          activeThumb === "min" ? "z-30" : "z-20"
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(100, minPercent))}%`,
                          transform: "translateX(-50%)",
                        }}
                      />
                      <div
                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-black/60 bg-white shadow-sm ${
                          activeThumb === "max" ? "z-30" : "z-20"
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(100, maxPercent))}%`,
                          transform: "translateX(-50%)",
                        }}
                      />
                    </div>
                  </div>
                </Accordion>

                {/* CATEGORIES */}
                <Accordion
                  title="Categories"
                  open={section === "cat"}
                  onToggle={() =>
                    setSection((s) => (s === "cat" ? null : "cat"))
                  }
                >
                  <input
                    type="search"
                    value={collectionQuery}
                    onChange={(e) => setCollectionQuery(e.target.value)}
                    placeholder="Search categories"
                    className="mb-3 h-9 w-full rounded-md border border-black/10 px-2 text-sm outline-none focus:border-black/30"
                  />
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {filteredCollections.map(([handle, title]) => (
                      <label
                        key={handle}
                        className="flex items-center gap-2 cursor-pointer hover:bg-black/5 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={filters.collections.includes(handle)}
                          onChange={() => toggleCollection(handle)}
                        />
                        <span className="text-sm">{title}</span>
                      </label>
                    ))}
                  </div>
                </Accordion>

                {/* MANUFACTURER */}
                <Accordion
                  title="Brands"
                  open={section === "vendor"}
                  onToggle={() =>
                    setSection((s) => (s === "vendor" ? null : "vendor"))
                  }
                >
                  <input
                    type="search"
                    value={vendorQuery}
                    onChange={(e) => setVendorQuery(e.target.value)}
                    placeholder="Search brands"
                    className="mb-3 h-9 w-full rounded-md border border-black/10 px-2 text-sm outline-none focus:border-black/30"
                  />
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {filteredVendors.map((vendor) => (
                      <label
                        key={vendor}
                        className="flex items-center gap-2 cursor-pointer hover:bg-black/5 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={filters.vendors.includes(vendor)}
                          onChange={() => toggleVendor(vendor)}
                        />
                        <span className="text-sm">{vendor}</span>
                      </label>
                    ))}
                  </div>
                </Accordion>
              </div>

              {/* Footer */}
              <div className="h-16 border-t border-black/10 px-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onReset}
                  className="flex-1 h-11 rounded-md border border-black/10 text-sm font-semibold text-stone-600 hover:border-black/20"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-11 rounded-md bg-black text-white text-sm font-semibold"
                >
                  View ({resultCount})
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
