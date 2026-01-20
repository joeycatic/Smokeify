"use client";

import Link from "next/link";
import { useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type ProductRow = {
  id: string;
  title: string;
  handle: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  updatedAt: string;
  _count: { variants: number; images: number };
};

type CategoryRow = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
};

type Props = {
  initialProducts: ProductRow[];
  initialCategories: CategoryRow[];
  initialCollections: CategoryRow[];
};

const STATUS_OPTIONS: ProductRow["status"][] = ["DRAFT", "ACTIVE", "ARCHIVED"];

export default function AdminCatalogClient({
  initialProducts,
  initialCategories,
  initialCollections,
}: Props) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [categories, setCategories] =
    useState<CategoryRow[]>(initialCategories);
  const [collections, setCollections] =
    useState<CategoryRow[]>(initialCollections);
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<ProductRow["status"]>("DRAFT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [handleError, setHandleError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProductRow["status"] | "">("");
  const [bulkPriceMode, setBulkPriceMode] = useState<"percent" | "fixed">(
    "percent"
  );
  const [bulkPriceDirection, setBulkPriceDirection] = useState<
    "increase" | "decrease"
  >("increase");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkLowStock, setBulkLowStock] = useState("");
  const [bulkTagAdd, setBulkTagAdd] = useState("");
  const [bulkTagRemove, setBulkTagRemove] = useState("");
  const [bulkCategoryAction, setBulkCategoryAction] = useState<
    "add" | "remove"
  >("add");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const createProduct = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    setHandleError("");
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, handle, status }),
      });
      const data = (await res.json()) as {
        product?: ProductRow;
        error?: string;
      };
      if (!res.ok || !data.product) {
        const errorMessage = data.error ?? "Create failed";
        setError(errorMessage);
        if (errorMessage.toLowerCase().includes("handle")) {
          setHandleError(errorMessage);
        }
        return;
      }
      const created = data.product;
      if (!created) return;
      setProducts((prev) => [created, ...prev]);
      setTitle("");
      setHandle("");
      setStatus("DRAFT");
    } catch {
      setError("Create failed");
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
    } catch {
      setError("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((product) => product.id));
    }
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
    } catch {
      setError("Bulk update failed");
    } finally {
      setBulkSaving(false);
    }
  };

  const upsertCategory = async (
    item: CategoryRow,
    type: "category" | "collection"
  ) => {
    const url =
      type === "category"
        ? `/api/admin/categories/${item.id}`
        : `/api/admin/collections/${item.id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        handle: item.handle,
        description: item.description,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Update failed");
    }
  };

  const deleteCategory = async (
    id: string,
    type: "category" | "collection"
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
    payload: { name: string; handle: string; description?: string },
    type: "category" | "collection"
  ) => {
    const url =
      type === "category" ? "/api/admin/categories" : "/api/admin/collections";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  });
  const [newCollection, setNewCollection] = useState({
    name: "",
    handle: "",
    description: "",
  });

  return (
    <div className="space-y-10 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / CATALOG
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Catalog</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {products.length} products
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {selectedIds.length} selected
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <Link
              href="/admin/catalog"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:bg-emerald-50"
            >
              Refresh
            </Link>
          </div>
        </div>
      </div>
      <section className="rounded-2xl border border-emerald-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
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
        <div className="group mb-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-emerald-700">
              Bulk edit ({selectedIds.length} selected)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyBulkEdit}
                disabled={bulkSaving}
                className="h-9 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b] disabled:opacity-60"
              >
                {bulkSaving ? "Applying..." : "Apply changes"}
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2f3e36]/20 text-[#2f3e36] transition hover:border-[#2f3e36]/40"
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
                        event.target.value as ProductRow["status"] | ""
                      )
                    }
                    className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-2 text-sm"
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
                    className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
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
                          event.target.value as "increase" | "decrease"
                        )
                      }
                      className="h-10 rounded-md border border-black/15 bg-white px-2 text-sm"
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
                      className="h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                    />
                    <select
                      value={bulkPriceMode}
                      onChange={(event) =>
                        setBulkPriceMode(
                          event.target.value as "percent" | "fixed"
                        )
                      }
                      className="h-10 rounded-md border border-black/15 bg-white px-2 text-sm"
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
                          event.target.value as "add" | "remove"
                        )
                      }
                      className="h-10 rounded-md border border-black/15 bg-white px-2 text-sm"
                    >
                      <option value="add">Add</option>
                      <option value="remove">Remove</option>
                    </select>
                    <select
                      value={bulkCategoryId}
                      onChange={(event) =>
                        setBulkCategoryId(event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-black/15 bg-white px-2 text-sm"
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
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-600">
                  Add tags
                  <input
                    value={bulkTagAdd}
                    onChange={(event) => setBulkTagAdd(event.target.value)}
                    placeholder="tag1, tag2"
                    className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  Remove tags
                  <input
                    value={bulkTagRemove}
                    onChange={(event) => setBulkTagRemove(event.target.value)}
                    placeholder="tag1, tag2"
                    className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 rounded-2xl border border-emerald-200/70 bg-white/90 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,180px)_minmax(0,120px)]">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Product title"
              className="h-11 min-w-0 rounded-md border border-black/15 px-3 text-sm"
            />
            <label className="block">
              <input
                type="text"
                value={handle}
                onChange={(event) => {
                  setHandleError("");
                  setHandle(event.target.value);
                }}
                placeholder="Handle (optional)"
                className="h-11 w-full min-w-0 rounded-md border border-black/15 px-3 text-sm"
              />
              {handleError && (
                <span className="mt-1 block text-[11px] font-medium text-red-600">
                  {handleError}
                </span>
              )}
            </label>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ProductRow["status"])
              }
              className="h-11 min-w-0 rounded-md border border-black/15 bg-white px-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createProduct}
              disabled={saving}
              className="h-11 w-full rounded-md bg-[#2f3e36] text-sm font-semibold text-white transition hover:bg-[#24312b] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 bg-white px-4 pt-4 pb-2">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-emerald-700/70">
              <tr>
                <th className="pb-3 pl-4">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === products.length &&
                      products.length > 0
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="pb-3">Title</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Variants</th>
                <th className="pb-3">Images</th>
                <th className="pb-3">Updated</th>
                <th className="pb-3 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-black/10 hover:bg-emerald-50/60"
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
                  <td className="py-3 pr-3">{product._count.images}</td>
                  <td className="py-3">
                    {new Date(product.updatedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(product.id)}
                      className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-2 text-red-700 hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      disabled={deletingId === product.id}
                      aria-label="Delete product"
                    >
                      {deletingId === product.id ? (
                        <span className="text-xs font-semibold">Deleting...</span>
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-stone-500">
                    No products yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(251,191,36,0.14)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                02
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
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
              className="inline-flex h-10 min-w-[2.5rem] items-center justify-center gap-1 rounded-full border border-amber-200 px-2 text-amber-700 transition hover:border-amber-300"
              aria-label={
                categoriesOpen ? "Collapse categories" : "Expand categories"
              }
            >
              {!categoriesOpen && (
                <span className="mr-1 text-[11px] font-semibold text-amber-700">
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
              {categories.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-amber-200/70 bg-white p-3 mt-3"
                >
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
                                : row
                            )
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
                                : row
                            )
                          )
                        }
                        placeholder="grow-tents"
                        className="mt-1 h-10 w-full rounded-md border border-black/15 px-3 text-sm"
                      />
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
                                : row
                            )
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
                      className="h-10 rounded-md border border-amber-200 px-4 text-xs font-semibold text-amber-700 hover:border-amber-300"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(item.id, "category")}
                      className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-stone-500">No categories yet.</p>
              )}
            </div>
          )}
          <div className="mt-3 rounded-xl border border-dashed border-amber-200/80 bg-amber-50/60 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-2">
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
                    setNewCategory({ name: "", handle: "", description: "" });
                  }
                }}
                className="h-10 rounded-md bg-amber-500 px-5 text-xs font-semibold text-white hover:bg-amber-600"
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
                                : row
                            )
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
                                : row
                            )
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
                                : row
                            )
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
                      className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700"
                    >
                      Delete
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
                    "collection"
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
