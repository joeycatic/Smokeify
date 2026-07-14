"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  Bars3BottomLeftIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { Product, ProductFilters } from "@/data/types";
import { filterProducts } from "@/lib/filterProducts";
import DisplayProducts, {
  DisplayProductsList,
} from "@/components/DisplayProducts";
import FilterDrawer from "@/components/FilterDrawer";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = {
  initialProducts: Product[];
  title: string;
  subtitle: string;
  copy?: string[];
  faq?: Array<{ question: string; answer: string }>;
  sizeLinks?: Array<{ label: string; href: string; active: boolean }>;
};

type SortMode = "featured" | "price_asc" | "price_desc" | "name_asc";

export default function SeoProductsClient({
  initialProducts,
  title,
  subtitle,
  copy,
  faq,
  sizeLinks,
}: Props) {
  const pageSize = 24;
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

  const priceMaxBound = useMemo(() => {
    const prices = normalizedProducts
      .map((p) => Number(p.priceRange?.minVariantPrice?.amount ?? 0))
      .filter((n) => Number.isFinite(n));
    const max = prices.length ? Math.max(...prices) : 0;
    return Math.max(10, Math.ceil(max / 10) * 10);
  }, [normalizedProducts]);

  const priceMinBound = 0;

  const [filters, setFilters] = useState<ProductFilters>({
    categories: [],
    manufacturers: [],
    priceMin: priceMinBound,
    priceMax: priceMaxBound,
  });
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortMode>("featured");
  const [isMobile, setIsMobile] = useState(false);
  const viewListTrackedRef = useRef<string | null>(null);
  const searchTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      setIsMobile(media.matches);
      setLayout("grid");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
    }));
  }, [priceMaxBound, priceMinBound]);

  const filteredProducts = useMemo(() => {
    const results = filterProducts(normalizedProducts, filters);
    return [...results];
  }, [normalizedProducts, filters]);
  const sortedProducts = useMemo(() => {
    const toPrice = (product: Product) =>
      Number(product.priceRange?.minVariantPrice?.amount ?? 0);
    const toCompareAtPrice = (product: Product) =>
      Number(product.compareAtPrice?.amount ?? 0);
    const toDiscountRatio = (product: Product) => {
      const price = toPrice(product);
      const compareAt = toCompareAtPrice(product);
      if (!Number.isFinite(price) || !Number.isFinite(compareAt)) return 0;
      if (price <= 0 || compareAt <= price) return 0;
      return (compareAt - price) / compareAt;
    };
    const indexById = new Map(
      filteredProducts.map((product, index) => [product.id, index]),
    );

    return [...filteredProducts].sort((a, b) => {
      const stockDelta =
        Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
      if (stockDelta !== 0) return stockDelta;

      if (sortBy === "price_asc") return toPrice(a) - toPrice(b);
      if (sortBy === "price_desc") return toPrice(b) - toPrice(a);
      if (sortBy === "name_asc") return a.title.localeCompare(b.title);

      // Recommended: in-stock first, stronger current discounts first,
      // then preserve backend order (updated content first from server query).
      const discountDelta = toDiscountRatio(b) - toDiscountRatio(a);
      if (discountDelta !== 0) return discountDelta;

      return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
    });
  }, [filteredProducts, sortBy]);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [filters, sortBy, pageSize]);

  const visibleProducts = useMemo(
    () => sortedProducts.slice(0, visibleCount),
    [sortedProducts, visibleCount],
  );
  const canLoadMore = visibleCount < sortedProducts.length;

  const availableCategories = useMemo(() => {
    const categories = new Map<string, string>();
    normalizedProducts.forEach((product) => {
      product.categories?.forEach((category) => {
        categories.set(category.handle, category.title);
      });
    });
    return Array.from(categories.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [normalizedProducts]);

  const availableManufacturers = useMemo(() => {
    const manufacturers = new Set<string>();
    const categoryFilters = filters.categories ?? [];
    const sourceProducts =
      categoryFilters.length === 0
        ? normalizedProducts
        : normalizedProducts.filter((product) => {
            const handles = product.categories.map((c) => c.handle);
            return categoryFilters.some((handle) => handles.includes(handle));
          });
    sourceProducts.forEach((product) => {
      if (product.manufacturer) manufacturers.add(product.manufacturer);
    });
    return Array.from(manufacturers).sort((a, b) => a.localeCompare(b));
  }, [normalizedProducts, filters.categories]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> =
      [];
    const categoryTitleByHandle = new Map(availableCategories);

    filters.categories.forEach((handle) => {
      const title = categoryTitleByHandle.get(handle) ?? handle;
      chips.push({
        key: `category:${handle}`,
        label: title,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            categories: prev.categories.filter((c) => c !== handle),
          })),
      });
    });

    filters.manufacturers.forEach((manufacturer) => {
      chips.push({
        key: `manufacturer:${manufacturer}`,
        label: manufacturer,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            manufacturers: prev.manufacturers.filter((m) => m !== manufacturer),
          })),
      });
    });

    if (filters.priceMin > priceMinBound || filters.priceMax < priceMaxBound) {
      chips.push({
        key: "price",
        label: `Preis ${filters.priceMin}–${filters.priceMax}`,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            priceMin: priceMinBound,
            priceMax: priceMaxBound,
          })),
      });
    }

    if (filters.searchQuery?.trim()) {
      chips.push({
        key: "search",
        label: `Suche: ${filters.searchQuery.trim()}`,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            searchQuery: "",
          })),
      });
    }

    return chips;
  }, [availableCategories, filters, priceMaxBound, priceMinBound]);

  const resetFilters = () => {
    setFilters({
      categories: [],
      manufacturers: [],
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
      searchQuery: "",
    });
  };

  const handleSelectItem = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const el = target?.closest<HTMLElement>("[data-gtag-item-id]");
    if (!el) return;
    const {
      gtagItemId,
      gtagItemName,
      gtagItemBrand,
      gtagItemCategory,
      gtagItemPrice,
      gtagItemIndex,
    } = el.dataset;
    if (!gtagItemId || !gtagItemName) return;
    trackAnalyticsEvent("select_item", {
      item_list_id: `seo:${title.toLowerCase()}`,
      item_list_name: `seo:${title}`,
      items: [
        {
          item_id: gtagItemId,
          item_name: gtagItemName,
          item_brand: gtagItemBrand || undefined,
          item_category: gtagItemCategory || undefined,
          price: gtagItemPrice ? Number(gtagItemPrice) : undefined,
          index: gtagItemIndex ? Number(gtagItemIndex) : undefined,
          quantity: 1,
        },
      ],
    });
  };

  useEffect(() => {
    if (sortedProducts.length === 0) return;
    const key = `${title}:${sortBy}:${sortedProducts.length}`;
    if (viewListTrackedRef.current === key) return;
    viewListTrackedRef.current = key;
    const items = sortedProducts.slice(0, 20).map((product) => ({
      item_id: product.defaultVariantId ?? product.id,
      item_name: product.title,
      item_brand: product.manufacturer ?? undefined,
      item_category: product.categories?.[0]?.title,
      price: Number(product.priceRange?.minVariantPrice?.amount ?? 0),
      quantity: 1,
    }));
    trackAnalyticsEvent("view_item_list", {
      item_list_id: `seo:${title.toLowerCase()}`,
      item_list_name: `seo:${title}`,
      items,
    });
  }, [sortedProducts, title, sortBy]);

  useEffect(() => {
    const term = filters.searchQuery?.trim();
    if (!term) {
      searchTrackedRef.current = null;
      return;
    }
    const timer = setTimeout(() => {
      if (searchTrackedRef.current === term) return;
      searchTrackedRef.current = term;
      trackAnalyticsEvent("search", { search_term: term });
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.searchQuery]);

  return (
    <div className="w-full text-[color:var(--gv-text)]">
      <div className="gv-panel mt-0 rounded-[28px] px-4 py-4 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2">
              <span className="gv-chip">Produkte</span>
              <span className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--gv-lime)] lg:hidden">
                {sortedProducts.length} Treffer
              </span>
            </div>
            <h1 className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.04em] text-[color:var(--gv-text)] sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[color:var(--gv-text-muted)]">
              {subtitle}
            </p>
          </div>
          <div className="hidden text-right lg:block">
            <p className="font-[family:var(--font-jetbrains-mono)] text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--gv-lime)]">
              {sortedProducts.length} Treffer
            </p>
          </div>
        </div>

        {sizeLinks && sizeLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6">
            {sizeLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`inline-flex rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  link.active
                    ? "border-[color:var(--gv-lime)]/45 bg-[color:var(--gv-lime)]/12 text-[color:var(--gv-text)]"
                    : "border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text-muted)] hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-lime)]/8 hover:text-[color:var(--gv-text)]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:mt-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:max-w-2xl">
            <div className="relative">
              <MagnifyingGlassIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--gv-text-muted)]"
              />
              <input
                type="search"
                value={filters.searchQuery ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    searchQuery: e.target.value,
                  }))
                }
                placeholder={`${title} durchsuchen...`}
                className="gv-input h-11 w-full rounded-full pl-12 pr-4 text-sm shadow-[0_12px_32px_rgba(0,0,0,0.24)] outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex justify-center gap-2 sm:gap-3">
              <div className="relative grid h-11 w-36 grid-cols-2 overflow-hidden rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] p-[5px] shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
                <span
                  className={`absolute bottom-1 top-1 rounded-full bg-[color:var(--gv-lime)] transition-all duration-200 ease-out ${
                    layout === "grid"
                      ? "left-1 right-[calc(50%-1px)]"
                      : "left-[calc(50%+1px)] right-1"
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setLayout("grid")}
                  aria-label="Rasteransicht"
                  aria-pressed={layout === "grid"}
                  className={`relative z-10 inline-flex h-[34px] w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                    layout === "grid"
                      ? "text-white"
                      : "text-[color:var(--gv-text-muted)] hover:text-[color:var(--gv-text)]"
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                  <span className="sm:hidden">2x</span>
                  <span className="hidden sm:inline">4x</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("list")}
                  aria-label="Einspaltige Ansicht"
                  aria-pressed={layout === "list"}
                  className={`relative z-10 inline-flex h-[34px] w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                    layout === "list"
                      ? "text-white"
                      : "text-[color:var(--gv-text-muted)] hover:text-[color:var(--gv-text)]"
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
                availableManufacturers={availableManufacturers}
                priceMinBound={priceMinBound}
                priceMaxBound={priceMaxBound}
                resultCount={sortedProducts.length}
                onReset={resetFilters}
                triggerClassName="inline-flex h-11 min-w-[8rem] items-center justify-center gap-2 rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-5 text-sm font-semibold text-[color:var(--gv-text)] shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition hover:border-[color:var(--gv-lime)]/35 sm:w-auto"
                triggerBadgeClassName="rounded-full bg-[color:var(--gv-lime)] px-2.5 py-1 text-sm font-semibold text-white"
              />
            </div>
            <div className="flex justify-center">
              <label className="inline-flex h-11 w-44 items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3 text-xs font-semibold text-[color:var(--gv-text-muted)] shadow-[0_12px_24px_rgba(0,0,0,0.18)] sm:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortMode)}
                  aria-label="Sortierung"
                  className="w-full bg-transparent pr-3 text-center text-sm font-semibold text-[color:var(--gv-text)] outline-none sm:w-auto sm:text-center"
                >
                  <option value="featured" className="bg-white text-stone-900">
                    {isMobile ? "Bestseller" : "Empfohlen"}
                  </option>
                  <option value="price_asc" className="bg-white text-stone-900">
                    Preis aufsteigend
                  </option>
                  <option value="price_desc" className="bg-white text-stone-900">
                    Preis absteigend
                  </option>
                  <option value="name_asc" className="bg-white text-stone-900">
                    Name A-Z
                  </option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="mt-6 mb-8 flex flex-wrap items-center gap-2">
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
            Alle Filter löschen
          </button>
        </div>
      )}

      <div onClick={handleSelectItem}>
        {layout === "grid" || isMobile ? (
          <DisplayProducts
            products={visibleProducts}
            cols={4}
            mobileCols={layout === "grid" ? 2 : 1}
            showManufacturer
            titleLines={3}
            showGrowboxSize
            hideCartLabel={isMobile && layout === "grid"}
            prioritizeFirstImage
          />
        ) : (
          <DisplayProductsList
            products={visibleProducts}
            showManufacturer
            showGrowboxSize
          />
        )}
      </div>

      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((prev) =>
                Math.min(prev + pageSize, sortedProducts.length),
              )
            }
            className="smk-button-secondary inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold focus-visible:ring-offset-black"
          >
            Mehr laden
          </button>
        </div>
      )}

      {sortedProducts.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-2">Keine Produkte gefunden</p>
          <p className="text-sm text-stone-500 mb-6">
            Passe deine Auswahl an oder starte mit einer kuratierten Seite.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {Boolean(filters.searchQuery?.trim()) && (
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, searchQuery: "" }))
                }
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-black/20"
              >
                Suche löschen
              </button>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-black/20"
            >
              Alle Filter zurücksetzen
            </button>
            <Link
              href="/bestseller"
              className="inline-flex items-center justify-center rounded-full bg-[#254237] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Zu den Bestsellern
            </Link>
          </div>
        </div>
      )}

      {copy && copy.length > 0 && (
        <div className="smk-panel mt-12 rounded-[32px] px-6 py-8 text-sm text-[var(--smk-text-muted)] sm:px-10 sm:text-base">
          <div className="mx-auto max-w-3xl space-y-4">
            {copy.map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      {faq && faq.length > 0 && (
        <div className="smk-panel mt-8 rounded-[32px] px-6 py-6 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-lg font-semibold text-[var(--smk-text)]">
              Häufige Fragen
            </h2>
            <div className="mt-4 space-y-3">
              {faq.map((item, index) => (
                <details
                  key={`${item.question}-${index}`}
                  className="group rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--smk-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(241,198,132,0.32)] focus-visible:ring-offset-2 focus-visible:ring-offset-black [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <span className="text-[var(--smk-text-dim)] transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="mt-3 text-sm text-[var(--smk-text-muted)]">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
