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
        <span className="text-sm font-semibold tracking-wide">{title}</span>
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

  const priceRange = Math.max(priceMaxBound - priceMinBound, 1);
  const minPercent = ((filters.priceMin - priceMinBound) / priceRange) * 100;
  const maxPercent = ((filters.priceMax - priceMinBound) / priceRange) * 100;

  const valueFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return priceMinBound;
    const ratio = (clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    const raw = priceMinBound + clamped * (priceMaxBound - priceMinBound);
    return Number(raw.toFixed(2));
  };

  const updateMin = (value: number) => {
    setFilters((f) => ({
      ...f,
      priceMin: Math.min(value, f.priceMax),
    }));
  };

  const updateMax = (value: number) => {
    setFilters((f) => ({
      ...f,
      priceMax: Math.max(value, f.priceMin),
    }));
  };

  return (
    <>
      {/* Trigger */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#E4C56C] px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:opacity-90"
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
                <div className="text-sm font-semibold tracking-widest">
                  FILTER
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
                {/* PRICE */}
                <Accordion
                  title="PRICE"
                  open={section === "price"}
                  onToggle={() =>
                    setSection((s) => (s === "price" ? null : "price"))
                  }
                >
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span>€ {Number(filters.priceMin).toFixed(2)}</span>
                    <span>€ {Number(filters.priceMax).toFixed(2)}</span>
                  </div>

                  {/* Single bar with two thumbs */}
                  <div className="relative mt-2 h-5">
                    <div
                      ref={trackRef}
                      className="absolute left-2 right-2 top-0 h-5 select-none touch-none"
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
                      <div className="absolute left-0 top-2 h-1 w-full rounded-full bg-black/10" />
                      <div
                        className="absolute top-2 h-1 rounded-full bg-black"
                        style={{
                          left: `${Math.max(0, Math.min(100, minPercent))}%`,
                          right: `${Math.max(
                            0,
                            Math.min(100, 100 - maxPercent)
                          )}%`,
                        }}
                      />
                      <div
                        className={`absolute top-1.5 h-3 w-3 rounded-full border border-black bg-white shadow ${
                          activeThumb === "min" ? "z-30" : "z-20"
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(100, minPercent))}%`,
                          transform: "translateX(-50%)",
                        }}
                      />
                      <div
                        className={`absolute top-1.5 h-3 w-3 rounded-full border border-black bg-white shadow ${
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
                  title="CATEGORIES"
                  open={section === "cat"}
                  onToggle={() =>
                    setSection((s) => (s === "cat" ? null : "cat"))
                  }
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
                  onToggle={() =>
                    setSection((s) => (s === "vendor" ? null : "vendor"))
                  }
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
