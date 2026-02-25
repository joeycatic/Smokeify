"use client";

import { useEffect, useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type Collection = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminCollectionsClient() {
  const [collections, setCollections] = useState<Collection[]>([]);
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
  const [newCollection, setNewCollection] = useState({
    name: "",
    handle: "",
    description: "",
  });

  const loadCollections = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/collections", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load collections.");
        return;
      }
      const data = (await res.json()) as { collections?: Collection[] };
      setCollections(data.collections ?? []);
    } catch {
      setError("Failed to load collections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCollections();
  }, []);

  const totalCollections = useMemo(() => collections.length, [collections]);

  const resetForm = () => {
    setNewCollection({ name: "", handle: "", description: "" });
  };

  const createCollection = async () => {
    setError("");
    setNotice("");
    const name = newCollection.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    try {
      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          handle: newCollection.handle.trim() || undefined,
          description: newCollection.description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create collection.");
        return;
      }
      const data = (await res.json()) as { collection?: Collection };
      if (data.collection) {
        setCollections((prev) =>
          [...prev, data.collection!].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
      } else {
        await loadCollections();
      }
      resetForm();
      setNotice("Collection created.");
    } catch {
      setError("Failed to create collection.");
    }
  };

  const updateCollection = async (collection: Collection) => {
    setError("");
    setNotice("");
    const name = collection.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setSavingId(collection.id);
    try {
      const res = await fetch(`/api/admin/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          handle: collection.handle.trim() || undefined,
          description: collection.description?.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update collection.");
        return;
      }
      const data = (await res.json()) as { collection?: Collection };
      if (data.collection) {
        setCollections((prev) =>
          prev
            .map((item) =>
              item.id === collection.id ? data.collection! : item
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        await loadCollections();
      }
      setNotice("Collection updated.");
    } catch {
      setError("Failed to update collection.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteCollection = async (id: string, adminPassword: string) => {
    setError("");
    setNotice("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/collections/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to delete collection.");
        return;
      }
      setCollections((prev) => prev.filter((item) => item.id !== id));
      setNotice("Collection deleted.");
    } catch {
      setError("Failed to delete collection.");
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
              ADMIN / COLLECTIONS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Collections</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {totalCollections} collections
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <button
              type="button"
              onClick={loadCollections}
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
              New collection
            </p>
            <p className="text-xs text-stone-500">
              Group products into thematic collections.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Name
            <input
              value={newCollection.name}
              onChange={(e) =>
                setNewCollection((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. Summer Specials"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Handle{" "}
            <span className="font-normal text-stone-400">(optional — auto-generated)</span>
            <input
              value={newCollection.handle}
              onChange={(e) =>
                setNewCollection((prev) => ({ ...prev, handle: e.target.value }))
              }
              placeholder="summer-specials"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600 sm:col-span-2">
            Description{" "}
            <span className="font-normal text-stone-400">(optional)</span>
            <input
              value={newCollection.description}
              onChange={(e) =>
                setNewCollection((prev) => ({
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
            onClick={createCollection}
            className="h-10 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
          >
            Create collection
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
                Collection list
              </p>
              <p className="text-xs text-stone-500">
                Edit or remove existing collections.
              </p>
            </div>
          </div>
          <div className="text-xs text-stone-500">
            {collections.length
              ? `${collections.length} total`
              : "No collections yet"}
          </div>
        </div>
        {collections.length === 0 ? (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-6 text-sm text-stone-500">
            No collections added yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="rounded-xl border border-amber-200/70 bg-white p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-stone-600">
                    Name
                    <input
                      value={collection.name}
                      onChange={(e) =>
                        setCollections((prev) =>
                          prev.map((row) =>
                            row.id === collection.id
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
                      value={collection.handle}
                      onChange={(e) =>
                        setCollections((prev) =>
                          prev.map((row) =>
                            row.id === collection.id
                              ? { ...row, handle: e.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm font-mono text-xs"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600 sm:col-span-2">
                    Description
                    <input
                      value={collection.description ?? ""}
                      onChange={(e) =>
                        setCollections((prev) =>
                          prev.map((row) =>
                            row.id === collection.id
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
                  <span className="text-xs text-stone-400">
                    ID: {collection.id}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateCollection(collection)}
                      disabled={savingId === collection.id}
                      className="h-9 rounded-md border border-amber-200 px-4 text-xs font-semibold text-amber-700 hover:border-amber-300 disabled:opacity-50"
                    >
                      {savingId === collection.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletePassword("");
                        setDeletePasswordError("");
                        setDeleteTarget({
                          id: collection.id,
                          name: collection.name,
                        });
                      }}
                      disabled={savingId === collection.id}
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
              Collection löschen?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Die Collection wird dauerhaft gelöscht. Diese Aktion kann nicht
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
                    await deleteCollection(target.id, adminPassword);
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
