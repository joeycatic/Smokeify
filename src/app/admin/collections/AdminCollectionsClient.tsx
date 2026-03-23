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
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";

type Collection = {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

const emptyForm = {
  name: "",
  handle: "",
  description: "",
};

export default function AdminCollectionsClient() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
  const [newCollection, setNewCollection] = useState(emptyForm);

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
      const rows = (data.collections ?? []).sort((a, b) => a.name.localeCompare(b.name));
      setCollections(rows);
      setSelectedId((prev) =>
        prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? null
      );
    } catch {
      setError("Failed to load collections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCollections();
  }, []);

  const selectedCollection =
    collections.find((collection) => collection.id === selectedId) ?? null;
  const recentlyUpdated = useMemo(
    () =>
      collections.filter((collection) => {
        const updatedAt = new Date(collection.updatedAt).getTime();
        return Date.now() - updatedAt < 1000 * 60 * 60 * 24 * 14;
      }).length,
    [collections]
  );

  const updateSelected = (patch: Partial<Collection>) => {
    if (!selectedCollection) return;
    setCollections((prev) =>
      prev.map((row) => (row.id === selectedCollection.id ? { ...row, ...patch } : row))
    );
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
        const next = [...collections, data.collection].sort((a, b) => a.name.localeCompare(b.name));
        setCollections(next);
        setSelectedId(data.collection.id);
      } else {
        await loadCollections();
      }
      setNewCollection(emptyForm);
      setNotice("Collection created.");
    } catch {
      setError("Failed to create collection.");
    }
  };

  const saveSelected = async () => {
    if (!selectedCollection) return;
    setError("");
    setNotice("");
    if (!selectedCollection.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSavingId(selectedCollection.id);
    try {
      const res = await fetch(`/api/admin/collections/${selectedCollection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedCollection.name.trim(),
          handle: selectedCollection.handle.trim() || undefined,
          description: selectedCollection.description?.trim() || null,
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
            .map((row) => (row.id === data.collection?.id ? data.collection : row))
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
    setSavingId(id);
    setError("");
    setNotice("");
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
      const next = collections.filter((row) => row.id !== id);
      setCollections(next);
      setSelectedId(next[0]?.id ?? null);
      setNotice("Collection deleted.");
    } catch {
      setError("Failed to delete collection.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Collections"
        title="Collection workspace"
        description="Manage curated merch groupings in a dedicated dark list/detail workspace instead of the old stacked CRUD page."
        actions={
          <AdminButton tone="secondary" onClick={() => void loadCollections()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
        metrics={
          <div className="grid gap-3 md:grid-cols-3">
            <AdminMetricCard label="Collections" value={String(collections.length)} detail="All curated groups" />
            <AdminMetricCard label="Recently touched" value={String(recentlyUpdated)} detail="Updated in 14 days" />
            <AdminMetricCard
              label="Selected"
              value={selectedCollection ? selectedCollection.name : "None"}
              detail="Current editor target"
            />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <AdminPanel
          eyebrow="Create"
          title="New collection"
          description="Create a merch collection for featured groups, promos, or campaign landing sets."
          className="admin-reveal-delay-1"
        >
          <div className="grid gap-4">
            <AdminField label="Name">
              <AdminInput
                value={newCollection.name}
                onChange={(event) =>
                  setNewCollection((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. New arrivals"
              />
            </AdminField>
            <AdminField label="Handle" optional="optional">
              <AdminInput
                value={newCollection.handle}
                onChange={(event) =>
                  setNewCollection((prev) => ({ ...prev, handle: event.target.value }))
                }
                placeholder="new-arrivals"
              />
            </AdminField>
            <AdminField label="Description" optional="optional">
              <AdminTextarea
                rows={4}
                value={newCollection.description}
                onChange={(event) =>
                  setNewCollection((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Short internal or storefront-facing summary"
              />
            </AdminField>
            <div className="flex flex-wrap gap-2">
              <AdminButton onClick={() => void createCollection()}>Create collection</AdminButton>
              <AdminButton tone="secondary" onClick={() => setNewCollection(emptyForm)}>
                Reset
              </AdminButton>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="List / Detail"
          title="Collection browser"
          description="Select a collection from the list, then edit its identity and description in the detail pane."
          className="admin-reveal-delay-2"
        >
          {collections.length === 0 ? (
            <AdminEmptyState
              title="No collections yet"
              description="Create the first collection to start curating product groupings."
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
              <div className="rounded-[24px] border border-white/10 bg-[#070a0f] p-3">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Collection list
                </div>
                <div className="space-y-2">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => setSelectedId(collection.id)}
                      className={`flex w-full flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${
                        selectedId === collection.id
                          ? "border-cyan-400/20 bg-cyan-400/10"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="font-semibold text-white">{collection.name}</span>
                      <span className="mt-1 text-xs text-slate-500">{collection.handle}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedCollection ? (
                <div className="rounded-[24px] border border-white/10 bg-[#070a0f] p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Selected collection
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {selectedCollection.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        Curated group editor
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <AdminButton
                        tone="secondary"
                        onClick={() =>
                          setDeleteTarget({
                            id: selectedCollection.id,
                            name: selectedCollection.name,
                          })
                        }
                        disabled={savingId === selectedCollection.id}
                      >
                        Delete
                      </AdminButton>
                      <AdminButton
                        onClick={() => void saveSelected()}
                        disabled={savingId === selectedCollection.id}
                      >
                        {savingId === selectedCollection.id ? "Saving..." : "Save changes"}
                      </AdminButton>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminField label="Name">
                      <AdminInput
                        value={selectedCollection.name}
                        onChange={(event) => updateSelected({ name: event.target.value })}
                      />
                    </AdminField>
                    <AdminField label="Handle">
                      <AdminInput
                        value={selectedCollection.handle}
                        onChange={(event) => updateSelected({ handle: event.target.value })}
                      />
                    </AdminField>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Metadata
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div>Created: {new Date(selectedCollection.createdAt).toLocaleDateString("de-DE")}</div>
                        <div>Updated: {new Date(selectedCollection.updatedAt).toLocaleDateString("de-DE")}</div>
                        <div className="space-y-1">
                          <div>ID:</div>
                          <div className="break-all rounded-xl border border-white/10 bg-[#050912] px-3 py-2 font-mono text-xs text-slate-300">
                            {selectedCollection.id}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <AdminField label="Description" optional="optional">
                        <AdminTextarea
                          rows={5}
                          value={selectedCollection.description ?? ""}
                          onChange={(event) =>
                            updateSelected({ description: event.target.value })
                          }
                          placeholder="What this collection is for, campaign context, or merch note"
                        />
                      </AdminField>
                    </div>
                  </div>
                </div>
              ) : (
                <AdminEmptyState
                  title="No collection selected"
                  description="Choose a collection from the list to edit its details."
                />
              )}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminDialog
        open={Boolean(deleteTarget)}
        title="Delete collection?"
        description="This permanently removes the collection. Enter your admin password to confirm."
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
                  await deleteCollection(target.id, adminPassword);
                }
              }}
            >
              Delete collection
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
