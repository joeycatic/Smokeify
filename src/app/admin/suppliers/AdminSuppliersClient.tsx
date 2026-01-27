"use client";

import { useEffect, useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import AdminBackButton from "@/components/admin/AdminBackButton";

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  leadTimeDays: number | null;
  createdAt: string;
  updatedAt: string;
};

const isValidWebsite = (value: string) =>
  !value || /^https?:\/\//i.test(value);

const normalizeLeadTime = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null as number | null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, value: null as number | null };
  }
  return { ok: true, value: Math.floor(parsed) };
};

export default function AdminSuppliersClient() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    notes: "",
    leadTimeDays: "",
  });
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/suppliers", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load suppliers.");
        return;
      }
      const data = (await res.json()) as { suppliers?: Supplier[] };
      setSuppliers(data.suppliers ?? []);
    } catch {
      setError("Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const totalSuppliers = useMemo(() => suppliers.length, [suppliers]);

  const resetForm = () => {
    setNewSupplier({
      name: "",
      contactName: "",
      email: "",
      phone: "",
      website: "",
      notes: "",
      leadTimeDays: "",
    });
  };

  const createSupplier = async () => {
    setError("");
    setNotice("");
    const name = newSupplier.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    if (!isValidWebsite(newSupplier.website.trim())) {
      setError("Website must be a valid http(s) link.");
      return;
    }
    const leadTimeResult = normalizeLeadTime(newSupplier.leadTimeDays);
    if (!leadTimeResult.ok) {
      setError("Lead time must be a non-negative number.");
      return;
    }
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactName: newSupplier.contactName.trim() || null,
          email: newSupplier.email.trim() || null,
          phone: newSupplier.phone.trim() || null,
          website: newSupplier.website.trim() || null,
          notes: newSupplier.notes.trim() || null,
          leadTimeDays: leadTimeResult.value,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create supplier.");
        return;
      }
      const data = (await res.json()) as { supplier?: Supplier };
      if (data.supplier) {
        setSuppliers((prev) => [data.supplier!, ...prev]);
      } else {
        await loadSuppliers();
      }
      resetForm();
      setNotice("Supplier created.");
    } catch {
      setError("Failed to create supplier.");
    }
  };

  const updateSupplier = async (supplier: Supplier) => {
    setError("");
    setNotice("");
    const name = supplier.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    if (!isValidWebsite(supplier.website?.trim() || "")) {
      setError("Website must be a valid http(s) link.");
      return;
    }
    if (
      supplier.leadTimeDays !== null &&
      (!Number.isFinite(supplier.leadTimeDays) || supplier.leadTimeDays < 0)
    ) {
      setError("Lead time must be a non-negative number.");
      return;
    }
    const leadTimeDays =
      supplier.leadTimeDays === null
        ? null
        : Math.floor(supplier.leadTimeDays);
    setSavingId(supplier.id);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactName: supplier.contactName?.trim() || null,
          email: supplier.email?.trim() || null,
          phone: supplier.phone?.trim() || null,
          website: supplier.website?.trim() || null,
          notes: supplier.notes?.trim() || null,
          leadTimeDays,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update supplier.");
        return;
      }
      const data = (await res.json()) as { supplier?: Supplier };
      if (data.supplier) {
        setSuppliers((prev) =>
          prev.map((item) => (item.id === supplier.id ? data.supplier! : item))
        );
      } else {
        await loadSuppliers();
      }
      setNotice("Supplier updated.");
    } catch {
      setError("Failed to update supplier.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteSupplier = async (id: string) => {
    setError("");
    setNotice("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to delete supplier.");
        return;
      }
      setSuppliers((prev) => prev.filter((item) => item.id !== id));
      setNotice("Supplier deleted.");
    } catch {
      setError("Failed to delete supplier.");
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
              ADMIN / SUPPLIERS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Supplier CRM</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {totalSuppliers} suppliers
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <AdminBackButton
              inline
              showOnSuppliers
              className="h-9 px-4 text-sm text-[#2f3e36] hover:bg-emerald-50"
            />
            <button
              type="button"
              onClick={loadSuppliers}
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              01
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                New supplier
              </p>
              <p className="text-xs text-stone-500">
                Keep supplier contact details in one place.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Supplier name
            <input
              value={newSupplier.name}
              onChange={(event) =>
                setNewSupplier((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="e.g. GreenGrow Logistics"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Primary contact
            <input
              value={newSupplier.contactName}
              onChange={(event) =>
                setNewSupplier((prev) => ({
                  ...prev,
                  contactName: event.target.value,
                }))
              }
              placeholder="e.g. Jamie Fischer"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Email
            <input
              value={newSupplier.email}
              onChange={(event) =>
                setNewSupplier((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="ops@greengrow.de"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Phone
            <input
              value={newSupplier.phone}
              onChange={(event) =>
                setNewSupplier((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="+49 30 1234567"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Website
            <input
              value={newSupplier.website}
              onChange={(event) =>
                setNewSupplier((prev) => ({
                  ...prev,
                  website: event.target.value,
                }))
              }
              placeholder="https://greengrow.de"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Lead time (days)
            <input
              type="number"
              min={0}
              step={1}
              value={newSupplier.leadTimeDays}
              onChange={(event) =>
                setNewSupplier((prev) => ({
                  ...prev,
                  leadTimeDays: event.target.value,
                }))
              }
              placeholder="e.g. 7"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600 md:col-span-2">
            Notes
            <input
              value={newSupplier.notes}
              onChange={(event) =>
                setNewSupplier((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Delivery days, MOQ, pricing notes..."
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={createSupplier}
            className="h-10 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
          >
            Create supplier
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
                Supplier list
              </p>
              <p className="text-xs text-stone-500">
                Edit contact details or remove suppliers.
              </p>
            </div>
          </div>
          <div className="text-xs text-stone-500">
            {suppliers.length ? `${suppliers.length} total` : "No suppliers yet"}
          </div>
        </div>
        {suppliers.length === 0 ? (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-6 text-sm text-stone-500">
            No suppliers added yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="rounded-xl border border-amber-200/70 bg-white p-4"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-semibold text-stone-600">
                    Supplier name
                    <input
                      value={supplier.name}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((row) =>
                            row.id === supplier.id
                              ? { ...row, name: event.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Primary contact
                    <input
                      value={supplier.contactName ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((row) =>
                            row.id === supplier.id
                              ? { ...row, contactName: event.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Email
                    <input
                      value={supplier.email ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((row) =>
                            row.id === supplier.id
                              ? { ...row, email: event.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Phone
                    <input
                      value={supplier.phone ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((row) =>
                            row.id === supplier.id
                              ? { ...row, phone: event.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Website
                    <input
                      value={supplier.website ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((row) =>
                            row.id === supplier.id
                              ? { ...row, website: event.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600">
                    Lead time (days)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={supplier.leadTimeDays ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((row) =>
                            row.id === supplier.id
                              ? {
                                  ...row,
                                  leadTimeDays:
                                    event.target.value === ""
                                      ? null
                                      : Number(event.target.value),
                                }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-600 md:col-span-2">
                    Notes
                    <input
                      value={supplier.notes ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((row) =>
                            row.id === supplier.id
                              ? { ...row, notes: event.target.value }
                              : row
                          )
                        )
                      }
                      className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => updateSupplier(supplier)}
                    className="h-10 rounded-md border border-amber-200 px-4 text-xs font-semibold text-amber-700 hover:border-amber-300"
                    disabled={savingId === supplier.id}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSupplier(supplier.id)}
                    className="h-10 rounded-md border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700"
                    disabled={savingId === supplier.id}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
