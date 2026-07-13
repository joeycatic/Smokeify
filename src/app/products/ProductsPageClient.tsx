"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  Bars3BottomLeftIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { Product, ProductFilters } from "@/data/types";
import DisplayProducts, { DisplayProductsList } from "@/components/DisplayProducts";
import EmptyState from "@/components/common/EmptyState";
import FilterDrawer from "@/components/FilterDrawer";
import { ListingGuidanceSection } from "@/components/storefront/CategoryDecisionModules";
import { useSearchParams } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  buildNoResultsGuidance,
  buildSearchIntentGuidance,
} from "@/lib/categoryDecision";
import { buildMerchantItemId } from "@/lib/merchantFeed";
import type { ProductsQueryResult, SortMode } from "@/lib/productsQuery";
import {
  buildListingQuickPickChips,
  buildListingResultSummary,
} from "@/lib/listingIntent";
import { buildGrowvaultAnalyzerUrl, buildGrowvaultCustomizerUrl } from "@/lib/growvaultPublicStorefront";
import {
  buildProductsSearchParams,
  filtersFromProductsUrlState,
  parseProductsUrlState,
  type ProductsUrlState,
} from "@/lib/productsUrlState";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  initialData: ProductsQueryResult;
  initialUrlState?: ProductsUrlState;
  scope?: "all" | "bestseller";
  headerChip?: string;
  headerTitle?: string;
  headerDescription?: string;
};

const PAGE_SIZE = 24;
const SEARCH_SUGGESTIONS = ["LED", "Abluft", "60x60", "leise", "Bewässerung", "Erde"] as const;

