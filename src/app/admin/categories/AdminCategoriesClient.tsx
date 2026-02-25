"use client";

import { useEffect, useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type Category = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminCategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [newCategory, setNewCategory] = useState({
    name: "",
    handle: "",
    description: "",
    parentId: "",
  });

  const loadCategories = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/categories", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load categories.");
        return;
      }
      const data = (await res.json()) as { categories?: Category[] };
      setCategories(data.categories ?? []);
    } catch {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const totalCategories = useMemo(() => categories.length, [categories]);

  const parentOptions = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories]
  );

  const getCategoryName = (id: string | null) => {
    if (!id) return null;
    return categories.find((c) => c.id === id)?.name ?? null;
  };

  const resetForm = () => {
    setNewCategory({ name: "", handle: "", description: "", parentId: "" });
  };

  const createCategory = async () => {
    setError("");
    setNotice("");
    const name = newCategory.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          handle: newCategory.handle.trim() || undefined,
          description: newCategory.description.trim() || null,
          parentId: newCategory.parentId || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create category.");
        return;
      }
      const data = (await res.json()) as { category?: Category };
      if (data.category) {
        setCategories((prev) =>
          [...prev, data.category!].sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        await loadCategories();
      }
      resetForm();
      setNotice("Category created.");
    } catch {
      setError("Failed to create category.");
    }
  };

  const updateCategory = async (category: Category) => {
    setError("");
    setNotice("");
    const name = category.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setSavingId(category.id);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          handle: category.handle.trim() || undefined,
          description: category.description?.trim() || null,
          parentId: category.parentId || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update category.");
        return;
      }
      const data = (await res.json()) as { category?: Category };
      if (data.category) {
        setCategories((prev) =>
          prev
            .map((item) => (item.id === category.id ? data.category! : item))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        await loadCategories();
      }
      setNotice("Category updated.");
    } catch {
      setError("Failed to update category.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteCategory = async (id: string, adminPassword: string) => {
    setError("");
    setNotice("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to delete category.");
        return;
      }
      setCategories((prev) => prev.filter((item) => item.id !== id));
      setNotice("Category deleted.");
    } catch {
      setError("Failed to delete category.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-10 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / CATEGORIES
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Categories</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {totalCategories} categories
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {parentOptions.length} top-level
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <button
              type="button"
              onClick={loadCategories}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:bg-emerald-50"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || notice}
        </div>
      )}

      <section className="rounded-2xl border border-emerald-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            01
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              New category
            </p>
            <p className="text-xs text-stone-500">
              Organise products into a browsable hierarchy.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Name
            <input
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. Vaporizer"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Handle{" "}
            <span className="font-normal text-stone-400">(optional)</span>
            <input
              value={newCategory.handle}
              onChange={(e) =>
                setNewCategory((prev) => ({ ...prev, handle: e.target.value }))
              }
              placeholder="vaporizer"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Parent category{" "}
            <span className="font-normal text-stone-400">(optional)</span>
            <select
              value={newCategory.parentId}
              onChange={(e) =>
                setNewCategory((prev) => ({
                  ...prev,
                  parentId: e.target.value,
                }))
              }
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            >
              <option value="">— None (top-level) —</option>
              {parentOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Description{" "}
            <span className="font-normal text-stone-400">(optional)</span>
            <input
              value={newCategory.description}
              onChange={(e) =>
                setNewCategory((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="A short description..."
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={createCategory}
            className="h-10 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
          >
            Create category
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="h-10 rounded-md border border-black/10 px-4 text-xs font-semibold text-stone-700"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(251,191,36,0.14)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
              02
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                Category list
              </p>
              <p className="text-xs text-stone-500">
                Edit or remove existing categories.
              </p>
            </div>
          </div>
          <div className="text-xs text-stone-500">
            {categories.length
              ? `${categories.length} total`
              : "No categories yet"}
          </div>
        </div>
        {categories.length === 0 ? (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-6 text-sm text-stone-500">
            No categories added yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="rounded-xl border border-amber-200/70 bg-white p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-stone-600">
                    Name
                    <input
                      value={category.name}
                      onChange={(e) =>
                        setCategories((prev) =>
                          prev.map((row) =>
                            row.id === category.id
                              ? { ...row, name: e.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Handle
                    <input
                      value={category.handle}
                      onChange={(e) =>
                        setCategories((prev) =>
                          prev.map((row) =>
                            row.id === category.id
                              ? { ...row, handle: e.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 font-mono text-xs"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Parent category
                    <select
                      value={category.parentId ?? ""}
                      onChange={(e) =>
                        setCategories((prev) =>
                          prev.map((row) =>
                            row.id === category.id
                              ? { ...row, parentId: e.target.value || null }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    >
                      <option value="">— None (top-level) —</option>
                      {categories
                        .filter((c) => c.id !== category.id && !c.parentId)
                        .map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Description
                    <input
                      value={category.description ?? ""}
                      onChange={(e) =>
                        setCategories((prev) =>
                          prev.map((row) =>
                            row.id === category.id
                              ? { ...row, description: e.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-stone-400">
                    {category.parentId ? (
                      <span>
                        Under{" "}
                        <span className="font-medium text-stone-600">
                          {getCategoryName(category.parentId) ??
                            category.parentId}
                        </span>
                      </span>
                    ) : (
                      <span>Top-level</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateCategory(category)}
                      disabled={savingId === category.id}
                      className="h-9 rounded-md border border-amber-200 px-4 text-xs font-semibold text-amber-700 hover:border-amber-300 disabled:opacity-50"
                    >
                      {savingId === category.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletePassword("");
                        setDeletePasswordError("");
                        setDeleteTarget({
                          id: category.id,
                          name: category.name,
                        });
                      }}
                      disabled={savingId === category.id}
                      className="h-9 rounded-md border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDeleteTarget(null)}
            aria-label="Close dialog"
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Kategorie löschen?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Die Kategorie wird dauerhaft gelöscht. Diese Aktion kann nicht
              rückgängig gemacht werden.
            </p>
            <p className="mt-2 text-xs text-stone-500">{deleteTarget.name}</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                if (deletePasswordError) setDeletePasswordError("");
              }}
              className="mt-4 h-10 w-full rounded-md border border-black/10 px-3 text-sm outline-none focus:border-black/30"
              placeholder="Admin-Passwort"
            />
            {deletePasswordError && (
              <p className="mt-2 text-xs text-red-600">{deletePasswordError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-10 rounded-md border border-black/10 px-4 text-sm font-semibold text-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  const adminPassword = deletePassword.trim();
                  if (!adminPassword) {
                    setDeletePasswordError("Bitte Admin-Passwort eingeben.");
                    return;
                  }
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  setDeletePassword("");
                  setDeletePasswordError("");
                  if (target) {
                    await deleteCategory(target.id, adminPassword);
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
