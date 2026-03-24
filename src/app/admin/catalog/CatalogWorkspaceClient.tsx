"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AdminButton,
  AdminDialog,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminSelect,
} from "@/components/admin/AdminWorkspace";
import {
  CatalogBulkTray,
  CatalogErrorNotice,
  CatalogTablePanel,
  CatalogToolbar,
} from "./CatalogProductWorkspace";
import {
  CategoryManagementDrawer,
  CollectionManagementDrawer,
} from "./CatalogTaxonomyDrawers";
import {
  CatalogClientProps,
  CategoryRow,
  FILTER_PRESET_STORAGE_KEY,
  FilterPreset,
  ProductRow,
  SortKey,
  slugifyHandle,
  sortRowsByName,
} from "./catalogShared";
import {
  STOREFRONT_ASSIGNMENT_OPTIONS,
  STOREFRONT_LABELS,
  parseStorefrontAssignmentValue,
} from "@/lib/storefronts";

export default function CatalogWorkspaceClient({
  initialProducts,
  initialQuery,
  initialSortKey,
  initialSortDirection,
  totalCount: initialTotalCount,
  currentPage,
  totalPages,
  pageSize,
  initialCategories,
  initialCollections,
  initialSuppliers,
  initialFilters,
}: CatalogClientProps) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    initialSortDirection,
  );
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createHandle, setCreateHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [createSupplierId, setCreateSupplierId] = useState("");
  const [createLeadTimeDays, setCreateLeadTimeDays] = useState("");
  const [createError, setCreateError] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [collections, setCollections] = useState<CategoryRow[]>(
    initialCollections,
  );
  const [suppliers] = useState(initialSuppliers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: "product" | "category" | "collection";
    label?: string;
  } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ProductRow["status"] | "">("");
  const [bulkPriceMode, setBulkPriceMode] = useState<"percent" | "fixed">(
    "percent",
  );
  const [bulkPriceDirection, setBulkPriceDirection] = useState<
    "increase" | "decrease"
  >("increase");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkLowStock, setBulkLowStock] = useState("");
  const [bulkTagAdd, setBulkTagAdd] = useState("");
  const [bulkTagRemove, setBulkTagRemove] = useState("");
  const [bulkProductGroup, setBulkProductGroup] = useState("");
  const [bulkProductGroupClear, setBulkProductGroupClear] = useState(false);
  const [bulkCategoryAction, setBulkCategoryAction] = useState<
    "add" | "remove"
  >("add");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSupplierId, setBulkSupplierId] = useState("");
  const [bulkStorefronts, setBulkStorefronts] = useState("");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [storefrontFilter, setStorefrontFilter] = useState(initialFilters.storefront);
  const [supplierFilter, setSupplierFilter] = useState(initialFilters.supplierId);
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.categoryId);
  const [collectionFilter, setCollectionFilter] = useState(
    initialFilters.collectionId,
  );
  const [managementDrawer, setManagementDrawer] = useState<
    "category" | "collection" | null
  >(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(initialCollections[0]?.id ?? null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    handle: "",
    description: "",
    parentId: "",
    storefronts: "MAIN",
  });
  const [newCollection, setNewCollection] = useState({
    name: "",
    handle: "",
    description: "",
  });
  const [createStorefronts, setCreateStorefronts] = useState("MAIN");
  const lastInitialQueryRef = useRef(initialQuery);
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTER_PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const hydrated = parsed
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as Partial<FilterPreset>;
          if (
            typeof candidate.name !== "string" ||
            typeof candidate.query !== "string" ||
            typeof candidate.storefront !== "string" ||
            typeof candidate.supplierId !== "string" ||
            typeof candidate.categoryId !== "string" ||
            typeof candidate.collectionId !== "string" ||
            (candidate.sortKey !== "title" &&
              candidate.sortKey !== "status" &&
              candidate.sortKey !== "variants" &&
              candidate.sortKey !== "category" &&
              candidate.sortKey !== "updatedAt") ||
            (candidate.sortDirection !== "asc" &&
              candidate.sortDirection !== "desc")
          ) {
            return null;
          }
          return {
            name: candidate.name,
            query: candidate.query,
            sortKey: candidate.sortKey,
            sortDirection: candidate.sortDirection,
            storefront: candidate.storefront,
            supplierId: candidate.supplierId,
            categoryId: candidate.categoryId,
            collectionId: candidate.collectionId,
          } satisfies FilterPreset;
        })
        .filter((item): item is FilterPreset => item !== null)
        .slice(0, 8);
      setFilterPresets(hydrated);
    } catch {
      window.localStorage.removeItem(FILTER_PRESET_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      FILTER_PRESET_STORAGE_KEY,
      JSON.stringify(filterPresets),
    );
  }, [filterPresets]);

  useEffect(() => {
    setProducts(initialProducts);
    setTotalCount(initialTotalCount);
    setSelectedIds([]);
  }, [currentPage, initialProducts, initialTotalCount]);

  useEffect(() => {
    setSortKey(initialSortKey);
    setSortDirection(initialSortDirection);
  }, [initialSortDirection, initialSortKey]);

  useEffect(() => {
    const normalized = initialQuery ?? "";
    const previous = lastInitialQueryRef.current ?? "";
    if (normalized === previous) return;
    if (searchTerm.trim() === "" || searchTerm.trim() === previous.trim()) {
      setSearchTerm(normalized);
    }
    lastInitialQueryRef.current = normalized;
  }, [initialQuery, searchTerm]);

  useEffect(() => {
    setStorefrontFilter(initialFilters.storefront);
    setSupplierFilter(initialFilters.supplierId);
    setCategoryFilter(initialFilters.categoryId);
    setCollectionFilter(initialFilters.collectionId);
  }, [
    initialFilters.categoryId,
    initialFilters.collectionId,
    initialFilters.storefront,
    initialFilters.supplierId,
  ]);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    setCollections(initialCollections);
  }, [initialCollections]);

  useEffect(() => {
    if (!createSupplierId) {
      setCreateLeadTimeDays("");
      return;
    }
    const selectedSupplier = suppliers.find(
      (supplier) => supplier.id === createSupplierId,
    );
    if (!selectedSupplier) return;
    setCreateLeadTimeDays(
      selectedSupplier.leadTimeDays === null
        ? ""
        : String(selectedSupplier.leadTimeDays),
    );
  }, [createSupplierId, suppliers]);

  useEffect(() => {
    if (!categories.length) {
      setSelectedCategoryId(null);
      return;
    }
    if (
      selectedCategoryId &&
      categories.some((category) => category.id === selectedCategoryId)
    ) {
      return;
    }
    setSelectedCategoryId(categories[0]?.id ?? null);
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!collections.length) {
      setSelectedCollectionId(null);
      return;
    }
    if (
      selectedCollectionId &&
      collections.some((collection) => collection.id === selectedCollectionId)
    ) {
      return;
    }
    setSelectedCollectionId(collections[0]?.id ?? null);
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    const current = new URLSearchParams(searchParamsString).get("q") ?? "";
    if (trimmed === current) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParamsString);
      if (trimmed) {
        params.set("q", trimmed);
        params.set("page", "1");
      } else {
        params.delete("q");
        params.delete("page");
      }
      const queryString = params.toString();
      router.replace(
        queryString ? `/admin/catalog?${queryString}` : "/admin/catalog",
        { scroll: false },
      );
    }, 300);
    return () => clearTimeout(handle);
  }, [router, searchParamsString, searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const currentSort = params.get("sort") ?? "updatedAt";
    const currentDir = params.get("dir") ?? "desc";
    if (currentSort === sortKey && currentDir === sortDirection) return;
    params.set("sort", sortKey);
    params.set("dir", sortDirection);
    params.set("page", "1");
    const queryString = params.toString();
    router.replace(
      queryString ? `/admin/catalog?${queryString}` : "/admin/catalog",
      { scroll: false },
    );
  }, [router, searchParamsString, sortDirection, sortKey]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const currentStorefront = params.get("storefront") ?? "";
    const currentSupplier = params.get("supplier") ?? "";
    const currentCategory = params.get("category") ?? "";
    const currentCollection = params.get("collection") ?? "";
    if (
      currentStorefront === storefrontFilter &&
      currentSupplier === supplierFilter &&
      currentCategory === categoryFilter &&
      currentCollection === collectionFilter
    ) {
      return;
    }

    if (storefrontFilter) params.set("storefront", storefrontFilter);
    else params.delete("storefront");
    if (supplierFilter) params.set("supplier", supplierFilter);
    else params.delete("supplier");
    if (categoryFilter) params.set("category", categoryFilter);
    else params.delete("category");
    if (collectionFilter) params.set("collection", collectionFilter);
    else params.delete("collection");

    params.set("page", "1");
    const queryString = params.toString();
    router.replace(
      queryString ? `/admin/catalog?${queryString}` : "/admin/catalog",
      { scroll: false },
    );
  }, [
    categoryFilter,
    collectionFilter,
    router,
    searchParamsString,
    storefrontFilter,
    supplierFilter,
  ]);

  const groupedCategories = useMemo(() => {
    const parents = sortRowsByName(categories.filter((item) => !item.parentId));
    const childrenByParent = new Map<string, CategoryRow[]>();
    sortRowsByName(categories.filter((item) => item.parentId)).forEach((child) => {
      const parentId = child.parentId as string;
      const list = childrenByParent.get(parentId) ?? [];
      list.push(child);
      childrenByParent.set(parentId, list);
    });
    return { parents, childrenByParent };
  }, [categories]);

  const statusCounts = useMemo(
    () => ({
      total: totalCount,
      active: products.filter((product) => product.status === "ACTIVE").length,
      draft: products.filter((product) => product.status === "DRAFT").length,
      archived: products.filter((product) => product.status === "ARCHIVED").length,
    }),
    [products, totalCount],
  );

  const inventoryCounts = useMemo(() => {
    const outOfStock = products.filter((product) => product.outOfStock).length;
    const low = products.filter(
      (product) =>
        !product.outOfStock &&
        product.availableInventory <= Math.max(2, product._count.variants),
    ).length;
    const healthy = Math.max(0, products.length - outOfStock - low);
    return { outOfStock, low, healthy };
  }, [products]);

  const supplierCoverage = useMemo(
    () =>
      new Set(
        products
          .map((product) => product.supplierId)
          .filter((supplierId): supplierId is string => Boolean(supplierId)),
      ).size,
    [products],
  );
  const performanceSummary = useMemo(() => {
    const revenue30dCents = products.reduce(
      (sum, product) => sum + (product.insights?.revenue30dCents ?? 0),
      0,
    );
    const trendingCount = products.filter(
      (product) => product.insights?.trendDirection === "trending",
    ).length;
    const weakConversionCount = products.filter((product) => {
      const views = product.insights?.views30d ?? 0;
      const conversion = product.insights?.conversionRate30d ?? 0;
      return views >= 20 && conversion < 0.02;
    }).length;
    const lowCoverCount = products.filter((product) => {
      const coverDays = product.insights?.stockCoverDays;
      return typeof coverDays === "number" && coverDays > 0 && coverDays < 14;
    }).length;
    return { revenue30dCents, trendingCount, weakConversionCount, lowCoverCount };
  }, [products]);

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;
  const selectedCollection =
    collections.find((collection) => collection.id === selectedCollectionId) ??
    null;
  const selectedCategoryChildren = selectedCategory
    ? groupedCategories.childrenByParent.get(selectedCategory.id) ?? []
    : [];

  const activeFilterLabels = [
    storefrontFilter
      ? `Storefront: ${
          STOREFRONT_LABELS[storefrontFilter as keyof typeof STOREFRONT_LABELS]
        }`
      : null,
    supplierFilter
      ? `Supplier: ${
          suppliers.find((supplier) => supplier.id === supplierFilter)?.name ??
          "Unknown"
        }`
      : null,
    categoryFilter
      ? `Category: ${
          categories.find((category) => category.id === categoryFilter)?.name ??
          "Unknown"
        }`
      : null,
    collectionFilter
      ? `Collection: ${
          collections.find((collection) => collection.id === collectionFilter)?.name ??
          "Unknown"
        }`
      : null,
  ].filter((value): value is string => Boolean(value));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "updatedAt" ? "desc" : "asc");
  };

  const applyFilterPreset = (preset: FilterPreset) => {
    setSearchTerm(preset.query);
    setSortKey(preset.sortKey);
    setSortDirection(preset.sortDirection);
    setStorefrontFilter(preset.storefront);
    setSupplierFilter(preset.supplierId);
    setCategoryFilter(preset.categoryId);
    setCollectionFilter(preset.collectionId);

    const params = new URLSearchParams(searchParamsString);
    if (preset.query) params.set("q", preset.query);
    else params.delete("q");
    params.set("sort", preset.sortKey);
    params.set("dir", preset.sortDirection);
    if (preset.storefront) params.set("storefront", preset.storefront);
    else params.delete("storefront");
    if (preset.supplierId) params.set("supplier", preset.supplierId);
    else params.delete("supplier");
    if (preset.categoryId) params.set("category", preset.categoryId);
    else params.delete("category");
    if (preset.collectionId) params.set("collection", preset.collectionId);
    else params.delete("collection");
    params.delete("page");

    const queryString = params.toString();
    router.replace(
      queryString ? `/admin/catalog?${queryString}` : "/admin/catalog",
      { scroll: false },
    );
  };

  const resetCatalogView = () => {
    setSearchTerm("");
    setSortKey("updatedAt");
    setSortDirection("desc");
    setStorefrontFilter("");
    setSupplierFilter("");
    setCategoryFilter("");
    setCollectionFilter("");

    const params = new URLSearchParams(searchParamsString);
    params.delete("q");
    params.delete("page");
    params.delete("storefront");
    params.delete("supplier");
    params.delete("category");
    params.delete("collection");
    params.set("sort", "updatedAt");
    params.set("dir", "desc");
    const queryString = params.toString();
    router.replace(
      queryString ? `/admin/catalog?${queryString}` : "/admin/catalog",
      { scroll: false },
    );
  };

  const saveCurrentViewPreset = () => {
    const normalizedName = presetName.trim();
    if (!normalizedName) {
      setError("Enter a preset name before saving the current catalog view.");
      return;
    }

    setError("");
    setFilterPresets((previous) =>
      [
        {
          name: normalizedName,
          query: searchTerm.trim(),
          sortKey,
          sortDirection,
          storefront: storefrontFilter,
          supplierId: supplierFilter,
          categoryId: categoryFilter,
          collectionId: collectionFilter,
        },
        ...previous.filter(
          (item) =>
            item.name.localeCompare(normalizedName, undefined, {
              sensitivity: "accent",
            }) !== 0,
        ),
      ].slice(0, 8),
    );
    setPresetName("");
  };

  const removeFilterPreset = (name: string) => {
    setFilterPresets((previous) =>
      previous.filter((item) => item.name !== name),
    );
  };

  const createProduct = async () => {
    const title = createTitle.trim();
    if (!title) {
      setCreateError("Title is required");
      return;
    }
    const normalizedHandle =
      handleTouched && createHandle.trim() ? createHandle.trim() : "";
    const leadTimeValue = createLeadTimeDays.trim();
    let leadTimeDays: number | null = null;
    if (leadTimeValue) {
      const parsed = Number(leadTimeValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setCreateError("Lead time must be a non-negative number");
        return;
      }
      leadTimeDays = Math.floor(parsed);
    }

    setSaving(true);
    setCreateError("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          handle: normalizedHandle || undefined,
          status: "DRAFT",
          storefronts: parseStorefrontAssignmentValue(createStorefronts),
          supplierId: createSupplierId || null,
          leadTimeDays,
        }),
      });
      const data = (await response.json()) as {
        product?: ProductRow;
        error?: string;
      };
      if (!response.ok || !data.product) {
        setCreateError(data.error ?? "Create failed");
        return;
      }
      const createdProduct: ProductRow = {
        ...data.product,
        outOfStock: data.product.outOfStock ?? false,
      };
      setProducts((previous) =>
        [createdProduct, ...previous].slice(0, pageSize),
      );
      setTotalCount((previous) => previous + 1);
      setCreateOpen(false);
      setCreateStorefronts("MAIN");
    } catch {
      setCreateError("Create failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string, adminPassword: string) => {
    setError("");
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Delete failed");
        return;
      }
      setProducts((previous) => previous.filter((item) => item.id !== id));
      setSelectedIds((previous) => previous.filter((item) => item !== id));
      setTotalCount((previous) => Math.max(0, previous - 1));
    } catch {
      setError("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const duplicateProduct = async (id: string) => {
    setError("");
    setDuplicatingId(id);
    try {
      const response = await fetch(`/api/admin/products/${id}/duplicate`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        product?: ProductRow;
      };
      if (!response.ok || !data.product) {
        setError(data.error ?? "Duplicate failed");
        return;
      }
      const duplicatedProduct: ProductRow = {
        ...data.product,
        outOfStock: data.product.outOfStock ?? false,
      };
      setProducts((previous) =>
        [duplicatedProduct, ...previous].slice(0, pageSize),
      );
      setTotalCount((previous) => previous + 1);
    } catch {
      setError("Duplicate failed");
    } finally {
      setDuplicatingId(null);
    }
  };

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(searchParamsString);
    const trimmed = searchTerm.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    const queryString = params.toString();
    return queryString ? `/admin/catalog?${queryString}` : "/admin/catalog";
  };

  const applyBulkEdit = async () => {
    if (!selectedIds.length) {
      setError("Select products to update");
      return;
    }
    setError("");
    setBulkSaving(true);

    const payload: {
      productIds: string[];
      status?: ProductRow["status"];
      priceAdjust?: {
        type: "percent" | "fixed";
        direction: "increase" | "decrease";
        value: number;
      };
      lowStockThreshold?: number;
      tags?: { add?: string[]; remove?: string[] };
      category?: { action: "add" | "remove"; categoryId: string };
      supplierId?: string | null;
      productGroup?: string | null;
      storefronts?: ("MAIN" | "GROW")[];
    } = { productIds: selectedIds };

    if (bulkStatus) payload.status = bulkStatus;
    const priceValue = Number(bulkPriceValue);
    if (Number.isFinite(priceValue) && priceValue > 0) {
      payload.priceAdjust = {
        type: bulkPriceMode,
        direction: bulkPriceDirection,
        value: priceValue,
      };
    }
    const lowStockValue = Number(bulkLowStock);
    if (Number.isFinite(lowStockValue) && lowStockValue >= 0) {
      payload.lowStockThreshold = lowStockValue;
    }
    const addTags = bulkTagAdd
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const removeTags = bulkTagRemove
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (addTags.length || removeTags.length) {
      payload.tags = {
        add: addTags.length ? addTags : undefined,
        remove: removeTags.length ? removeTags : undefined,
      };
    }
    if (bulkCategoryId) {
      payload.category = {
        action: bulkCategoryAction,
        categoryId: bulkCategoryId,
      };
    }
    if (bulkSupplierId) {
      payload.supplierId =
        bulkSupplierId === "__clear__" ? null : bulkSupplierId;
    }
    if (bulkStorefronts) {
      payload.storefronts = parseStorefrontAssignmentValue(bulkStorefronts);
    }
    if (bulkProductGroupClear) payload.productGroup = null;
    else if (bulkProductGroup.trim()) payload.productGroup = bulkProductGroup.trim();

    try {
      const response = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Bulk update failed");
        return;
      }
      setSelectedIds([]);
      setBulkOpen(false);
      setBulkStatus("");
      setBulkPriceValue("");
      setBulkLowStock("");
      setBulkTagAdd("");
      setBulkTagRemove("");
      setBulkCategoryId("");
      setBulkSupplierId("");
      setBulkStorefronts("");
      setBulkProductGroup("");
      setBulkProductGroupClear(false);
    } catch {
      setError("Bulk update failed");
    } finally {
      setBulkSaving(false);
    }
  };

  const upsertLabel = async (
    item: CategoryRow,
    type: "category" | "collection",
  ) => {
    setError("");
    const url =
      type === "category"
        ? `/api/admin/categories/${item.id}`
        : `/api/admin/collections/${item.id}`;
    const payload =
      type === "category"
        ? {
            name: item.name,
            handle: item.handle,
            description: item.description,
            parentId: item.parentId ?? null,
            storefronts: item.storefronts,
          }
        : {
            name: item.name,
            handle: item.handle,
            description: item.description,
          };
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Update failed");
    }
  };

  const deleteLabel = async (
    id: string,
    type: "category" | "collection",
    adminPassword: string,
  ) => {
    setError("");
    const url =
      type === "category"
        ? `/api/admin/categories/${id}`
        : `/api/admin/collections/${id}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPassword }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    if (type === "category") {
      setCategories((previous) => previous.filter((item) => item.id !== id));
      setSelectedCategoryId((previous) => (previous === id ? null : previous));
    } else {
      setCollections((previous) => previous.filter((item) => item.id !== id));
      setSelectedCollectionId((previous) => (previous === id ? null : previous));
    }
  };

  const createLabel = async (
    payload: {
      name: string;
      handle: string;
      description?: string;
      parentId?: string | null;
      storefronts?: string;
    },
    type: "category" | "collection",
  ) => {
    setError("");
    const url =
      type === "category" ? "/api/admin/categories" : "/api/admin/collections";
    const body =
      type === "category"
        ? {
            ...payload,
            storefronts: payload.storefronts
              ? parseStorefrontAssignmentValue(payload.storefronts)
              : undefined,
          }
        : {
            name: payload.name,
            handle: payload.handle,
            description: payload.description,
          };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      error?: string;
      category?: CategoryRow;
      collection?: CategoryRow;
    };
    if (!response.ok) {
      setError(data.error ?? "Create failed");
      return null;
    }
    return type === "category" ? data.category ?? null : data.collection ?? null;
  };

  return (
    <div className="space-y-6 pb-36">
      <AdminPageIntro
        eyebrow="Admin / Catalog"
        title="Commerce catalog"
        description="A quieter, more product-first catalog view with restrained color cues for state and stock, faster scanning, and clearer access to each product editor."
        actions={
          <>
            <Link
              href="/admin/catalog"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              Refresh
            </Link>
            <AdminButton
              type="button"
              tone="secondary"
              onClick={() => setManagementDrawer("category")}
            >
              Categories
            </AdminButton>
            <AdminButton
              type="button"
              tone="secondary"
              onClick={() => setManagementDrawer("collection")}
            >
              Collections
            </AdminButton>
            <AdminButton type="button" onClick={() => setCreateOpen(true)}>
              Create product
            </AdminButton>
          </>
        }
        metrics={
          <div className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.45fr)]">
            <AdminMetricCard
              label="Products"
              value={String(totalCount)}
              detail={`${products.length} loaded on this page`}
            />
            <AdminMetricCard
              label="30d Revenue"
              value={new Intl.NumberFormat("de-DE", {
                style: "currency",
                currency: "EUR",
              }).format(performanceSummary.revenue30dCents / 100)}
              detail="Revenue represented by the visible catalog slice"
            />
            <AdminMetricCard
              label="Trending"
              value={String(performanceSummary.trendingCount)}
              detail="Products with accelerating 7-day demand"
            />
            <AdminMetricCard
              label="Weak CVR"
              value={String(performanceSummary.weakConversionCount)}
              detail="High-view products converting below 2%"
            />
            <div className="rounded-2xl border border-white/10 bg-[#0b1016] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Merchandising Focus
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    This view now combines product maintenance with demand, conversion, margin, and
                    stock pressure signals on the same row.
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>{supplierCoverage} suppliers live</div>
                  <div>{performanceSummary.lowCoverCount} low-cover products</div>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <SignalBar
                  label="Status distribution"
                  total={products.length}
                  segments={[
                    { count: statusCounts.active, className: "bg-cyan-400" },
                    { count: statusCounts.draft, className: "bg-amber-400" },
                    { count: statusCounts.archived, className: "bg-slate-500" },
                  ]}
                />
                <SignalBar
                  label="Inventory health"
                  total={products.length}
                  rightLabel={`${inventoryCounts.healthy} healthy`}
                  segments={[
                    { count: inventoryCounts.healthy, className: "bg-emerald-400" },
                    { count: inventoryCounts.low, className: "bg-amber-400" },
                    { count: inventoryCounts.outOfStock, className: "bg-red-400" },
                  ]}
                />
              </div>
            </div>
          </div>
        }
      />

      <CatalogErrorNotice error={error} />

      <CatalogTablePanel
        products={products}
        totalCount={totalCount}
        currentPage={currentPage}
        totalPages={totalPages}
        selectedIds={selectedIds}
        sortKey={sortKey}
        sortDirection={sortDirection}
        controls={
          <CatalogToolbar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            storefrontFilter={storefrontFilter}
            onStorefrontFilterChange={setStorefrontFilter}
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            collectionFilter={collectionFilter}
            onCollectionFilterChange={setCollectionFilter}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortKeyChange={handleSort}
            onSortDirectionToggle={() =>
              setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"))
            }
            suppliers={suppliers}
            categories={categories}
            collections={collections}
            presetName={presetName}
            onPresetNameChange={setPresetName}
            onSavePreset={saveCurrentViewPreset}
            filterPresets={filterPresets}
            onApplyPreset={applyFilterPreset}
            onRemovePreset={removeFilterPreset}
            onResetView={resetCatalogView}
            onOpenCategoryDrawer={() => setManagementDrawer("category")}
            activeFilterLabels={activeFilterLabels}
          />
        }
        statusCounts={statusCounts}
        inventoryCounts={inventoryCounts}
        onToggleSelected={(id) =>
          setSelectedIds((previous) =>
            previous.includes(id)
              ? previous.filter((item) => item !== id)
              : [...previous, id],
          )
        }
        onToggleSelectAll={() =>
          setSelectedIds(
            selectedIds.length === products.length
              ? []
              : products.map((product) => product.id),
          )
        }
        onSort={handleSort}
        buildPageHref={buildPageHref}
        onDuplicate={duplicateProduct}
        onPrepareDelete={(id, label) => {
          setDeletePassword("");
          setDeletePasswordError("");
          setDeleteTarget({ id, type: "product", label });
        }}
        duplicatingId={duplicatingId}
        deletingId={deletingId}
        searchTerm={searchTerm}
      />

      <CatalogBulkTray
        selectedIds={selectedIds}
        bulkOpen={bulkOpen}
        onBulkOpenToggle={() => setBulkOpen((previous) => !previous)}
        onClearSelection={() => setSelectedIds([])}
        onApply={applyBulkEdit}
        bulkSaving={bulkSaving}
        bulkStatus={bulkStatus}
        onBulkStatusChange={setBulkStatus}
        bulkPriceDirection={bulkPriceDirection}
        onBulkPriceDirectionChange={setBulkPriceDirection}
        bulkPriceMode={bulkPriceMode}
        onBulkPriceModeChange={setBulkPriceMode}
        bulkPriceValue={bulkPriceValue}
        onBulkPriceValueChange={setBulkPriceValue}
        bulkLowStock={bulkLowStock}
        onBulkLowStockChange={setBulkLowStock}
        bulkSupplierId={bulkSupplierId}
        onBulkSupplierIdChange={setBulkSupplierId}
        suppliers={suppliers}
        bulkStorefronts={bulkStorefronts}
        onBulkStorefrontsChange={setBulkStorefronts}
        bulkCategoryAction={bulkCategoryAction}
        onBulkCategoryActionChange={setBulkCategoryAction}
        bulkCategoryId={bulkCategoryId}
        onBulkCategoryIdChange={setBulkCategoryId}
        categories={categories}
        bulkProductGroup={bulkProductGroup}
        onBulkProductGroupChange={setBulkProductGroup}
        bulkProductGroupClear={bulkProductGroupClear}
        onBulkProductGroupClearChange={(checked) => {
          setBulkProductGroupClear(checked);
          if (checked) setBulkProductGroup("");
        }}
        bulkTagAdd={bulkTagAdd}
        onBulkTagAddChange={setBulkTagAdd}
        bulkTagRemove={bulkTagRemove}
        onBulkTagRemoveChange={setBulkTagRemove}
      />

      <CategoryManagementDrawer
        open={managementDrawer === "category"}
        categories={categories}
        parents={groupedCategories.parents}
        childrenByParent={groupedCategories.childrenByParent}
        selectedCategoryId={selectedCategoryId}
        selectedCategory={selectedCategory}
        selectedCategoryChildren={selectedCategoryChildren}
        newCategory={newCategory}
        onClose={() => setManagementDrawer(null)}
        onSelectCategory={setSelectedCategoryId}
        onNewCategoryChange={(value) =>
          setNewCategory((previous) => ({ ...previous, ...value }))
        }
        onCreateCategory={async () => {
          const created = await createLabel(newCategory, "category");
          if (!created) return;
          setCategories((previous) => sortRowsByName([...previous, created]));
          setSelectedCategoryId(created.id);
          setNewCategory({
            name: "",
            handle: "",
            description: "",
            parentId: "",
            storefronts: "MAIN",
          });
        }}
        onUpdateCategory={(id, value) =>
          setCategories((previous) =>
            previous.map((category) =>
              category.id === id ? { ...category, ...value } : category,
            ),
          )
        }
        onSaveCategory={() =>
          selectedCategory ? void upsertLabel(selectedCategory, "category") : undefined
        }
        onPrepareDeleteCategory={() => {
          if (!selectedCategory) return;
          setDeletePassword("");
          setDeletePasswordError("");
          setDeleteTarget({
            id: selectedCategory.id,
            type: "category",
            label: selectedCategory.name,
          });
        }}
      />

      <CollectionManagementDrawer
        open={managementDrawer === "collection"}
        collections={sortRowsByName(collections)}
        selectedCollectionId={selectedCollectionId}
        selectedCollection={selectedCollection}
        newCollection={newCollection}
        onClose={() => setManagementDrawer(null)}
        onSelectCollection={setSelectedCollectionId}
        onNewCollectionChange={(value) =>
          setNewCollection((previous) => ({ ...previous, ...value }))
        }
        onCreateCollection={async () => {
          const created = await createLabel(newCollection, "collection");
          if (!created) return;
          setCollections((previous) => sortRowsByName([...previous, created]));
          setSelectedCollectionId(created.id);
          setNewCollection({ name: "", handle: "", description: "" });
        }}
        onUpdateCollection={(id, value) =>
          setCollections((previous) =>
            previous.map((collection) =>
              collection.id === id ? { ...collection, ...value } : collection,
            ),
          )
        }
        onSaveCollection={() =>
          selectedCollection
            ? void upsertLabel(selectedCollection, "collection")
            : undefined
        }
        onPrepareDeleteCollection={() => {
          if (!selectedCollection) return;
          setDeletePassword("");
          setDeletePasswordError("");
          setDeleteTarget({
            id: selectedCollection.id,
            type: "collection",
            label: selectedCollection.name,
          });
        }}
      />

      <AdminDialog
        open={createOpen}
        title="Create product"
        description="Create a draft product without leaving the workspace."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <AdminButton type="button" tone="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="button" onClick={() => void createProduct()} disabled={saving}>
              {saving ? "Creating..." : "Create product"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Title">
            <AdminInput
              type="text"
              value={createTitle}
              onChange={(event) => {
                const nextTitle = event.target.value;
                setCreateTitle(nextTitle);
                if (!handleTouched) {
                  setCreateHandle(slugifyHandle(nextTitle));
                }
              }}
              placeholder="Product title"
            />
          </AdminField>
          <AdminField label="Handle">
            <AdminInput
              type="text"
              value={createHandle}
              onChange={(event) => {
                setHandleTouched(true);
                setCreateHandle(event.target.value);
              }}
              placeholder="auto-generated-from-title"
            />
          </AdminField>
          <div className="grid gap-4 md:grid-cols-3">
            <AdminField label="Storefront visibility">
              <AdminSelect
                value={createStorefronts}
                onChange={(event) => setCreateStorefronts(event.target.value)}
              >
                {STOREFRONT_ASSIGNMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Supplier">
              <AdminSelect
                value={createSupplierId}
                onChange={(event) => setCreateSupplierId(event.target.value)}
              >
                <option value="">No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Lead time (days)">
              <AdminInput
                type="number"
                min="0"
                step="1"
                value={createLeadTimeDays}
                onChange={(event) => setCreateLeadTimeDays(event.target.value)}
                placeholder="Optional lead time"
              />
            </AdminField>
          </div>
          {createError ? <AdminNotice tone="error">{createError}</AdminNotice> : null}
        </div>
      </AdminDialog>

      <AdminDialog
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.type === "product"
            ? "Delete product?"
            : deleteTarget?.type === "category"
            ? "Delete category?"
            : "Delete collection?"
        }
        description="This action is permanent. Confirm with the admin password to proceed."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <AdminButton type="button" tone="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              type="button"
              tone="danger"
              onClick={async () => {
                const adminPassword = deletePassword.trim();
                if (!adminPassword) {
                  setDeletePasswordError("Enter the admin password.");
                  return;
                }
                const target = deleteTarget;
                setDeleteTarget(null);
                setDeletePassword("");
                setDeletePasswordError("");
                if (!target) return;
                if (target.type === "product") {
                  await deleteProduct(target.id, adminPassword);
                  return;
                }
                await deleteLabel(target.id, target.type, adminPassword);
              }}
            >
              Delete
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {deleteTarget?.label ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              {deleteTarget.label}
            </div>
          ) : null}
          <AdminField label="Admin password">
            <AdminInput
              type="password"
              value={deletePassword}
              onChange={(event) => {
                setDeletePassword(event.target.value);
                if (deletePasswordError) {
                  setDeletePasswordError("");
                }
              }}
              placeholder="Enter password"
            />
          </AdminField>
          {deletePasswordError ? (
            <AdminNotice tone="error">{deletePasswordError}</AdminNotice>
          ) : null}
        </div>
      </AdminDialog>
    </div>
  );
}

function SignalBar({
  label,
  total,
  segments,
  rightLabel,
}: {
  label: string;
  total: number;
  segments: { count: number; className: string }[];
  rightLabel?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{rightLabel ?? `${total} items`}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
        {segments.map((segment, index) => (
          <div
            key={`${segment.className}-${index}`}
            className={`${segment.className} transition-[width]`}
            style={{ width: `${total ? (segment.count / total) * 100 : 0}%` }}
          />
        ))}
      </div>
    </div>
  );
}
