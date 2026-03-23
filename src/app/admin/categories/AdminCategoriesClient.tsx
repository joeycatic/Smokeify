"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminButton,
  AdminDialog,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";

type Category = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  name: "",
  handle: "",
  description: "",
  parentId: "",
};

export default function AdminCategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [newCategory, setNewCategory] = useState(emptyForm);

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
      const rows = (data.categories ?? []).sort((a, b) => a.name.localeCompare(b.name));
      setCategories(rows);
      setSelectedId((prev) =>
        prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? null
      );
    } catch {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const topLevel = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories]
  );
  const childMap = useMemo(() => {
    const map = new Map<string, Category[]>();
    categories
      .filter((category) => category.parentId)
      .forEach((category) => {
        const key = category.parentId as string;
        const next = map.get(key) ?? [];
        next.push(category);
        next.sort((a, b) => a.name.localeCompare(b.name));
        map.set(key, next);
      });
    return map;
  }, [categories]);
  const selectedCategory = categories.find((category) => category.id === selectedId) ?? null;
  const childCount = useMemo(
    () => topLevel.reduce((sum, category) => sum + (childMap.get(category.id)?.length ?? 0), 0),
    [childMap, topLevel]
  );

  const updateSelected = (patch: Partial<Category>) => {
    if (!selectedCategory) return;
    setCategories((prev) =>
      prev.map((row) => (row.id === selectedCategory.id ? { ...row, ...patch } : row))
    );
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
        const next = [...categories, data.category].sort((a, b) => a.name.localeCompare(b.name));
        setCategories(next);
        setSelectedId(data.category.id);
      } else {
        await loadCategories();
      }
      setNewCategory(emptyForm);
      setNotice("Category created.");
    } catch {
      setError("Failed to create category.");
    }
  };

  const saveSelected = async () => {
    if (!selectedCategory) return;
    setError("");
    setNotice("");
    if (!selectedCategory.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSavingId(selectedCategory.id);
    try {
      const res = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedCategory.name.trim(),
          handle: selectedCategory.handle.trim() || undefined,
          description: selectedCategory.description?.trim() || null,
          parentId: selectedCategory.parentId || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update category.");
        return;
      }
      const data = (await res.json()) as { category?: Category };
      if (data.category) {
        const next = categories
          .map((row) => (row.id === data.category?.id ? data.category : row))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCategories(next);
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
    setSavingId(id);
    setError("");
    setNotice("");
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
      const next = categories.filter((row) => row.id !== id);
      setCategories(next);
      setSelectedId(next[0]?.id ?? null);
      setNotice("Category deleted.");
    } catch {
      setError("Failed to delete category.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Categories"
        title="Taxonomy management"
        description="Manage the category hierarchy with a dedicated dark workspace instead of the old stacked form layout."
        actions={
          <AdminButton tone="secondary" onClick={() => void loadCategories()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
        metrics={
          <div className="grid gap-3 md:grid-cols-3">
            <AdminMetricCard label="Categories" value={String(categories.length)} detail="All nodes" />
            <AdminMetricCard label="Top level" value={String(topLevel.length)} detail="Root entries" />
            <AdminMetricCard label="Children" value={String(childCount)} detail="Nested categories" />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <AdminPanel
          eyebrow="Create"
          title="Add category"
          description="Create a new root or child category without leaving the taxonomy workspace."
          className="admin-reveal-delay-1"
        >
          <div className="grid gap-4">
            <AdminField label="Name">
              <AdminInput
                value={newCategory.name}
                onChange={(event) =>
                  setNewCategory((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Vaporizers"
              />
            </AdminField>
            <AdminField label="Handle" optional="optional">
              <AdminInput
                value={newCategory.handle}
                onChange={(event) =>
                  setNewCategory((prev) => ({ ...prev, handle: event.target.value }))
                }
                placeholder="vaporizers"
              />
            </AdminField>
            <AdminField label="Parent" optional="optional">
              <AdminSelect
                value={newCategory.parentId}
                onChange={(event) =>
                  setNewCategory((prev) => ({ ...prev, parentId: event.target.value }))
                }
              >
                <option value="">No parent (top level)</option>
                {topLevel.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Description" optional="optional">
              <AdminTextarea
                rows={4}
                value={newCategory.description}
                onChange={(event) =>
                  setNewCategory((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Short internal context or merchandising note"
              />
            </AdminField>
            <div className="flex flex-wrap gap-2">
              <AdminButton onClick={() => void createCategory()}>Create category</AdminButton>
              <AdminButton tone="secondary" onClick={() => setNewCategory(emptyForm)}>
                Reset
              </AdminButton>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Hierarchy"
          title="Category tree and detail editor"
          description="Select a node from the hierarchy, then edit its structure and metadata in the right-hand editor."
          className="admin-reveal-delay-2"
        >
          {categories.length === 0 ? (
            <AdminEmptyState
              title="No categories yet"
              description="Create the first taxonomy node to start building the catalog structure."
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
              <div className="rounded-[24px] border border-white/10 bg-[#070a0f] p-3">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Tree
                </div>
                <div className="space-y-2">
                  {topLevel.map((category) => {
                    const children = childMap.get(category.id) ?? [];
                    const activeRoot = selectedId === category.id;
                    return (
                      <div key={category.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(category.id)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                            activeRoot
                              ? "bg-cyan-400/10 text-cyan-200"
                              : "text-slate-200 hover:bg-white/[0.04]"
                          }`}
                        >
                          <span className="font-semibold">{category.name}</span>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            Root
                          </span>
                        </button>
                        {children.length > 0 ? (
                          <div className="mt-2 space-y-1 pl-3">
                            {children.map((child) => (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => setSelectedId(child.id)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                  selectedId === child.id
                                    ? "bg-violet-400/10 text-violet-200"
                                    : "text-slate-300 hover:bg-white/[0.04]"
                                }`}
                              >
                                <span>{child.name}</span>
                                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                  Child
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedCategory ? (
                <div className="rounded-[24px] border border-white/10 bg-[#070a0f] p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Selected node
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {selectedCategory.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {selectedCategory.parentId ? "Child category" : "Top-level category"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <AdminButton
                        tone="secondary"
                        onClick={() => setDeleteTarget({ id: selectedCategory.id, name: selectedCategory.name })}
                        disabled={savingId === selectedCategory.id}
                      >
                        Delete
                      </AdminButton>
                      <AdminButton
                        onClick={() => void saveSelected()}
                        disabled={savingId === selectedCategory.id}
                      >
                        {savingId === selectedCategory.id ? "Saving..." : "Save changes"}
                      </AdminButton>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminField label="Name">
                      <AdminInput
                        value={selectedCategory.name}
                        onChange={(event) => updateSelected({ name: event.target.value })}
                      />
                    </AdminField>
                    <AdminField label="Handle">
                      <AdminInput
                        value={selectedCategory.handle}
                        onChange={(event) => updateSelected({ handle: event.target.value })}
                      />
                    </AdminField>
                    <AdminField label="Parent" optional="optional">
                      <AdminSelect
                        value={selectedCategory.parentId ?? ""}
                        onChange={(event) =>
                          updateSelected({ parentId: event.target.value || null })
                        }
                      >
                        <option value="">No parent (top level)</option>
                        {topLevel
                          .filter((category) => category.id !== selectedCategory.id)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </AdminSelect>
                    </AdminField>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Metadata
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div>Created: {new Date(selectedCategory.createdAt).toLocaleDateString("de-DE")}</div>
                        <div>Updated: {new Date(selectedCategory.updatedAt).toLocaleDateString("de-DE")}</div>
                        <div>Children: {childMap.get(selectedCategory.id)?.length ?? 0}</div>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <AdminField label="Description" optional="optional">
                        <AdminTextarea
                          rows={5}
                          value={selectedCategory.description ?? ""}
                          onChange={(event) =>
                            updateSelected({ description: event.target.value })
                          }
                          placeholder="Internal note or shopper-facing summary"
                        />
                      </AdminField>
                    </div>
                  </div>
                </div>
              ) : (
                <AdminEmptyState
                  title="No category selected"
                  description="Select a category from the tree to edit it."
                />
              )}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminDialog
        open={Boolean(deleteTarget)}
        title="Delete category?"
        description="This permanently removes the category. Enter your admin password to confirm."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <AdminButton tone="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              tone="danger"
              onClick={async () => {
                const adminPassword = deletePassword.trim();
                if (!adminPassword) {
                  setDeletePasswordError("Enter your admin password.");
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
            >
              Delete category
            </AdminButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            {deleteTarget?.name}
          </div>
          <AdminInput
            type="password"
            value={deletePassword}
            onChange={(event) => {
              setDeletePassword(event.target.value);
              if (deletePasswordError) setDeletePasswordError("");
            }}
            placeholder="Admin password"
          />
          {deletePasswordError ? (
            <div className="text-xs text-red-300">{deletePasswordError}</div>
          ) : null}
        </div>
      </AdminDialog>
    </div>
  );
}
