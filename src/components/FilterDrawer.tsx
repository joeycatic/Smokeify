"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
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
        <span className="text-sm font-semibold tracking-wide">{title}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-black/70"
          aria-hidden
        >
          ⌄
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
  const [section, setSection] = useState<"price" | "cat" | "vendor">("price");

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
    if (filters.priceMin > priceMinBound || filters.priceMax < priceMaxBound) c += 1;
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

  return (
    <>
      {/* Trigger */}
      {!open && (
        <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-4 py-3 border border-black/20 rounded-md text-sm font-semibold"
        >
            FILTER ↔
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
              className="fixed inset-0 bg-black/35 z-40"
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
                <div className="text-sm font-semibold tracking-widest">FILTER</div>
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
                {/* PRICE */}
                <Accordion
                  title="PRICE"
                  open={section === "price"}
                  onToggle={() => setSection((s) => (s === "price" ? "cat" : "price"))}
                >
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span>€ {Number(filters.priceMin).toFixed(2)}</span>
                    <span>€ {Number(filters.priceMax).toFixed(2)}</span>
                  </div>

                  {/* Simple double range (min/max) */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-black/60 mb-1">Min</p>
                      <input
                        type="range"
                        min={priceMinBound}
                        max={priceMaxBound}
                        value={filters.priceMin}
                        onChange={(e) => {
                          const nextMin = Number(e.target.value);
                          setFilters((f) => ({
                            ...f,
                            priceMin: Math.min(nextMin, f.priceMax),
                          }));
                        }}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <p className="text-xs text-black/60 mb-1">Max</p>
                      <input
                        type="range"
                        min={priceMinBound}
                        max={priceMaxBound}
                        value={filters.priceMax}
                        onChange={(e) => {
                          const nextMax = Number(e.target.value);
                          setFilters((f) => ({
                            ...f,
                            priceMax: Math.max(nextMax, f.priceMin),
                          }));
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                </Accordion>

                {/* CATEGORIES */}
                <Accordion
                  title="CATEGORIES"
                  open={section === "cat"}
                  onToggle={() => setSection((s) => (s === "cat" ? "vendor" : "cat"))}
                >
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {availableCollections.map(([handle, title]) => (
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
                  title="MANUFACTURER"
                  open={section === "vendor"}
                  onToggle={() => setSection((s) => (s === "vendor" ? "price" : "vendor"))}
                >
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {availableVendors.map((vendor) => (
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
                  className="flex-1 h-11 px-5 py-3 border border-black/15 text-sm font-semibold tracking-wide text-black/50 bg-black/5"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-11 bg-black text-white text-sm font-semibold tracking-wide"
                >
                  VIEW [{resultCount}]
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