export default function ProductsPageClient({
  initialData,
  initialUrlState,
  scope = "all",
  headerChip = "Produkte",
  headerTitle = "Der Smokeify Katalog",
  headerDescription = "Finde Zelte, LEDs, Klima- und Messtechnik über einen sauberen Katalog mit klaren Filtern und nachvollziehbarer Sortierung.",
}: Props) {
  const resolvedInitialUrlState =
    initialUrlState ?? parseProductsUrlState(new URLSearchParams());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams?.toString() ?? "";
  const urlState = useMemo(
    () => parseProductsUrlState(new URLSearchParams(searchParamString)),
    [searchParamString],
  );
  const categoryParam = urlState.category;

  const [layout, setLayout] = useState<"grid" | "list">(resolvedInitialUrlState.view);
  const [sortBy, setSortBy] = useState<SortMode>(resolvedInitialUrlState.sortBy);
  const [isMobile, setIsMobile] = useState(false);

  const [filters, setFilters] = useState<ProductFilters>(() =>
    filtersFromProductsUrlState(resolvedInitialUrlState, {
      priceMinBound: initialData.priceMinBound,
      priceMaxBound: initialData.priceMaxBound,
    }),
  );

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
  const skippedInitialUrlSyncRef = useRef(false);
  const categoriesKey = filters.categories.join("|");
  const manufacturersKey = filters.manufacturers.join("|");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => {
      setIsMobile(media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setSortBy(urlState.sortBy);
    setLayout(urlState.view);
    setFilters(
      filtersFromProductsUrlState(urlState, {
        priceMinBound,
        priceMaxBound,
      }),
    );
  }, [priceMaxBound, priceMinBound, urlState]);

  useEffect(() => {
    if (!skippedInitialUrlSyncRef.current) {
      skippedInitialUrlSyncRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      const params = buildProductsSearchParams({
        filters,
        sortBy,
        view: layout,
        priceMinBound,
        priceMaxBound,
      });
      const nextQuery = params.toString();
      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
          scroll: false,
        });
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    categoriesKey,
    filters,
    filters.priceMin,
    filters.priceMax,
    filters.searchQuery,
    layout,
    manufacturersKey,
    pathname,
    priceMaxBound,
    priceMinBound,
    router,
    searchParamString,
    sortBy,
  ]);

  const listName = useMemo(() => {
    const searchTerm = filters.searchQuery?.trim();
    if (searchTerm) return `search:${searchTerm}`;
    if (filters.categories.length === 1) {
      const handle = filters.categories[0];
      const categoryTitle = new Map(allCategoryTitles).get(handle);
      return categoryTitle ? `category:${categoryTitle}` : `category:${handle}`;
    }
    if (filters.manufacturers.length === 1) return `manufacturer:${filters.manufacturers[0]}`;
    return "products";
  }, [allCategoryTitles, filters.categories, filters.manufacturers, filters.searchQuery]);

  const listId = useMemo(() => {
    const searchTerm = filters.searchQuery?.trim();
    if (searchTerm) return `search:${searchTerm.toLowerCase()}`;
    if (filters.categories.length === 1) return `category:${filters.categories[0]}`;
    if (filters.manufacturers.length === 1) {
      return `manufacturer:${filters.manufacturers[0].toLowerCase()}`;
    }
    return "products";
  }, [filters.categories, filters.manufacturers, filters.searchQuery]);

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
      params.set("scope", scope);
      const canonicalParams = buildProductsSearchParams({
        filters,
        sortBy,
        view: layout,
        priceMinBound,
        priceMaxBound,
      });
      canonicalParams.forEach((value, key) => {
        if (key !== "view") params.set(key, value);
      });

      const res = await fetch(`/api/products/query?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as ProductsQueryResult;
      startTransition(() => {
        setProducts((prev) =>
          append ? [...prev, ...data.products] : data.products,
        );
        setTotal(data.total);
        setAvailableCategories(data.availableCategories);
        setAvailableManufacturers(data.availableManufacturers);
        setAllCategoryTitles(data.allCategoryTitles);
        setPriceMinBound(data.priceMinBound);
        setPriceMaxBound(data.priceMaxBound);
      });
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
    const delayMs = filters.searchQuery?.trim() ? 250 : 0;
    const timer = window.setTimeout(() => {
      void fetchProducts(0, false);
    }, delayMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scope,
    categoriesKey,
    manufacturersKey,
    filters.priceMin,
    filters.priceMax,
    filters.searchQuery,
    layout,
    sortBy,
  ]);

  useEffect(() => {
    if (products.length === 0) return;
    const key = `${listId}:${sortBy}:${products.length}`;
    if (viewListTrackedRef.current === key) return;
    viewListTrackedRef.current = key;
    const items = products.slice(0, 20).map((product) => ({
      item_id: buildMerchantItemId(product.defaultVariantId ?? product.id),
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

  const activeCategoryHandle = useMemo(() => {
    if (filters.categories.length === 1) return filters.categories[0] ?? "";
    return categoryParam;
  }, [categoryParam, filters.categories]);

  const activeCategoryTitle = useMemo(
    () => categoryTitleByHandle.get(activeCategoryHandle) ?? "",
    [activeCategoryHandle, categoryTitleByHandle],
  );

  const searchIntentGuidance = useMemo(
    () =>
      buildSearchIntentGuidance(
        filters.searchQuery,
        activeCategoryHandle,
        activeCategoryTitle,
      ),
    [activeCategoryHandle, activeCategoryTitle, filters.searchQuery],
  );

  const noResultsGuidance = useMemo(
    () =>
      buildNoResultsGuidance({
        categoryHandle: activeCategoryHandle,
        categoryTitle: activeCategoryTitle,
        searchQuery: filters.searchQuery,
        availableCategories,
      }),
    [activeCategoryHandle, activeCategoryTitle, availableCategories, filters.searchQuery],
  );

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
        label: `Hersteller: ${manufacturer}`,
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
        label: `Suche: ${filters.searchQuery.trim()}`,
        onRemove: () => setFilters((prev) => ({ ...prev, searchQuery: "" })),
      });
    }
    return chips;
  }, [categoryTitleByHandle, filters, priceMinBound, priceMaxBound]);

  const quickPickChips = useMemo(
    () =>
      buildListingQuickPickChips({
        categoryHandle: activeCategoryHandle,
        categoryTitle: activeCategoryTitle,
      }),
    [activeCategoryHandle, activeCategoryTitle],
  );

  const resultSummary = useMemo(
    () =>
      buildListingResultSummary({
        total,
        categoryTitle: activeCategoryTitle,
        searchQuery: filters.searchQuery,
        manufacturers: filters.manufacturers,
        activeFilterCount: activeChips.length,
      }),
    [activeCategoryTitle, activeChips.length, filters.manufacturers, filters.searchQuery, total],
  );

  const resetFilters = () => {
    setFilters({
      categories: [],
      manufacturers: [],
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
      searchQuery: "",
    });
    setSortBy("featured");
    setLayout("grid");
  };

  const canLoadMore = products.length < total;
  const normalizedSearchQuery = (filters.searchQuery ?? "").trim().toLowerCase();
  const hasIssueIntent = ["gelbe blätter", "gelb", "krank", "problem"].some((term) =>
    normalizedSearchQuery.includes(term),
  );
  const hasQuietIntent = normalizedSearchQuery.includes("leise");
  const hasSizeIntent =
    normalizedSearchQuery.includes("60x60") || normalizedSearchQuery.includes("80x80");
  const hasVaultEasterEgg =
    normalizedSearchQuery === "vault" || normalizedSearchQuery === "geheim";

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
    <div className="w-full text-[color:var(--gv-text)]">
      <section className="gv-panel mt-3 rounded-[28px] px-4 py-4 sm:px-7 sm:py-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <span className="gv-chip">{headerChip}</span>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                <h1 className="font-[family:var(--font-syne)] text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                  {headerTitle}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--gv-text-muted)]">
                  {headerDescription}
                </p>
              </div>
                <div className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
                  {total} Treffer
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-[color:var(--gv-text-muted)]">
                {resultSummary}
              </p>
            </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div>
              <div className="relative">
                <MagnifyingGlassIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--gv-text-muted)]"
                />
              <input
                type="search"
                value={filters.searchQuery ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                }
                placeholder="Produkte suchen..."
                className="gv-input h-11 w-full rounded-[20px] pl-12 pr-4 text-sm outline-none focus:border-[color:var(--gv-lime)]/60 focus:ring-2 focus:ring-[color:var(--gv-lime)]/15"
              />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--gv-text-muted)]">
                <span>Versuch:</span>
                {SEARCH_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        searchQuery: suggestion,
                      }))
                    }
                    className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3 py-1.5 font-semibold text-[color:var(--gv-text)] transition-colors duration-200 hover:border-[color:var(--gv-lime)]/35 hover:bg-[color:var(--gv-lime)]/8"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:flex sm:flex-row">
              <div className="relative col-span-2 grid h-11 w-full grid-cols-2 overflow-hidden rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-[5px] sm:col-span-1 sm:w-36">
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
                  className={`relative z-10 inline-flex h-[34px] items-center justify-center gap-2 rounded-full text-sm font-semibold ${
                    layout === "grid"
                      ? "text-[color:var(--gv-forest)]"
                      : "text-[color:var(--gv-text-muted)]"
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
                  className={`relative z-10 inline-flex h-[34px] items-center justify-center gap-2 rounded-full text-sm font-semibold ${
                    layout === "list"
                      ? "text-[color:var(--gv-forest)]"
                      : "text-[color:var(--gv-text-muted)]"
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
                triggerClassName="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 text-sm font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40 sm:w-auto sm:min-w-[8rem]"
                triggerBadgeClassName="rounded-full bg-[color:var(--gv-lime)] px-2.5 py-1 text-sm font-semibold text-[color:var(--gv-forest)]"
              />

              <label className="inline-flex h-11 w-full items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 text-xs font-semibold text-[color:var(--gv-text-muted)] sm:w-auto sm:min-w-[11rem]">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortMode)}
                  aria-label="Sortierung"
                  className="w-full bg-transparent text-sm font-semibold text-[color:var(--gv-text)] outline-none"
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

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="rounded-[24px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)]/70 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                  Schnellwahl
                </span>
                {quickPickChips.map((chip) => {
                  const active = (filters.searchQuery ?? "").trim().toLowerCase() === chip.searchQuery;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          searchQuery: active ? "" : chip.searchQuery,
                        }))
                      }
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-[color:var(--gv-lime)]/40 bg-[color:var(--gv-lime)]/12 text-[color:var(--gv-lime)]"
                          : "border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/30"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3 py-2 text-xs font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40"
                  >
                    <span>{chip.label}</span>
                    <span className="text-sm">×</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-[color:var(--gv-lime)]"
                >
                  Alle zurücksetzen
                </button>
              </div>
            ) : null}
          </div>

          {(hasIssueIntent || hasQuietIntent || hasSizeIntent || hasVaultEasterEgg) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {hasIssueIntent ? (
                <div className="rounded-[24px] border border-[color:var(--gv-lime)]/20 bg-[color:var(--gv-lime)]/10 px-4 py-4 text-sm text-[color:var(--gv-text)]">
                  <p className="font-semibold">Pflanzenproblem?</p>
                  <p className="mt-1 text-[color:var(--gv-text-muted)]">
                    Starte die Analyse oder öffne den passenden Ratgeber.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={buildGrowvaultAnalyzerUrl()}
                      className="rounded-full bg-[color:var(--gv-lime)] px-3 py-1.5 text-xs font-semibold text-[color:var(--gv-forest)]"
                    >
                      Pflanzenanalyse starten
                    </Link>
                    <Link
                      href="/symptome/gelbe-blaetter"
                      className="rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-3 py-1.5 text-xs font-semibold text-[color:var(--gv-text)]"
                    >
                      Zum Ratgeber
                    </Link>
                  </div>
                </div>
              ) : null}
              {hasQuietIntent ? (
                <div className="rounded-[24px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-4 text-sm text-[color:var(--gv-text)]">
                  <p className="font-semibold">Tipp: Achte auf leise Abluft und passende Filter.</p>
                </div>
              ) : null}
              {hasSizeIntent ? (
                <div className="rounded-[24px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-4 py-4 text-sm text-[color:var(--gv-text)]">
                  <p className="font-semibold">
                    Setup-Größe erkannt: passende Produkte werden leichter vergleichbar.
                  </p>
                </div>
              ) : null}
              {hasVaultEasterEgg ? (
                <div className="rounded-[24px] border border-[color:var(--gv-lime)]/25 bg-[color:var(--gv-lime)]/10 px-4 py-4 text-sm text-[color:var(--gv-text)]">
                  <p className="font-semibold">Geheimes Setup-Signal erkannt.</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {!activeCategoryHandle && searchIntentGuidance && total > 0 ? (
        <div className="mt-6">
          <ListingGuidanceSection guidance={searchIntentGuidance} />
        </div>
      ) : null}

      <div onClick={handleSelectItem}>
        {layout === "grid" || isMobile ? (
          <DisplayProducts
            products={products}
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
            products={products}
            showManufacturer
            showGrowboxSize
            prioritizeFirstImage
          />
        )}
      </div>

      {canLoadMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void fetchProducts(products.length, true)}
            className="inline-flex h-12 items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-6 text-sm font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] disabled:opacity-60"
          >
            {loadingMore
              ? "Lädt..."
              : `Mehr laden (${Math.max(total - products.length, 0)} verbleibend)`}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="py-8 text-center text-sm font-medium text-[color:var(--gv-text-muted)]">
          Produkte werden geladen...
        </div>
      ) : null}

      {!loading && total === 0 ? (
        <div className="space-y-6">
          <EmptyState
            eyebrow="Discovery"
            title="Nichts im Vault gefunden."
            description="Versuch es mit LED, Growzelt, Abluft, Bewässerung oder Erde."
            actions={[
              {
                label: "Alle Produkte ansehen",
                href: "/products",
                tone: "primary",
              },
              {
                label: "Konfigurator starten",
                href: buildGrowvaultCustomizerUrl(),
              },
              {
                label: "Pflanzenanalyse starten",
                href: buildGrowvaultAnalyzerUrl(),
              },
              ...(Boolean(filters.searchQuery?.trim())
                ? [
                    {
                      label: "Suche löschen",
                      onClick: () =>
                        setFilters((prev) => ({
                          ...prev,
                          searchQuery: "",
                        })),
                    },
                  ]
                : []),
            ]}
          />

          <ListingGuidanceSection guidance={noResultsGuidance} />
        </div>
      ) : null}
    </div>
  );
}
