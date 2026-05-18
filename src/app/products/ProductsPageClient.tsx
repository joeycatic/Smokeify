"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  Bars3BottomLeftIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { Product, ProductFilters } from "@/data/types";
import DisplayProducts, { DisplayProductsList } from "@/components/DisplayProducts";
import FilterDrawer from "@/components/FilterDrawer";
import { useSearchParams } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { ProductsQueryResult, SortMode } from "@/lib/productsQuery";

type Props = {
  initialData: ProductsQueryResult;
};

const PAGE_SIZE = 24;

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function ProductsPageClient({ initialData }: Props) {
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get("category") ?? "";
  const manufacturerParam = searchParams?.get("manufacturer") ?? "";

  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortMode>("featured");
  const [isMobile, setIsMobile] = useState(false);

  const [filters, setFilters] = useState<ProductFilters>({
    categories: categoryParam ? [categoryParam] : [],
    manufacturers: manufacturerParam ? parseCsv(manufacturerParam) : [],
    priceMin: initialData.priceMinBound,
    priceMax: initialData.priceMaxBound,
    searchQuery: "",
  });

  const [products, setProducts] = useState<Product[]>(initialData.products);
  const [total, setTotal] = useState(initialData.total);
  const [availableCategories, setAvailableCategories] = useState(
    initialData.availableCategories,
  );
  const [availableManufacturers, setAvailableManufacturers] = useState(
    initialData.availableManufacturers,
  );
  const [allCategoryTitles, setAllCategoryTitles] = useState(
    initialData.allCategoryTitles,
  );
  const [priceMinBound, setPriceMinBound] = useState(initialData.priceMinBound);
  const [priceMaxBound, setPriceMaxBound] = useState(initialData.priceMaxBound);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchAbortRef = useRef<AbortController | null>(null);
  const viewListTrackedRef = useRef<string | null>(null);
  const searchTrackedRef = useRef<string | null>(null);
  const skippedInitialFetchRef = useRef(false);
  const categoriesKey = filters.categories.join("|");
  const manufacturersKey = filters.manufacturers.join("|");

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
      categories: categoryParam ? [categoryParam] : [],
    }));
  }, [categoryParam]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      manufacturers: manufacturerParam ? parseCsv(manufacturerParam) : [],
    }));
  }, [manufacturerParam]);

  const listName = useMemo(() => {
    const searchTerm = filters.searchQuery?.trim();
    if (searchTerm) return `search:${searchTerm}`;
    if (categoryParam) {
      const categoryTitle = new Map(allCategoryTitles).get(categoryParam);
      return categoryTitle ? `category:${categoryTitle}` : `category:${categoryParam}`;
    }
    if (manufacturerParam) return `manufacturer:${manufacturerParam}`;
    return "products";
  }, [allCategoryTitles, categoryParam, filters.searchQuery, manufacturerParam]);

  const listId = useMemo(() => {
    const searchTerm = filters.searchQuery?.trim();
    if (searchTerm) return `search:${searchTerm.toLowerCase()}`;
    if (categoryParam) return `category:${categoryParam}`;
    if (manufacturerParam) return `manufacturer:${manufacturerParam.toLowerCase()}`;
    return "products";
  }, [categoryParam, filters.searchQuery, manufacturerParam]);

  const fetchProducts = async (offset: number, append: boolean) => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      params.set("limit", String(PAGE_SIZE));
      params.set("sortBy", sortBy);
      if (categoryParam) params.set("category", categoryParam);
      if (manufacturerParam) params.set("manufacturer", manufacturerParam);
      if (filters.categories.length > 0) {
        params.set("categories", filters.categories.join(","));
      }
      if (filters.manufacturers.length > 0) {
        params.set("manufacturers", filters.manufacturers.join(","));
      }
      params.set("priceMin", String(filters.priceMin));
      params.set("priceMax", String(filters.priceMax));
      if (filters.searchQuery?.trim()) {
        params.set("searchQuery", filters.searchQuery.trim());
      }

      const res = await fetch(`/api/products/query?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as ProductsQueryResult;
      setProducts((prev) => (append ? [...prev, ...data.products] : data.products));
      setTotal(data.total);
      setAvailableCategories(data.availableCategories);
      setAvailableManufacturers(data.availableManufacturers);
      setAllCategoryTitles(data.allCategoryTitles);
      setPriceMinBound(data.priceMinBound);
      setPriceMaxBound(data.priceMaxBound);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        // no-op
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    if (!skippedInitialFetchRef.current) {
      skippedInitialFetchRef.current = true;
      return;
    }
    void fetchProducts(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categoryParam,
    manufacturerParam,
    categoriesKey,
    manufacturersKey,
    filters.priceMin,
    filters.priceMax,
    filters.searchQuery,
    sortBy,
  ]);

  useEffect(() => {
    if (products.length === 0) return;
    const key = `${listId}:${sortBy}:${products.length}`;
    if (viewListTrackedRef.current === key) return;
    viewListTrackedRef.current = key;
    const items = products.slice(0, 20).map((product) => ({
      item_id: product.defaultVariantId ?? product.id,
      item_name: product.title,
      item_brand: product.manufacturer ?? undefined,
      item_category: product.categories?.[0]?.title,
      price: Number(product.priceRange?.minVariantPrice?.amount ?? 0),
      quantity: 1,
    }));
    trackAnalyticsEvent("view_item_list", {
      item_list_id: listId,
      item_list_name: listName,
      items,
    });
  }, [products, listId, listName, sortBy]);

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

  const categoryTitleByHandle = useMemo(
    () => new Map(allCategoryTitles),
    [allCategoryTitles],
  );

  const heroContent = useMemo(() => {
    const activeCategoryTitle = categoryParam
      ? (categoryTitleByHandle.get(categoryParam) ?? categoryParam)
      : null;
    const activeManufacturers = manufacturerParam
      ? parseCsv(manufacturerParam)
      : [];

    if (filters.searchQuery?.trim()) {
      return {
        kicker: "Suche",
        title: `Ergebnisse für “${filters.searchQuery.trim()}”`,
        description:
          "Verfeinere deine Suche mit Filtern, Layout und Sortierung, ohne den neuen Storeflow zu verlassen.",
      };
    }

    if (activeCategoryTitle) {
      return {
        kicker: "Kategorie",
        title: activeCategoryTitle,
        description: `Ausgewählte Produkte aus ${activeCategoryTitle} im aktuellen Smokeify Store-Look.`,
      };
    }

    if (activeManufacturers.length > 0) {
      return {
        kicker: "Hersteller",
        title: activeManufacturers.join(", "),
        description:
          "Markenfokussierte Auswahl mit denselben Filtern, Vergleichen und Produktkarten wie im restlichen Store.",
      };
    }

    return {
      kicker: "Katalog",
      title: "Unsere Produkte",
      description: "Kuratierte Technik für Licht, Luft, Zelte und Zubehör.",
    };
  }, [categoryParam, categoryTitleByHandle, filters.searchQuery, manufacturerParam]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    filters.categories.forEach((handle) => {
      chips.push({
        key: `category-${handle}`,
        label: categoryTitleByHandle.get(handle) ?? handle,
        onRemove: () =>
          setFilters((prev) => ({
            ...prev,
            categories: prev.categories.filter((c) => c !== handle),
          })),
      });
    });
    filters.manufacturers.forEach((manufacturer) => {
      chips.push({
        key: `manufacturer-${manufacturer}`,
        label: `Manufacturer: ${manufacturer}`,
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
        label: `EUR ${filters.priceMin.toFixed(2)} - EUR ${filters.priceMax.toFixed(2)}`,
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
        label: `Search: ${filters.searchQuery.trim()}`,
        onRemove: () => setFilters((prev) => ({ ...prev, searchQuery: "" })),
      });
    }
    return chips;
  }, [categoryTitleByHandle, filters, priceMinBound, priceMaxBound]);

  const resetFilters = () => {
    setFilters({
      categories: categoryParam ? [categoryParam] : [],
      manufacturers: manufacturerParam ? parseCsv(manufacturerParam) : [],
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
      searchQuery: "",
    });
  };

  const canLoadMore = products.length < total;

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
      item_list_id: listId,
      item_list_name: listName,
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

  return (
    <div className="w-full text-[var(--smk-text)]">
      <div className="mt-3 overflow-hidden rounded-[40px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_left,rgba(233,188,116,0.14),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(217,119,69,0.14),transparent_26%),linear-gradient(135deg,rgba(18,16,14,0.99)_0%,rgba(28,24,21,0.98)_42%,rgba(11,10,9,1)_100%)] px-6 py-10 text-[var(--smk-text)] shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:px-10">
        <div className="relative text-center">
          <div className="absolute left-0 top-0 h-28 w-28 rounded-full bg-[rgba(233,188,116,0.12)] blur-3xl" />
          <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-[rgba(217,119,69,0.12)] blur-3xl" />
          <div className="relative">
            <p className="smk-kicker">{heroContent.kicker}</p>
            <h1 className="smk-heading mt-4 text-4xl text-[var(--smk-text)] sm:text-5xl">
              {heroContent.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--smk-text-muted)] sm:text-base">
              {heroContent.description}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="smk-chip">{total} Produkte</span>
              {categoryParam && (
                <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-muted)]">
                  {categoryTitleByHandle.get(categoryParam) ?? categoryParam}
                </span>
              )}
              {manufacturerParam && (
                <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-muted)]">
                  {parseCsv(manufacturerParam).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#3a4b41]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16.5" y2="16.5" />
              </svg>
            </span>
            <input
              type="search"
              value={filters.searchQuery ?? ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder="Produkte suchen..."
              className="smk-input h-12 w-full rounded-2xl pl-12 pr-4 text-sm shadow-[0_12px_30px_rgba(8,18,14,0.15)]"
            />
          </div>
          <div className="mx-auto w-full max-w-[23rem] sm:mx-0 sm:max-w-none sm:flex sm:w-auto sm:items-center">
            <div className="flex justify-center gap-2 sm:flex sm:items-center sm:justify-center sm:gap-3">
              <div className="relative grid h-11 w-36 grid-cols-2 overflow-hidden rounded-full border border-white/40 bg-white/95 p-[6px] shadow-sm sm:h-12 sm:w-40">
                <span
                  className={`absolute bottom-[5px] top-[5px] rounded-full bg-[linear-gradient(135deg,var(--smk-accent),var(--smk-accent-2))] transition-all duration-200 ease-out ${
                    layout === "grid"
                      ? "left-[5px] right-[calc(50%-1px)]"
                      : "left-[calc(50%+1px)] right-[5px]"
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setLayout("grid")}
                  className={`relative z-10 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full pb-0.5 text-sm font-semibold transition ${
                    layout === "grid"
                      ? "text-[#1a140f]"
                      : "text-[#2f241d] hover:bg-[#3a2e26]/10"
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                  {isMobile ? "2x" : "4x"}
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("list")}
                  className={`relative z-10 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full pb-0.5 text-sm font-semibold transition ${
                    layout === "list"
                      ? "text-[#1a140f]"
                      : "text-[#2f241d] hover:bg-[#3a2e26]/10"
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
                resultCount={total}
                onReset={resetFilters}
                triggerClassName="inline-flex h-11 min-w-[9rem] items-center justify-center gap-2 rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.94)] px-5 text-sm font-semibold text-[#1a140f] shadow-sm transition hover:border-[var(--smk-border-strong)] sm:h-12 sm:w-auto sm:px-6"
                triggerBadgeClassName="rounded-full bg-black/10 px-2.5 py-1 text-sm font-semibold text-[#1a140f]"
              />
            </div>
            <div className="mt-2 flex justify-center sm:ml-3 sm:mt-0">
              <label className="inline-flex h-11 w-44 items-center rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.94)] px-3 text-xs font-semibold text-[#2f241d] shadow-sm sm:h-12 sm:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortMode)}
                  aria-label="Sortierung"
                  className="w-full bg-transparent pr-3 text-center text-sm font-semibold text-[#1a140f] outline-none sm:w-auto sm:text-center"
                >
                  <option value="featured">{isMobile ? "Bestseller" : "Empfohlen"}</option>
                  <option value="price_asc">Preis aufsteigend</option>
                  <option value="price_desc">Preis absteigend</option>
                  <option value="name_asc">Name A-Z</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="mb-8 mt-6 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-xs font-semibold text-[var(--smk-text-muted)] transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-text)]"
            >
              <span>{chip.label}</span>
              <span className="text-sm">x</span>
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-[var(--smk-text-dim)] transition hover:text-[var(--smk-text)]"
          >
            Clear all
          </button>
        </div>
      )}

      <div onClick={handleSelectItem}>
        {layout === "grid" ? (
          <DisplayProducts
            products={products}
            cols={isMobile ? 2 : 4}
            showManufacturer
            titleLines={3}
            showGrowboxSize
            hideCartLabel={isMobile && layout === "grid"}
          />
        ) : (
          <DisplayProductsList
            products={products}
            showManufacturer
            showGrowboxSize
          />
        )}
      </div>

      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void fetchProducts(products.length, true)}
            className="smk-button-secondary inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold focus-visible:ring-offset-black disabled:opacity-60"
          >
            {loadingMore
              ? "Lädt..."
              : `Mehr laden (${Math.max(total - products.length, 0)} verbleibend)`}
          </button>
        </div>
      )}

      {loading && (
        <div className="py-8 text-center text-sm font-medium text-[var(--smk-text-muted)]">
          Produkte werden geladen...
        </div>
      )}

      {!loading && total === 0 && (
        <div className="py-16 text-center">
          <p className="mb-2 text-lg text-[var(--smk-text-muted)]">
            Keine Produkte gefunden
          </p>
          <p className="mb-6 text-sm text-[var(--smk-text-dim)]">
            Passe deine Auswahl an oder starte mit einer kuratierten Seite.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {Boolean(filters.searchQuery?.trim()) && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, searchQuery: "" }))}
                className="smk-button-secondary inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold"
              >
                Suche löschen
              </button>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="smk-button-secondary inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold"
            >
              Alle Filter zurücksetzen
            </button>
            <Link
              href="/bestseller"
              className="smk-button-primary inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold"
            >
              Zu den Bestsellern
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
