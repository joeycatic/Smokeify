"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DocumentDuplicateIcon, TrashIcon } from "@heroicons/react/24/outline";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import AdminBackButton from "@/components/admin/AdminBackButton";

type ProductRow = {
  id: string;
  title: string;
  handle: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  updatedAt: string;
  sellerName?: string | null;
  sellerUrl?: string | null;
  _count: { variants: number; images: number };
  outOfStock: boolean;
  mainCategory?: { id: string; name: string; handle: string } | null;
};

type CategoryRow = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId?: string | null;
};

type SupplierRow = {
  id: string;
  name: string;
  leadTimeDays: number | null;
};

type Props = {
  initialProducts: ProductRow[];
  initialQuery: string;
  initialSortKey: SortKey;
  initialSortDirection: "asc" | "desc";
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  initialCategories: CategoryRow[];
  initialCollections: CategoryRow[];
  initialSuppliers: SupplierRow[];
};

const STATUS_OPTIONS: ProductRow["status"][] = ["DRAFT", "ACTIVE", "ARCHIVED"];
type SortKey = "title" | "status" | "variants" | "category" | "updatedAt";

const slugifyHandle = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function AdminCatalogClient({
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
}: Props) {
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
  const [createError, setCreateError] = useState("");
  const [categories, setCategories] =
    useState<CategoryRow[]>(initialCategories);
  const [collections, setCollections] =
    useState<CategoryRow[]>(initialCollections);
  const [suppliers] = useState<SupplierRow[]>(initialSuppliers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [createSupplierId, setCreateSupplierId] = useState("");
  const [createLeadTimeDays, setCreateLeadTimeDays] = useState("");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState(
    () => new Set<string>(),
  );
  const lastInitialQueryRef = useRef(initialQuery);
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    setProducts(initialProducts);
    setTotalCount(initialTotalCount);
    setSelectedIds([]);
  }, [initialProducts, initialTotalCount, currentPage]);

  useEffect(() => {
    setSortKey(initialSortKey);
    setSortDirection(initialSortDirection);
  }, [initialSortDirection, initialSortKey]);

  useEffect(() => {
    const normalized = initialQuery ?? "";
    const previous = lastInitialQueryRef.current ?? "";
    if (normalized === previous) return;
    if (
      searchTerm.trim() === "" ||
      searchTerm.trim() === previous.trim()
    ) {
      setSearchTerm(normalized);
    }
    lastInitialQueryRef.current = normalized;
  }, [initialQuery, searchTerm]);

  const groupedCategories = useMemo(() => {
    const parents = categories.filter((item) => !item.parentId);
    const childrenByParent = new Map<string, CategoryRow[]>();
    categories
      .filter((item) => item.parentId)
      .forEach((child) => {
        const parentId = child.parentId as string;
        const list = childrenByParent.get(parentId) ?? [];
        list.push(child);
        childrenByParent.set(parentId, list);
      });
    return { parents, childrenByParent };
  }, [categories]);

  useEffect(() => {
    if (!createSupplierId) {
      setCreateLeadTimeDays("");
      return;
    }
    const selected = suppliers.find(
      (supplier) => supplier.id === createSupplierId,
    );
    if (!selected) return;
    setCreateLeadTimeDays(
      selected.leadTimeDays === null ? "" : String(selected.leadTimeDays),
    );
  }, [createSupplierId, suppliers]);

  const visibleProducts = products;

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const renderSortArrow = (key: SortKey) => {
    if (sortKey !== key) {
      return (
        <svg
          viewBox="0 0 20 20"
          className="h-3 w-3 text-emerald-700/40"
          aria-hidden="true"
        >
          <path
            d="M6 8l4-4 4 4M6 12l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    const activeArrowClass = "h-3 w-3 text-amber-600";

    return sortDirection === "asc" ? (
      <svg viewBox="0 0 20 20" className={activeArrowClass} aria-hidden="true">
        <path
          d="M6 12l4-4 4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg viewBox="0 0 20 20" className={activeArrowClass} aria-hidden="true">
        <path
          d="M6 8l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const createProduct = async (productTitle: string, handle?: string) => {
    const title = productTitle.trim();
    if (!title) {
      setCreateError("Title is required");
      return;
    }
    const normalizedHandle =
      handleTouched && handle?.trim() ? handle.trim() : "";
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
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          handle: normalizedHandle || undefined,
          status: "DRAFT",
          supplierId: createSupplierId || null,
          leadTimeDays,
        }),
      });
      const data = (await res.json()) as {
        product?: ProductRow;
        error?: string;
      };
      if (!res.ok || !data.product) {
        const errorMessage = data.error ?? "Create failed";
        setCreateError(errorMessage);
        return;
      }
      const created = data.product
        ? { ...data.product, outOfStock: data.product.outOfStock ?? false }
        : undefined;
      if (!created) return;
      setProducts((prev) => [created, ...prev].slice(0, pageSize));
      setTotalCount((prev) => prev + 1);
      setCreateTitle("");
      setCreateHandle("");
      setCreateSupplierId("");
      setCreateLeadTimeDays("");
      setCreateOpen(false);
    } catch {
      setCreateError("Create failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    setError("");
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Delete failed");
        return;
      }
      setProducts((prev) => prev.filter((item) => item.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
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
      const res = await fetch(`/api/admin/products/${id}/duplicate`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        product?: ProductRow;
      };
      if (!res.ok || !data.product) {
        setError(data.error ?? "Duplicate failed");
        return;
      }
      const nextProduct = data.product
        ? { ...data.product, outOfStock: data.product.outOfStock ?? false }
        : null;
      if (!nextProduct) return;
      setProducts((prev) => [nextProduct, ...prev].slice(0, pageSize));
      setTotalCount((prev) => prev + 1);
    } catch {
      setError("Duplicate failed");
    } finally {
      setDuplicatingId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((product) => product.id));
    }
  };

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(searchParamsString);
    const trimmed = searchTerm.trim();
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    return query ? `/admin/catalog?${query}` : "/admin/catalog";
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
    } = { productIds: selectedIds };

    if (bulkStatus) {
      payload.status = bulkStatus;
    }

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
    if (bulkProductGroupClear) {
      payload.productGroup = null;
    } else if (bulkProductGroup.trim()) {
      payload.productGroup = bulkProductGroup.trim();
    }

    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Bulk update failed");
        return;
      }
      setSelectedIds([]);
      setBulkStatus("");
      setBulkPriceValue("");
      setBulkLowStock("");
      setBulkTagAdd("");
      setBulkTagRemove("");
      setBulkCategoryId("");
      setBulkSupplierId("");
    } catch {
      setError("Bulk update failed");
    } finally {
      setBulkSaving(false);
    }
  };

  const upsertCategory = async (
    item: CategoryRow,
    type: "category" | "collection",
  ) => {
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
          }
        : {
            name: item.name,
            handle: item.handle,
            description: item.description,
          };
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Update failed");
    }
  };

  const deleteCategory = async (
    id: string,
    type: "category" | "collection",
  ) => {
    const url =
      type === "category"
        ? `/api/admin/categories/${id}`
        : `/api/admin/collections/${id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    if (type === "category") {
      setCategories((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCollections((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const createLabel = async (
    payload: {
      name: string;
      handle: string;
      description?: string;
      parentId?: string | null;
    },
    type: "category" | "collection",
  ) => {
    const url =
      type === "category" ? "/api/admin/categories" : "/api/admin/collections";
    const body =
      type === "category"
        ? payload
        : {
            name: payload.name,
            handle: payload.handle,
            description: payload.description,
          };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      category?: CategoryRow;
      collection?: CategoryRow;
    };
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return null;
    }
    return type === "category" ? data.category : data.collection;
  };

  const [newCategory, setNewCategory] = useState({
    name: "",
    handle: "",
    description: "",
    parentId: "",
  });
  const [newCollection, setNewCollection] = useState({
    name: "",
    handle: "",
    description: "",
  });

  return (
    <div className="admin-catalog-shell space-y-10 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="admin-catalog-hero rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / CATALOG
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Catalog</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="admin-catalog-stat rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {totalCount} products
              </span>
              <span className="admin-catalog-stat rounded-full bg-white/10 px-3 py-1">
                {selectedIds.length} selected
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <AdminBackButton
              inline
              showOnCatalog
              className="admin-catalog-back h-9 px-4 text-sm text-[#2f3e36] hover:bg-emerald-50"
            />
            <Link
              href="/admin/catalog"
              className="admin-catalog-refresh rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:bg-emerald-50"
            >
              Refresh
            </Link>
          </div>
        </div>
      </div>
      <section className="admin-catalog-section rounded-2xl border border-emerald-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              01
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Products
              </p>
              <p className="text-xs text-stone-500">
                Create, edit, and bulk update inventory.
              </p>
            </div>
          </div>
        </div>
        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 rounded-2xl border border-emerald-200/70 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="admin-catalog-search flex w-full max-w-md items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-stone-600 shadow-sm">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-stone-400"
                aria-hidden="true"
              >
                <path
                  d="M11 4a7 7 0 015.25 11.7l3.53 3.53a1 1 0 01-1.41 1.41l-3.53-3.53A7 7 0 1111 4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by product name"
                className="w-full bg-transparent text-sm text-stone-700 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setCreateError("");
                setCreateTitle("");
                setCreateHandle("");
                setHandleTouched(false);
                setCreateOpen(true);
              }}
              disabled={saving}
              className="admin-catalog-create h-11 rounded-md bg-[#2f3e36] px-6 text-sm font-semibold text-white transition hover:bg-[#24312b] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create product"}
            </button>
          </div>
        </div>
        <div className="admin-catalog-table mt-6 max-h-[420px] overflow-x-auto overflow-y-auto rounded-2xl border border-black/10 bg-white px-4 pb-2">
          <table className="w-full text-left text-sm">
            <thead className="admin-catalog-table-head sticky top-0 z-20 bg-white text-sm uppercase tracking-[0.2em] text-emerald-700/70 shadow-[0_1px_0_rgba(15,23,42,0.08)]">
              <tr>
                <th className="bg-white py-4 pl-4">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === products.length &&
                      products.length > 0
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="bg-white py-4">
                  <button
                    type="button"
                    onClick={() => handleSort("title")}
                    className={`inline-flex items-center gap-2 ${
                      sortKey === "title"
                        ? "text-amber-600"
                        : "text-emerald-700/70 hover:text-emerald-700"
                    }`}
                  >
                    Title
                    {renderSortArrow("title")}
                  </button>
                </th>
                <th className="bg-white py-4">
                  <button
                    type="button"
                    onClick={() => handleSort("status")}
                    className={`inline-flex items-center gap-2 ${
                      sortKey === "status"
                        ? "text-amber-600"
                        : "text-emerald-700/70 hover:text-emerald-700"
                    }`}
                  >
                    Status
                    {renderSortArrow("status")}
                  </button>
                </th>
                <th className="bg-white py-4">
                  <button
                    type="button"
                    onClick={() => handleSort("variants")}
                    className={`inline-flex items-center gap-2 ${
                      sortKey === "variants"
                        ? "text-amber-600"
                        : "text-emerald-700/70 hover:text-emerald-700"
                    }`}
                  >
                    Variants
                    {renderSortArrow("variants")}
                  </button>
                </th>
                <th className="bg-white py-4">
                  <button
                    type="button"
                    onClick={() => handleSort("category")}
                    className={`inline-flex items-center gap-2 ${
                      sortKey === "category"
                        ? "text-amber-600"
                        : "text-emerald-700/70 hover:text-emerald-700"
                    }`}
                  >
                    Category
                    {renderSortArrow("category")}
                  </button>
                </th>
                <th className="bg-white py-4">
                  <button
                    type="button"
                    onClick={() => handleSort("updatedAt")}
                    className={`inline-flex items-center gap-2 ${
                      sortKey === "updatedAt"
                        ? "text-amber-600"
                        : "text-emerald-700/70 hover:text-emerald-700"
                    }`}
                  >
                    Updated
                    {renderSortArrow("updatedAt")}
                  </button>
                </th>
                <th className="bg-white py-4 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr
                  key={product.id}
                  className={`admin-catalog-row border-t border-black/10 ${
                    product.outOfStock
                      ? "bg-red-50/70 hover:bg-red-50"
                      : "hover:bg-emerald-50/60"
                  }`}
                >
                  <td className="py-3 pr-3 pl-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleSelected(product.id)}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/catalog/${product.id}`}
                      className="font-semibold text-black hover:underline"
                    >
                      {product.title}
                    </Link>
                    <div className="text-xs text-stone-500">
                      {product.handle}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{product.status}</td>
                  <td className="py-3 pr-3">{product._count.variants}</td>
                  <td className="py-3 pr-3">
                    {product.mainCategory?.name ?? "—"}
                  </td>
                  <td className="py-3">
                    {new Date(product.updatedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => duplicateProduct(product.id)}
                        className="inline-flex items-center justify-center rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-700 hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        disabled={duplicatingId === product.id}
                        aria-label="Duplicate product"
                        title="Duplicate product"
                      >
                        {duplicatingId === product.id ? (
                          <span className="text-xs font-semibold">...</span>
                        ) : (
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(product.id)}
                        className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-2 text-red-700 hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        disabled={deletingId === product.id}
                        aria-label="Delete product"
                      >
                        {deletingId === product.id ? (
                          <span className="text-xs font-semibold">
                            Deleting...
                          </span>
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-stone-500">
                    {searchTerm.trim()
                      ? "No matching products."
                      : "No products yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
          <div>
            Showing{" "}
            <span className="font-semibold text-stone-700">
              {visibleProducts.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-stone-700">{totalCount}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Link
              href={buildPageHref(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage <= 1}
              scroll={false}
              className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold transition ${
                currentPage <= 1
                  ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100"
              }`}
              tabIndex={currentPage <= 1 ? -1 : 0}
            >
              Prev
            </Link>
            <span className="flex h-9 min-w-[5rem] items-center justify-center gap-0.5 text-center text-stone-500">
              <span>Page</span>
              <span className="font-semibold text-stone-700">
                {currentPage}
              </span>
              <span>of</span>
              <span className="font-semibold text-stone-700">{totalPages}</span>
            </span>
            <Link
              href={buildPageHref(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage >= totalPages}
              scroll={false}
              className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold transition ${
                currentPage >= totalPages
                  ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100"
              }`}
              tabIndex={currentPage >= totalPages ? -1 : 0}
            >
              Next
            </Link>
          </div>
        </div>
        <div className="group mt-6 rounded-2xl border border-emerald-700/40 bg-emerald-900/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-emerald-950">
              Bulk edit ({selectedIds.length} selected)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyBulkEdit}
                disabled={bulkSaving}
                className="h-9 rounded-md bg-[#1f2b25] px-4 text-xs font-semibold text-white hover:bg-[#1a241f] disabled:opacity-60"
              >
                {bulkSaving ? "Applying..." : "Apply changes"}
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-900/30 text-emerald-950 transition hover:border-emerald-900/50"
                aria-label={
                  bulkOpen ? "Collapse bulk edit" : "Expand bulk edit"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform ${
                    bulkOpen ? "rotate-180" : "rotate-0"
                  }`}
                  aria-hidden="true"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          {bulkOpen && (
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600">
                  Status
                  <select
                    value={bulkStatus}
                    onChange={(event) =>
                      setBulkStatus(
                        event.target.value as ProductRow["status"] | "",
                      )
                    }
                    className="mt-1 h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-800"
                  >
                    <option value="">No change</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  Low stock threshold
                  <input
                    type="number"
                    min={0}
                    value={bulkLowStock}
                    onChange={(event) => setBulkLowStock(event.target.value)}
                    placeholder="No change"
                    className="mt-1 h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-800"
                  />
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600">
                  Price adjust
                  <div className="mt-1 flex gap-2">
                    <select
                      value={bulkPriceDirection}
                      onChange={(event) =>
                        setBulkPriceDirection(
                          event.target.value as "increase" | "decrease",
                        )
                      }
                      className="h-10 rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-800"
                    >
                      <option value="increase">Increase</option>
                      <option value="decrease">Decrease</option>
                    </select>
                    <input
                      value={bulkPriceValue}
                      onChange={(event) =>
                        setBulkPriceValue(event.target.value)
                      }
                      placeholder="0"
                      className="h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-800"
                    />
                    <select
                      value={bulkPriceMode}
                      onChange={(event) =>
                        setBulkPriceMode(
                          event.target.value as "percent" | "fixed",
                        )
                      }
                      className="h-10 rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-800"
                    >
                      <option value="percent">%</option>
                      <option value="fixed">EUR</option>
                    </select>
                  </div>
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  Category
                  <div className="mt-1 flex gap-2">
                    <select
                      value={bulkCategoryAction}
                      onChange={(event) =>
                        setBulkCategoryAction(
                          event.target.value as "add" | "remove",
                        )
                      }
                      className="h-10 rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-800"
                    >
                      <option value="add">Add</option>
                      <option value="remove">Remove</option>
                    </select>
                    <select
                      value={bulkCategoryId}
                      onChange={(event) =>
                        setBulkCategoryId(event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-800"
                    >
                      <option value="">No change</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  Supplier
                  <select
                    value={bulkSupplierId}
                    onChange={(event) => setBulkSupplierId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-800"
                  >
                    <option value="">No change</option>
                    <option value="__clear__">Clear supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  Produktgruppe
                  <input
                    value={bulkProductGroup}
                    onChange={(event) => setBulkProductGroup(event.target.value)}
                    placeholder="No change"
                    className="mt-1 h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-800"
                    disabled={bulkProductGroupClear}
                  />
                  <label className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-stone-500">
                    <input
                      type="checkbox"
                      checked={bulkProductGroupClear}
                      onChange={(event) => {
                        setBulkProductGroupClear(event.target.checked);
                        if (event.target.checked) {
                          setBulkProductGroup("");
                        }
                      }}
                    />
                    Produktgruppe löschen
                  </label>
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600">
                  Add tags
                  <input
                    value={bulkTagAdd}
                    onChange={(event) => setBulkTagAdd(event.target.value)}
                    placeholder="tag1, tag2"
                    className="mt-1 h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-800"
                  />
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  Remove tags
                  <input
                    value={bulkTagRemove}
                    onChange={(event) => setBulkTagRemove(event.target.value)}
                    placeholder="tag1, tag2"
                    className="mt-1 h-10 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-800"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-blue-300/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(30,64,175,0.18)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-900">
                02
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-900">
                  Categories
                </p>
                <p className="text-xs text-stone-500">
                  Organize products for browsing and filtering.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCategoriesOpen((prev) => !prev)}
              className="inline-flex h-10 min-w-[2.5rem] items-center justify-center gap-1 rounded-full border border-blue-300 px-2 text-blue-900 transition hover:border-blue-400"
              aria-label={
                categoriesOpen ? "Collapse categories" : "Expand categories"
              }
            >
              {!categoriesOpen && (
                <span className="mr-1 text-[11px] font-semibold text-blue-900">
                  {categories.length}
                </span>
              )}
              <span
                className={`text-lg transition-transform ${
                  categoriesOpen ? "rotate-180" : "rotate-0"
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
          </div>
          {categoriesOpen && (
            <div className="grid gap-3">
              {groupedCategories.parents.map((item) => {
                const isCollapsed = collapsedCategoryIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-blue-200/80 bg-white p-3 mt-3"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                      <div className="text-xs font-semibold text-blue-900">
                        Parent category
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[11px] font-semibold text-blue-800/80">
                          Subcategories:{" "}
                          {
                            (
                              groupedCategories.childrenByParent.get(item.id) ??
                              []
                            ).length
                          }
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedCategoryIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-900 hover:border-blue-300"
                        >
                          {isCollapsed ? "Show" : "Hide"}
                          <span
                            className={`text-base transition-transform ${
                              isCollapsed ? "rotate-180" : "rotate-0"
                            }`}
                            aria-hidden="true"
                          >
                            ▾
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-xs font-semibold text-stone-600">
                        Name
                        <input
                          value={item.name}
                          onChange={(event) =>
                            setCategories((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, name: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="e.g. Grow tents"
                          className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-stone-600">
                        Handle
                        <input
                          value={item.handle}
                          onChange={(event) =>
                            setCategories((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, handle: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="grow-tents"
                          className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-stone-600">
                        Parent category
                        <select
                          value={item.parentId ?? ""}
                          onChange={(event) =>
                            setCategories((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      parentId: event.target.value || null,
                                    }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                        >
                          <option value="">No parent</option>
                          {categories
                            .filter((candidate) => candidate.id !== item.id)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-stone-600 md:col-span-2">
                        Description
                        <input
                          value={item.description ?? ""}
                          onChange={(event) =>
                            setCategories((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, description: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="Short note for this category"
                          className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => upsertCategory(item, "category")}
                        className="h-10 rounded-md border border-blue-300 px-4 text-xs font-semibold text-blue-900 hover:border-blue-400"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(item.id, "category")}
                        className="flex h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                        aria-label="Delete category"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {(groupedCategories.childrenByParent.get(item.id) ?? [])
                      .length > 0 &&
                      !isCollapsed && (
                        <div className="mt-3 space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-800">
                            Subcategories under {item.name}
                          </div>
                          {(
                            groupedCategories.childrenByParent.get(item.id) ??
                            []
                          ).map((child) => (
                            <div
                              key={child.id}
                              className="rounded-lg border border-blue-100 bg-white p-3 md:ml-3"
                            >
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-blue-800">
                                <span className="rounded-full bg-blue-100 px-2 py-1">
                                  Parent: {item.name}
                                </span>
                                <span className="text-blue-700/80">
                                  ↳ Child category
                                </span>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="block text-xs font-semibold text-stone-600">
                                  Name
                                  <input
                                    value={child.name}
                                    onChange={(event) =>
                                      setCategories((prev) =>
                                        prev.map((row) =>
                                          row.id === child.id
                                            ? {
                                                ...row,
                                                name: event.target.value,
                                              }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="e.g. Grow tents"
                                    className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-stone-600">
                                  Handle
                                  <input
                                    value={child.handle}
                                    onChange={(event) =>
                                      setCategories((prev) =>
                                        prev.map((row) =>
                                          row.id === child.id
                                            ? {
                                                ...row,
                                                handle: event.target.value,
                                              }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="grow-tents"
                                    className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-stone-600">
                                  Parent category
                                  <select
                                    value={child.parentId ?? ""}
                                    onChange={(event) =>
                                      setCategories((prev) =>
                                        prev.map((row) =>
                                          row.id === child.id
                                            ? {
                                                ...row,
                                                parentId:
                                                  event.target.value || null,
                                              }
                                            : row,
                                        ),
                                      )
                                    }
                                    className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                                  >
                                    <option value="">No parent</option>
                                    {categories
                                      .filter(
                                        (candidate) =>
                                          candidate.id !== child.id,
                                      )
                                      .map((candidate) => (
                                        <option
                                          key={candidate.id}
                                          value={candidate.id}
                                        >
                                          {candidate.name}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                                <label className="block text-xs font-semibold text-stone-600 md:col-span-2">
                                  Description
                                  <input
                                    value={child.description ?? ""}
                                    onChange={(event) =>
                                      setCategories((prev) =>
                                        prev.map((row) =>
                                          row.id === child.id
                                            ? {
                                                ...row,
                                                description: event.target.value,
                                              }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="Short note for this category"
                                    className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    upsertCategory(child, "category")
                                  }
                                  className="h-10 rounded-md border border-blue-300 px-4 text-xs font-semibold text-blue-900 hover:border-blue-400"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteCategory(child.id, "category")
                                  }
                                  className="flex h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                                  aria-label="Delete category"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}
              {categories.length === 0 && (
                <p className="text-xs text-stone-500">No categories yet.</p>
              )}
            </div>
          )}
          <div className="mt-3 rounded-xl border border-dashed border-blue-200/80 bg-blue-50/60 p-3">
            <p className="text-xs font-semibold text-blue-900 mb-2">
              Add category
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={newCategory.name}
                onChange={(event) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Name"
                className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                value={newCategory.handle}
                onChange={(event) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    handle: event.target.value,
                  }))
                }
                placeholder="Handle"
                className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
              />
              <select
                value={newCategory.parentId}
                onChange={(event) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    parentId: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
              >
                <option value="">No parent</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                value={newCategory.description}
                onChange={(event) =>
                  setNewCategory((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Description"
                className="h-10 w-full rounded-md border border-black/15 px-3 text-sm md:col-span-2"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  const created = await createLabel(newCategory, "category");
                  if (created) {
                    setCategories((prev) => [...prev, created]);
                    setNewCategory({
                      name: "",
                      handle: "",
                      description: "",
                      parentId: "",
                    });
                  }
                }}
                className="h-10 rounded-md bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(167,139,250,0.18)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
                03
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
                  Collections
                </p>
                <p className="text-xs text-stone-500">
                  Curated groupings for promotions or featured sets.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCollectionsOpen((prev) => !prev)}
              className="inline-flex h-10 min-w-[2.5rem] items-center justify-center gap-1 rounded-full border border-violet-200 px-2 text-violet-700 transition hover:border-violet-300"
              aria-label={
                collectionsOpen ? "Collapse collections" : "Expand collections"
              }
            >
              {!collectionsOpen && (
                <span className="mr-1 text-[11px] font-semibold text-violet-700">
                  {collections.length}
                </span>
              )}
              <span
                className={`text-lg transition-transform ${
                  collectionsOpen ? "rotate-180" : "rotate-0"
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
          </div>
          {collectionsOpen && (
            <div className="grid gap-3 mt-3">
              {collections.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-violet-200/70 bg-white p-3"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-xs font-semibold text-stone-600">
                      Name
                      <input
                        value={item.name}
                        onChange={(event) =>
                          setCollections((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, name: event.target.value }
                                : row,
                            ),
                          )
                        }
                        placeholder="e.g. New arrivals"
                        className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-stone-600">
                      Handle
                      <input
                        value={item.handle}
                        onChange={(event) =>
                          setCollections((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, handle: event.target.value }
                                : row,
                            ),
                          )
                        }
                        placeholder="new-arrivals"
                        className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-stone-600 md:col-span-2">
                      Description
                      <input
                        value={item.description ?? ""}
                        onChange={(event) =>
                          setCollections((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? { ...row, description: event.target.value }
                                : row,
                            ),
                          )
                        }
                        placeholder="Short note for this collection"
                        className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => upsertCategory(item, "collection")}
                      className="h-10 rounded-md border border-violet-200 px-4 text-xs font-semibold text-violet-700 hover:border-violet-300"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(item.id, "collection")}
                      className="flex h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700"
                      aria-label="Delete collection"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {collections.length === 0 && (
                <p className="text-xs text-stone-500">No collections yet.</p>
              )}
            </div>
          )}
          <div className="mt-3 rounded-xl border border-dashed border-violet-200/80 bg-violet-50/60 p-3">
            <p className="text-xs font-semibold text-violet-700 mb-2">
              Add collection
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={newCollection.name}
                onChange={(event) =>
                  setNewCollection((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Name"
                className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                value={newCollection.handle}
                onChange={(event) =>
                  setNewCollection((prev) => ({
                    ...prev,
                    handle: event.target.value,
                  }))
                }
                placeholder="Handle"
                className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
              />
              <input
                value={newCollection.description}
                onChange={(event) =>
                  setNewCollection((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Description"
                className="h-10 w-full rounded-md border border-black/15 px-3 text-sm md:col-span-2"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  const created = await createLabel(
                    newCollection,
                    "collection",
                  );
                  if (created) {
                    setCollections((prev) => [...prev, created]);
                    setNewCollection({ name: "", handle: "", description: "" });
                  }
                }}
                className="h-10 rounded-md bg-violet-500 px-5 text-xs font-semibold text-white hover:bg-violet-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setCreateOpen(false)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Create product
            </h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-stone-600">
                Title
                <input
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
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                Handle
                <input
                  type="text"
                  value={createHandle}
                  onChange={(event) => {
                    setHandleTouched(true);
                    setCreateHandle(event.target.value);
                  }}
                  placeholder="auto-generated from title"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                Supplier
                <select
                  value={createSupplierId}
                  onChange={(event) => setCreateSupplierId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                >
                  <option value="">No supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                Lead time (days)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={createLeadTimeDays}
                  onChange={(event) =>
                    setCreateLeadTimeDays(event.target.value)
                  }
                  placeholder="e.g. 7"
                  className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                />
              </label>
              {createError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {createError}
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void createProduct(createTitle, createHandle)}
                className="h-10 rounded-md bg-[#2f3e36] px-4 text-sm font-semibold text-white"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmDeleteId(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Produkt löschen?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Das Produkt wird dauerhaft gelöscht. Diese Aktion kann nicht
              rückgängig gemacht werden.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  if (id) {
                    await deleteProduct(id);
                  }
                }}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
