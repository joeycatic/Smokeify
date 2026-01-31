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
        className="w-full flex items-center justify-between py-5"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-stone-800">{title}</span>
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
  availableCategories,
  availableManufacturers,
  priceMinBound = 0,
  priceMaxBound = 10000,
  resultCount,
  onReset,
  triggerClassName,
  triggerBadgeClassName,
}: {
  filters: ProductFilters;
  setFilters: React.Dispatch<React.SetStateAction<ProductFilters>>;
  availableCategories: Array<[handle: string, title: string]>;
  availableManufacturers: string[];
  priceMinBound?: number;
  priceMaxBound?: number;
  resultCount: number;
  onReset: () => void;
  triggerClassName?: string;
  triggerBadgeClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<
    "price" | "cat" | "manufacturer" | null
  >("price");
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [manufacturerQuery, setManufacturerQuery] = useState("");
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
    c += filters.categories.length;
    c += filters.manufacturers?.length ?? 0;
    if (filters.priceMin > priceMinBound || filters.priceMax < priceMaxBound)
      c += 1;
    if (filters.searchQuery?.trim()) c += 1;
    return c;
  }, [filters, priceMinBound, priceMaxBound]);

  const toggleCategory = (handle: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(handle)
        ? prev.categories.filter((c) => c !== handle)
        : [...prev.categories, handle],
    }));
  };

  const toggleManufacturer = (manufacturer: string) => {
    setFilters((prev) => ({
      ...prev,
      manufacturers: (prev.manufacturers ?? []).includes(manufacturer)
        ? (prev.manufacturers ?? []).filter((m) => m !== manufacturer)
        : [...(prev.manufacturers ?? []), manufacturer],
    }));
  };

  const categoryMap = useMemo(
    () => new Map(availableCategories),
    [availableCategories]
  );

  const filteredCategories = useMemo(() => {
    if (!categoryQuery.trim()) return availableCategories;
    const query = categoryQuery.trim().toLowerCase();
    return availableCategories.filter(([, title]) =>
      title.toLowerCase().includes(query)
    );
  }, [availableCategories, categoryQuery]);

  const filteredManufacturers = useMemo(() => {
    if (!manufacturerQuery.trim()) return availableManufacturers;
    const query = manufacturerQuery.trim().toLowerCase();
    return availableManufacturers.filter((manufacturer) =>
      manufacturer.toLowerCase().includes(query)
    );
  }, [availableManufacturers, manufacturerQuery]);

  const activeFilters = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      onRemove: () => void;
    }> = [];

    filters.categories.forEach((handle) => {
      const title = categoryMap.get(handle) ?? handle;
      items.push({
        key: `category-${handle}`,
        label: `Kategorie: ${title}`,
        onRemove: () => toggleCategory(handle),
      });
    });

    (filters.manufacturers ?? []).forEach((manufacturer) => {
      items.push({
        key: `manufacturer-${manufacturer}`,
        label: `Hersteller: ${manufacturer}`,
        onRemove: () => toggleManufacturer(manufacturer),
      });
    });

    if (filters.priceMin > priceMinBound || filters.priceMax < priceMaxBound) {
      items.push({
        key: "price",
        label: `Preis: EUR ${filters.priceMin.toFixed(
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
        label: `Suche: ${filters.searchQuery.trim()}`,
        onRemove: () => setFilters((prev) => ({ ...prev, searchQuery: "" })),
      });
    }

    return items;
  }, [filters, categoryMap, priceMinBound, priceMaxBound, setFilters]);

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
          className={
            triggerClassName ??
            "inline-flex h-12 items-center gap-2 rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-black/20"
          }
        >
          Filter
          {activeCount > 0 && (
            <span
              className={
                triggerBadgeClassName ??
                "rounded-full bg-black/10 px-2.5 py-1 text-sm font-semibold text-black/70"
              }
            >
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
              className="fixed right-0 top-0 h-dvh w-full sm:w-[440px] bg-white text-stone-900 z-50 flex flex-col"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.26, ease: "easeInOut" }}
              role="dialog"
              aria-modal="true"
              aria-label="Filter panel"
            >
              {/* Header */}
              <div className="h-16 px-5 border-b border-black/10 flex items-center justify-between">
                <div className="w-8" />
                <div className="text-base font-semibold text-stone-800">
                  Filter
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 grid place-items-center text-2xl"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5">
                <div className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-stone-500">
                      Aktive Filter
                    </p>
                    {activeFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={onReset}
                        className="text-sm font-semibold text-stone-600 hover:text-stone-800"
                      >
                        Alle löschen
                      </button>
                    )}
                  </div>
                  {activeFilters.length === 0 ? (
                    <p className="mt-2 text-sm text-stone-500">
                      Keine Filter aktiv.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeFilters.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={filter.onRemove}
                          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-stone-50 px-3.5 py-1.5 text-sm font-semibold text-stone-700 hover:border-black/30"
                        >
                          <span>{filter.label}</span>
                          <span className="text-base">x</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* PRICE */}
                <Accordion
                  title="Preis"
                  open={section === "price"}
                  onToggle={() =>
                    setSection((s) => (s === "price" ? null : "price"))
                  }
                >
                      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
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
                        className="h-11 rounded-md border border-black/10 px-3 text-base outline-none focus:border-black/30"
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
                        className="h-11 rounded-md border border-black/10 px-3 text-base outline-none focus:border-black/30"
                      />
                    </label>
                  </div>

                  {/* Single bar with two thumbs */}
                  <div className="relative mt-2 h-7">
                    <div
                      ref={trackRef}
                      className="absolute left-4 right-4 top-0 h-7 select-none touch-none"
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
                        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-black/60 bg-white shadow-sm ${
                          activeThumb === "min" ? "z-30" : "z-20"
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(100, minPercent))}%`,
                          transform: "translateX(-50%)",
                        }}
                      />
                      <div
                        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-black/60 bg-white shadow-sm ${
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
                  title="Kategorien"
                  open={section === "cat"}
                  onToggle={() =>
                    setSection((s) => (s === "cat" ? null : "cat"))
                  }
                >
                  <input
                    type="search"
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                    placeholder="Kategorien suchen"
                    className="mb-3 h-11 w-full rounded-md border border-black/10 px-3 text-base outline-none focus:border-black/30"
                  />
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {filteredCategories.map(([handle, title]) => (
                      <label
                        key={handle}
                        className="flex items-center gap-3 cursor-pointer hover:bg-black/5 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={filters.categories.includes(handle)}
                          onChange={() => toggleCategory(handle)}
                        />
                        <span className="text-base">{title}</span>
                      </label>
                    ))}
                  </div>
                </Accordion>

                {/* MANUFACTURER */}
                <Accordion
                  title="Hersteller"
                  open={section === "manufacturer"}
                  onToggle={() =>
                    setSection((s) =>
                      s === "manufacturer" ? null : "manufacturer"
                    )
                  }
                >
                  <input
                    type="search"
                    value={manufacturerQuery}
                    onChange={(e) => setManufacturerQuery(e.target.value)}
                    placeholder="Hersteller suchen"
                    className="mb-3 h-11 w-full rounded-md border border-black/10 px-3 text-base outline-none focus:border-black/30"
                  />
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {filteredManufacturers.map((manufacturer) => (
                      <label
                        key={manufacturer}
                        className="flex items-center gap-3 cursor-pointer hover:bg-black/5 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={(filters.manufacturers ?? []).includes(manufacturer)}
                          onChange={() => toggleManufacturer(manufacturer)}
                        />
                        <span className="text-base">{manufacturer}</span>
                      </label>
                    ))}
                  </div>
                </Accordion>

              </div>

              {/* Footer */}
              <div className="border-t border-black/10 px-5 py-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onReset}
                  className="flex-1 h-12 rounded-md border border-black/10 text-base font-semibold text-stone-600 hover:border-black/20"
                >
                  Löschen
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-12 rounded-md bg-black text-white text-base font-semibold"
                >
                  Anzeigen ({resultCount})
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
