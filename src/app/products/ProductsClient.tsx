// app/products/ProductsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  Bars3BottomLeftIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { Product, ProductFilters } from "@/data/types";
import { filterProducts } from "@/lib/filterProducts";
import DisplayProducts, {
  DisplayProductsList,
} from "@/components/DisplayProducts";
import FilterDrawer from "@/components/FilterDrawer"; // <- Datei wie besprochen erstellen
import { useSearchParams } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { seoPages } from "@/lib/seoPages";

type Props = {
  initialProducts: Product[];
  headerTitle?: string;
  headerDescription?: string;
};

type SortMode = "featured" | "price_asc" | "price_desc" | "name_asc";
type CategoryFaqItem = { question: string; answer: string };

const PAGE_SIZE = 24;

export default function ProductsClient({
  initialProducts,
  headerTitle = "Unsere Produkte",
  headerDescription = "Premium Equipment für premium Ergebnisse",
}: Props) {
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get("category") ?? "";
  const manufacturerParam = searchParams?.get("manufacturer") ?? "";
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

  // Dynamische Preisgrenzen aus deinen Produkten
  const priceMaxBound = useMemo(() => {
    const prices = normalizedProducts
      .map((p) => Number(p.priceRange?.minVariantPrice?.amount ?? 0))
      .filter((n) => Number.isFinite(n));
    const max = prices.length ? Math.max(...prices) : 0;
    // runde bisschen auf, sieht nicer aus im Slider
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isMobile, setIsMobile] = useState(false);
  const lastCategoryParamRef = useRef<string>("");
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

  const filteredProducts = useMemo(() => {
    const results = filterProducts(normalizedProducts, filters);
    return [...results];
  }, [normalizedProducts, filters]);

  const sortedProducts = useMemo(() => {
    const toPrice = (product: Product) =>
      Number(product.priceRange?.minVariantPrice?.amount ?? 0);
    const indexById = new Map(
      filteredProducts.map((product, index) => [product.id, index]),
    );

    return [...filteredProducts].sort((a, b) => {
      if (sortBy === "price_asc") {
        const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
        if (stockDelta !== 0) return stockDelta;
        return toPrice(a) - toPrice(b);
      }
      if (sortBy === "price_desc") {
        const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
        if (stockDelta !== 0) return stockDelta;
        return toPrice(b) - toPrice(a);
      }
      if (sortBy === "name_asc") {
        const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
        if (stockDelta !== 0) return stockDelta;
        return a.title.localeCompare(b.title);
      }

      // Featured: out-of-stock always last, then preserve server order (pre-ranked by bestsellerScore)
      const stockDelta = Number(Boolean(b.availableForSale)) - Number(Boolean(a.availableForSale));
      if (stockDelta !== 0) return stockDelta;
      return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
    });
  }, [filteredProducts, sortBy]);

  const visibleProducts = useMemo(
    () => sortedProducts.slice(0, visibleCount),
    [sortedProducts, visibleCount]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(PAGE_SIZE);
  }, [filters, sortBy, layout, categoryParam, manufacturerParam]);


  const categoryHierarchy = useMemo(() => {
    const parents = new Map<string, string>();
    const childrenByParent = new Map<string, Map<string, string>>();
    normalizedProducts.forEach((product) => {
      product.categories?.forEach((category) => {
        if (!category.parentId) {
          parents.set(category.handle, category.title);
          return;
        }
        const parent =
          category.parent ?? parentCategoryById.get(category.parentId);
        if (!parent) return;
        parents.set(parent.handle, parent.title);
        const bucket =
          childrenByParent.get(parent.handle) ?? new Map<string, string>();
        bucket.set(category.handle, category.title);
        childrenByParent.set(parent.handle, bucket);
      });
    });
    return { parents, childrenByParent };
  }, [normalizedProducts, parentCategoryById]);

  const availableCategories = useMemo(() => {
    const children =
      categoryParam && categoryHierarchy.childrenByParent.get(categoryParam);
    if (children && children.size > 0) {
      return Array.from(children.entries()).sort((a, b) =>
        a[1].localeCompare(b[1]),
      );
    }
    return Array.from(categoryHierarchy.parents.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [categoryHierarchy, categoryParam]);

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

  const allCategoryTitlesByHandle = useMemo(() => {
    const categories = new Map<string, string>();
    normalizedProducts.forEach((p) => {
      p.categories?.forEach((c) => {
        categories.set(c.handle, c.title);
      });
    });
    return categories;
  }, [normalizedProducts]);

  const listName = useMemo(() => {
    const searchTerm = filters.searchQuery?.trim();
    if (searchTerm) return `search:${searchTerm}`;
    if (categoryParam) {
      const categoryTitle = allCategoryTitlesByHandle.get(categoryParam);
      return categoryTitle ? `category:${categoryTitle}` : `category:${categoryParam}`;
    }
    if (manufacturerParam) return `manufacturer:${manufacturerParam}`;
    return "products";
  }, [allCategoryTitlesByHandle, categoryParam, filters.searchQuery, manufacturerParam]);

  const listId = useMemo(() => {
    const searchTerm = filters.searchQuery?.trim();
    if (searchTerm) return `search:${searchTerm.toLowerCase()}`;
    if (categoryParam) return `category:${categoryParam}`;
    if (manufacturerParam) return `manufacturer:${manufacturerParam.toLowerCase()}`;
    return "products";
  }, [categoryParam, filters.searchQuery, manufacturerParam]);

  useEffect(() => {
    if (sortedProducts.length === 0) return;
    const key = `${listId}:${sortBy}:${sortedProducts.length}`;
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
      item_list_id: listId,
      item_list_name: listName,
      items,
    });
  }, [sortedProducts, listId, listName, sortBy]);

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

  useEffect(() => {
    if (!categoryParam) {
      lastCategoryParamRef.current = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters((prev) =>
        prev.categories.length === 0 ? prev : { ...prev, categories: [] },
      );
      return;
    }
    if (!allCategoryTitlesByHandle.has(categoryParam)) return;
    const didChangeParent = lastCategoryParamRef.current !== categoryParam;
    lastCategoryParamRef.current = categoryParam;
    setFilters((prev) => {
      if (!didChangeParent && prev.categories.length > 0) return prev;
      return { ...prev, categories: [categoryParam] };
    });
  }, [allCategoryTitlesByHandle, categoryParam, categoryHierarchy]);

  useEffect(() => {
    if (!manufacturerParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters((prev) =>
        prev.manufacturers.length === 0 ? prev : { ...prev, manufacturers: [] },
      );
      return;
    }
    const normalized = manufacturerParam.trim();
    if (!normalized) return;
    const parts = normalized
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setFilters((prev) => ({
      ...prev,
      manufacturers: parts,
    }));
  }, [manufacturerParam]);

  const categoryTitleByHandle = useMemo(
    () => new Map(allCategoryTitlesByHandle),
    [allCategoryTitlesByHandle],
  );

  const categoryFaq = useMemo(() => {
    if (!categoryParam) return null;
    const normalized = categoryParam.trim().toLowerCase();
    if (!normalized) return null;

    const config = seoPages.find((page) => {
      if (!page.categoryHandle) return false;
      const handles = [
        page.categoryHandle,
        ...(page.categoryHandleAliases ?? []),
      ].map((entry) => entry.toLowerCase());
      return handles.includes(normalized);
    });
    if (!config) return null;

    const title = config.title ?? categoryTitleByHandle.get(categoryParam) ?? categoryParam;
    const items: CategoryFaqItem[] =
      config.faq && config.faq.length > 0
        ? config.faq
        : [
            {
              question: `Worauf sollte ich bei ${title} achten?`,
              answer:
                "Achte auf Qualität, sinnvolle Größe/Leistung und ein Setup, das zu deinem Alltag passt. So bekommst du stabilere Ergebnisse und weniger Anpassungsaufwand.",
            },
            {
              question: `Welche Produkte sind bei ${title} besonders sinnvoll für Einsteiger?`,
              answer:
                "Starte mit bewährten Basics und erweitere erst nach Bedarf. Das reduziert Fehlkäufe und hilft dir, schneller ein funktionierendes Setup aufzubauen.",
            },
          ];

    return {
      title,
      items,
    };
  }, [categoryParam, categoryTitleByHandle]);

  const resetFilters = () => {
    setFilters({
      categories: [],
      manufacturers: [],
      priceMin: priceMinBound,
      priceMax: priceMaxBound,
      searchQuery: "",
    });
  };

  const activeChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      onRemove: () => void;
    }> = [];

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
            manufacturers: prev.manufacturers.filter(
              (item) => item !== manufacturer
            ),
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
  }, [filters, categoryTitleByHandle, priceMinBound, priceMaxBound]);

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
            <p className="smk-kicker">Kollektion</p>
            <h1 className="smk-heading mt-4 text-4xl text-[var(--smk-text)] sm:text-5xl">
              {headerTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--smk-text-muted)] sm:text-base">
              {headerDescription}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="smk-chip">{sortedProducts.length} Produkte</span>
              {manufacturerParam && (
                <span className="rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-muted)]">
                  {manufacturerParam}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--smk-text-dim)]">
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
              <div className="relative grid h-11 w-36 grid-cols-2 overflow-hidden rounded-full border border-[var(--smk-border)] bg-[rgba(255,255,255,0.94)] p-[6px] shadow-sm sm:h-12 sm:w-40">
              <span
                className={`absolute top-[5px] bottom-[5px] rounded-full bg-[linear-gradient(135deg,var(--smk-accent),var(--smk-accent-2))] transition-all duration-200 ease-out ${
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
              resultCount={sortedProducts.length}
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
            products={visibleProducts}
            cols={isMobile ? 2 : 4}
            showManufacturer
            titleLines={3}
            showGrowboxSize
            hideCartLabel={isMobile && layout === "grid"}
          />
        ) : (
          <DisplayProductsList
            products={visibleProducts}
            showManufacturer
            showGrowboxSize
          />
        )}
      </div>

      {sortedProducts.length > visibleCount && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="smk-button-secondary inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold focus-visible:ring-offset-black"
          >
            Mehr laden ({Math.max(sortedProducts.length - visibleCount, 0)} verbleibend)
          </button>
        </div>
      )}

      {sortedProducts.length === 0 && (
        <div className="py-16 text-center">
          <p className="mb-2 text-lg text-[var(--smk-text-muted)]">Keine Produkte gefunden</p>
          <p className="mb-6 text-sm text-[var(--smk-text-dim)]">
            Passe deine Auswahl an oder starte mit einer kuratierten Seite.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {Boolean(filters.searchQuery?.trim()) && (
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, searchQuery: "" }))
                }
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

      {categoryFaq && categoryFaq.items.length > 0 && (
        <div className="smk-panel mt-10 rounded-[32px] px-6 py-6 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-lg font-semibold text-[var(--smk-text)]">
              Häufige Fragen zu {categoryFaq.title}
            </h2>
            <div className="mt-4 space-y-3">
              {categoryFaq.items.map((item, index) => (
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
