"use client";

import Link from "next/link";
import { useState } from "react";

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
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [collections, setCollections] = useState<CategoryRow[]>(
    initialCollections
  );
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<ProductRow["status"]>("DRAFT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [handleError, setHandleError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);

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
      const data = (await res.json()) as { product?: ProductRow; error?: string };
      if (!res.ok || !data.product) {
        const errorMessage = data.error ?? "Create failed";
        setError(errorMessage);
        if (errorMessage.toLowerCase().includes("handle")) {
          setHandleError(errorMessage);
        }
        return;
      }
      setProducts((prev) => [data.product, ...prev]);
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
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
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
    <div className="space-y-10">
      <section className="rounded-xl border border-[#2f3e36]/15 bg-white p-6">
        <h2 className="text-sm font-semibold tracking-widest text-[#2f3e36] mb-4">
          PRODUCTS
        </h2>
        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
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
            onChange={(event) => setStatus(event.target.value as ProductRow["status"])}
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
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-[#2f3e36]/60">
              <tr>
                <th className="pb-3">Title</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Variants</th>
                <th className="pb-3">Images</th>
                <th className="pb-3">Updated</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-black/10 hover:bg-[#f6f9f4]"
                >
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/catalog/${product.id}`}
                      className="font-semibold text-black hover:underline"
                    >
                      {product.title}
                    </Link>
                    <div className="text-xs text-stone-500">{product.handle}</div>
                  </td>
                  <td className="py-3 pr-3">{product.status}</td>
                  <td className="py-3 pr-3">{product._count.variants}</td>
                  <td className="py-3 pr-3">{product._count.images}</td>
                  <td className="py-3">
                    {new Date(product.updatedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(product.id)}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:border-red-300"
                      disabled={deletingId === product.id}
                    >
                      {deletingId === product.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-stone-500">
                    No products yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="rounded-xl border border-[#2f3e36]/15 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-widest text-black/70">
              CATEGORIES
            </h2>
            <button
              type="button"
              onClick={() => setCategoriesOpen((prev) => !prev)}
              className="inline-flex h-10 min-w-[2.5rem] items-center justify-center gap-1 rounded-full border border-[#2f3e36]/20 px-2 text-[#2f3e36] transition hover:border-[#2f3e36]/40"
              aria-label={categoriesOpen ? "Collapse categories" : "Expand categories"}
            >
              {!categoriesOpen && (
                <span className="mr-1 text-[11px] font-semibold text-[#2f3e36]">
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
          <p className="text-xs text-stone-500 mb-4">
            Organize products for browsing and filtering.
          </p>
          {categoriesOpen && (
            <div className="grid gap-4">
              {categories.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#2f3e36]/10 bg-[#f6f9f4] p-4"
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
                        className="h-10 rounded-md border border-[#2f3e36]/20 px-4 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
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
          <div className="mt-4 rounded-lg border border-dashed border-[#2f3e36]/20 bg-[#f8fbf6] p-4">
            <p className="text-xs font-semibold text-stone-600 mb-2">
              Add category
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={newCategory.name}
                onChange={(event) =>
                  setNewCategory((prev) => ({ ...prev, name: event.target.value }))
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
                className="h-10 rounded-md bg-[#2f3e36] px-5 text-xs font-semibold text-white hover:bg-[#24312b]"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#2f3e36]/15 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-widest text-black/70">
              COLLECTIONS
            </h2>
            <button
              type="button"
              onClick={() => setCollectionsOpen((prev) => !prev)}
              className="inline-flex h-10 min-w-[2.5rem] items-center justify-center gap-1 rounded-full border border-[#2f3e36]/20 px-2 text-[#2f3e36] transition hover:border-[#2f3e36]/40"
              aria-label={collectionsOpen ? "Collapse collections" : "Expand collections"}
            >
              {!collectionsOpen && (
                <span className="mr-1 text-[11px] font-semibold text-[#2f3e36]">
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
          <p className="text-xs text-stone-500 mb-4">
            Curated groupings for promotions or featured sets.
          </p>
          {collectionsOpen && (
            <div className="grid gap-4">
              {collections.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#2f3e36]/10 bg-[#f6f9f4] p-4"
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
                        className="h-10 rounded-md border border-[#2f3e36]/20 px-4 text-xs font-semibold text-[#2f3e36] hover:border-[#2f3e36]/40"
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
          <div className="mt-4 rounded-lg border border-dashed border-[#2f3e36]/20 bg-[#f8fbf6] p-4">
            <p className="text-xs font-semibold text-stone-600 mb-2">
              Add collection
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={newCollection.name}
                onChange={(event) =>
                  setNewCollection((prev) => ({ ...prev, name: event.target.value }))
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
                  const created = await createLabel(newCollection, "collection");
                  if (created) {
                    setCollections((prev) => [...prev, created]);
                    setNewCollection({ name: "", handle: "", description: "" });
                  }
                }}
                className="h-10 rounded-md bg-[#2f3e36] px-5 text-xs font-semibold text-white hover:bg-[#24312b]"
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
