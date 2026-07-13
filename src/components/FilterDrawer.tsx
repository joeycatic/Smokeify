"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { ProductFilters } from "@/data/types";

const subscribeToClient = () => () => undefined;

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
    <div className="border-b border-[color:var(--gv-border)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center justify-between py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-[family:var(--font-syne)] text-base font-bold text-[color:var(--gv-text)]">
          {title}
        </span>
        <span
          className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--gv-border)] bg-white text-[color:var(--gv-text-muted)] transition duration-200 group-hover:border-[color:var(--gv-lime)]/30 group-hover:text-[color:var(--gv-lime)]"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? "9999px" : "0", opacity: open ? 1 : 0 }}
      >
        <div className="pb-4">{children}</div>
      </div>
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
  >("cat");
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [manufacturerQuery, setManufacturerQuery] = useState("");
  const isClient = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
  const portalTarget = isClient ? document.body : null;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerId = "product-filter-drawer";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.filterOpen = "true";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      delete document.documentElement.dataset.filterOpen;
      trigger?.focus();
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

  const toggleCategory = useCallback(
    (handle: string) => {
      setFilters((prev) => ({
        ...prev,
        categories: prev.categories.includes(handle)
          ? prev.categories.filter((c) => c !== handle)
          : [...prev.categories, handle],
      }));
    },
    [setFilters],
  );

  const toggleManufacturer = useCallback(
    (manufacturer: string) => {
      setFilters((prev) => ({
        ...prev,
        manufacturers: (prev.manufacturers ?? []).includes(manufacturer)
          ? (prev.manufacturers ?? []).filter((m) => m !== manufacturer)
          : [...(prev.manufacturers ?? []), manufacturer],
      }));
    },
    [setFilters],
  );

  const categoryMap = useMemo(
    () => new Map(availableCategories),
    [availableCategories],
  );

  const filteredCategories = useMemo(() => {
    if (!categoryQuery.trim()) return availableCategories;
    const query = categoryQuery.trim().toLowerCase();
    return availableCategories.filter(([, title]) =>
      title.toLowerCase().includes(query),
    );
  }, [availableCategories, categoryQuery]);

  const filteredManufacturers = useMemo(() => {
    if (!manufacturerQuery.trim()) return availableManufacturers;
    const query = manufacturerQuery.trim().toLowerCase();
    return availableManufacturers.filter((manufacturer) =>
      manufacturer.toLowerCase().includes(query),
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
          2,
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
  }, [
    filters,
    categoryMap,
    priceMinBound,
    priceMaxBound,
    setFilters,
    toggleCategory,
    toggleManufacturer,
  ]);

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
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={drawerId}
        className={
          triggerClassName ??
          "group inline-flex h-12 items-center gap-2 rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-6 text-sm font-semibold text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/40"
        }
      >
        <FunnelIcon
          aria-hidden="true"
          className="h-4 w-4 text-[color:var(--gv-lime)] transition-transform duration-200 group-hover:-rotate-6"
        />
        Filter
        {activeCount > 0 && (
          <span
            aria-label={`${activeCount} aktive Filter`}
            className={
              triggerBadgeClassName ??
              "rounded-full bg-[color:var(--gv-lime)] px-2.5 py-1 text-sm font-semibold text-white"
            }
          >
            {activeCount}
          </span>
        )}
      </button>

      {open &&
        portalTarget &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Filter über Hintergrund schließen"
              onClick={() => setOpen(false)}
              className="filter-overlay-in fixed inset-0 bg-[#102119]/55 backdrop-blur-[3px]"
              style={{ zIndex: "var(--gv-z-filter-overlay)" }}
            />

            <aside
              id={drawerId}
              className="filter-drawer-in fixed right-0 top-0 flex h-dvh w-full flex-col overflow-hidden bg-[color:var(--gv-forest)] text-[color:var(--gv-text)] shadow-[-28px_0_80px_rgba(9,32,20,0.24)] sm:w-[460px] sm:rounded-l-[32px]"
              style={{ zIndex: "var(--gv-z-filter-drawer)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${drawerId}-title`}
            >
              <div className="relative overflow-hidden border-b border-[color:var(--gv-border)] bg-[linear-gradient(135deg,#f7fbf8_0%,#e7f0e9_58%,#f7e8dc_140%)] px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full border-[32px] border-[color:var(--gv-lime)]/5"
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gv-lime)]/15 bg-white/70 px-2.5 py-1 font-[family:var(--font-jetbrains-mono)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-lime)]">
                      <SparklesIcon
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Auswahl verfeinern
                    </div>
                    <h2
                      id={`${drawerId}-title`}
                      className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.035em]"
                    >
                      Finde deinen Match
                    </h2>
                    <p className="mt-1 text-sm text-[color:var(--gv-text-muted)]">
                      {resultCount} passende{" "}
                      {resultCount === 1 ? "Produkt" : "Produkte"}
                    </p>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[color:var(--gv-border)] bg-white text-[color:var(--gv-text-muted)] shadow-sm transition hover:rotate-3 hover:border-[color:var(--gv-lime)]/35 hover:text-[color:var(--gv-lime)]"
                    aria-label="Filter schließen"
                  >
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="pretty-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
                <div className="py-5">
                  <div className="flex items-center justify-between">
                    <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)]">
                      Deine Auswahl
                    </p>
                    {activeFilters.length > 0 && (
                      <button
                        type="button"
                        onClick={onReset}
                        className="text-xs font-bold text-[color:var(--gv-lime)] hover:underline"
                      >
                        Alle löschen
                      </button>
                    )}
                  </div>
                  {activeFilters.length === 0 ? (
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-surface)]/55 px-3.5 py-3 text-sm text-[color:var(--gv-text-muted)]">
                      <FunnelIcon
                        className="h-4 w-4 shrink-0 text-[color:var(--gv-lime)]"
                        aria-hidden="true"
                      />
                      Noch alles offen – grenze die Auswahl nach Wunsch ein.
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeFilters.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={filter.onRemove}
                          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-brand-soft)] px-3.5 py-2 text-sm font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40"
                        >
                          <span>{filter.label}</span>
                          <span
                            className="text-sm leading-none"
                            aria-hidden="true"
                          >
                            ×
                          </span>
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
                      <span className="text-[color:var(--gv-text-muted)]">
                        Min
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={filters.priceMax}
                        step="1"
                        value={String(
                          Math.max(1, Math.round(filters.priceMin)),
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") return;
                          updateMin(Number(raw));
                        }}
                        className="gv-input h-11 rounded-2xl px-3 text-base outline-none focus:border-[color:var(--gv-lime)]/50"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[color:var(--gv-text-muted)]">
                        Max
                      </span>
                      <input
                        type="number"
                        min={Math.max(1, Math.round(filters.priceMin))}
                        max={Math.max(1, Math.round(priceMaxBound))}
                        step="1"
                        value={String(
                          Math.max(1, Math.round(filters.priceMax)),
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") return;
                          updateMax(Number(raw));
                        }}
                        className="gv-input h-11 rounded-2xl px-3 text-base outline-none focus:border-[color:var(--gv-lime)]/50"
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
                      <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-[color:var(--gv-border)]" />
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-green-700"
                        style={{
                          left: `${Math.max(0, Math.min(100, minPercent))}%`,
                          right: `${Math.max(
                            0,
                            Math.min(100, 100 - maxPercent),
                          )}%`,
                        }}
                      />
                      <div
                        className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-[color:var(--gv-lime)] bg-[color:var(--gv-lime)] shadow-sm ${
                          activeThumb === "min" ? "z-30" : "z-20"
                        }`}
                        style={{
                          left: `${Math.max(0, Math.min(100, minPercent))}%`,
                          transform: "translateX(-50%)",
                        }}
                      />
                      <div
                        className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-[color:var(--gv-lime)] bg-[color:var(--gv-lime)] shadow-sm ${
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
                  <div className="relative mb-3">
                    <MagnifyingGlassIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--gv-text-muted)]"
                    />
                    <input
                      type="search"
                      value={categoryQuery}
                      onChange={(e) => setCategoryQuery(e.target.value)}
                      placeholder="Kategorien suchen"
                      className="gv-input h-11 w-full rounded-2xl pl-10 pr-3 text-base outline-none focus:border-[color:var(--gv-lime)]/50"
                    />
                  </div>
                  <div className="pretty-scrollbar max-h-56 space-y-1 overflow-y-auto pr-1">
                    {filteredCategories.map(([handle, title]) => (
                      <label
                        key={handle}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${
                          filters.categories.includes(handle)
                            ? "border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-brand-soft)]"
                            : "border-transparent hover:border-[color:var(--gv-border)] hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={filters.categories.includes(handle)}
                          onChange={() => toggleCategory(handle)}
                          className="h-4 w-4 accent-[color:var(--gv-lime)]"
                        />
                        <span className="text-sm font-semibold">{title}</span>
                      </label>
                    ))}
                    {filteredCategories.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[color:var(--gv-border)] px-3 py-4 text-center text-sm text-[color:var(--gv-text-muted)]">
                        Keine passende Kategorie gefunden.
                      </p>
                    ) : null}
                  </div>
                </Accordion>

                {/* MANUFACTURER */}
                <Accordion
                  title="Hersteller"
                  open={section === "manufacturer"}
                  onToggle={() =>
                    setSection((s) =>
                      s === "manufacturer" ? null : "manufacturer",
                    )
                  }
                >
                  <div className="relative mb-3">
                    <MagnifyingGlassIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--gv-text-muted)]"
                    />
                    <input
                      type="search"
                      value={manufacturerQuery}
                      onChange={(e) => setManufacturerQuery(e.target.value)}
                      placeholder="Hersteller suchen"
                      className="gv-input h-11 w-full rounded-2xl pl-10 pr-3 text-base outline-none focus:border-[color:var(--gv-lime)]/50"
                    />
                  </div>
                  <div className="pretty-scrollbar max-h-56 space-y-1 overflow-y-auto pr-1">
                    {filteredManufacturers.map((manufacturer) => (
                      <label
                        key={manufacturer}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${
                          (filters.manufacturers ?? []).includes(manufacturer)
                            ? "border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-brand-soft)]"
                            : "border-transparent hover:border-[color:var(--gv-border)] hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(filters.manufacturers ?? []).includes(
                            manufacturer,
                          )}
                          onChange={() => toggleManufacturer(manufacturer)}
                          className="h-4 w-4 accent-[color:var(--gv-lime)]"
                        />
                        <span className="text-sm font-semibold">
                          {manufacturer}
                        </span>
                      </label>
                    ))}
                    {filteredManufacturers.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[color:var(--gv-border)] px-3 py-4 text-center text-sm text-[color:var(--gv-text-muted)]">
                        Kein passender Hersteller gefunden.
                      </p>
                    ) : null}
                  </div>
                </Accordion>
              </div>

              <div className="flex items-center gap-3 border-t border-[color:var(--gv-border)] bg-white/90 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:px-6">
                <button
                  type="button"
                  onClick={onReset}
                  className="h-12 flex-1 rounded-2xl border border-[color:var(--gv-border)] text-sm font-bold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40 hover:bg-[color:var(--gv-surface)]"
                >
                  Zurücksetzen
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-12 flex-[1.35] rounded-2xl bg-[color:var(--gv-lime)] px-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(31,95,63,0.22)] hover:bg-[color:var(--gv-lime-dim)]"
                >
                  {resultCount} {resultCount === 1 ? "Produkt" : "Produkte"}{" "}
                  zeigen
                </button>
              </div>
            </aside>
          </>,
          portalTarget,
        )}
    </>
  );
}
