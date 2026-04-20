"use client";

import { useEffect, useMemo, useState } from "react";
import { HorizontalBarsChart, type AdminChartPoint } from "@/components/admin/AdminCharts";

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
  productCount: number;
  activeProductCount: number;
  lowStockProductCount: number;
};

const isValidWebsite = (value: string) => !value || /^https?:\/\//i.test(value);

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
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");
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

  const filteredSuppliers = useMemo(() => {
    if (!query.trim()) return suppliers;
    const normalized = query.trim().toLowerCase();
    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.contactName ?? "",
        supplier.email ?? "",
        supplier.phone ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, suppliers]);

  const totalSuppliers = suppliers.length;
  const averageLeadTime = useMemo(() => {
    const values = suppliers
      .map((supplier) => supplier.leadTimeDays)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [suppliers]);
  const totalProducts = useMemo(
    () => suppliers.reduce((sum, supplier) => sum + supplier.productCount, 0),
    [suppliers]
  );
  const totalLowStockProducts = useMemo(
    () => suppliers.reduce((sum, supplier) => sum + supplier.lowStockProductCount, 0),
    [suppliers]
  );

  const supplierBars = useMemo<AdminChartPoint[]>(
    () =>
      [...suppliers]
        .sort((a, b) => b.productCount - a.productCount)
        .slice(0, 6)
        .map((supplier) => ({
          label: supplier.name,
          value: supplier.productCount,
          secondaryValue: supplier.lowStockProductCount,
        })),
    [suppliers]
  );

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
      resetForm();
      setNotice("Supplier created.");
      await loadSuppliers();
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
          leadTimeDays:
            supplier.leadTimeDays === null ? null : Math.floor(supplier.leadTimeDays),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update supplier.");
        return;
      }
      setNotice("Supplier updated.");
      await loadSuppliers();
    } catch {
      setError("Failed to update supplier.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteSupplier = async (id: string, adminPassword: string) => {
    setError("");
    setNotice("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to delete supplier.");
        return;
      }
      setNotice("Supplier deleted.");
      await loadSuppliers();
    } catch {
      setError("Failed to delete supplier.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Suppliers
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Supplier CRM and exposure overview
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Contact maintenance, lead time visibility, supplier exposure, and
              stock pressure across catalog relationships.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSuppliers}
            className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh suppliers"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Suppliers" value={String(totalSuppliers)} />
          <MetricCard label="Catalog products" value={String(totalProducts)} />
          <MetricCard label="Avg. lead time" value={`${averageLeadTime} days`} />
          <MetricCard label="Low-stock products" value={String(totalLowStockProducts)} />
        </div>
      </section>

      {(error || notice) ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-red-500/20 bg-red-500/10 text-red-200"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || notice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          eyebrow="Exposure"
          title="Supplier footprint"
          description="Largest suppliers by attached catalog products."
        >
          <HorizontalBarsChart
            data={supplierBars}
            colorClassName="bg-cyan-400"
            valueFormatter={(value) => `${value} products`}
          />
        </Panel>

        <Panel
          eyebrow="Create"
          title="New supplier"
          description="Create supplier records with contact and delivery details."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Supplier name">
              <input
                value={newSupplier.name}
                onChange={(event) =>
                  setNewSupplier((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. GreenGrow Logistics"
                className={inputClass}
              />
            </Field>
            <Field label="Primary contact">
              <input
                value={newSupplier.contactName}
                onChange={(event) =>
                  setNewSupplier((prev) => ({
                    ...prev,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Jamie Fischer"
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                value={newSupplier.email}
                onChange={(event) =>
                  setNewSupplier((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="ops@example.com"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                value={newSupplier.phone}
                onChange={(event) =>
                  setNewSupplier((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="+49 30 1234567"
                className={inputClass}
              />
            </Field>
            <Field label="Website">
              <input
                value={newSupplier.website}
                onChange={(event) =>
                  setNewSupplier((prev) => ({ ...prev, website: event.target.value }))
                }
                placeholder="https://supplier.example"
                className={inputClass}
              />
            </Field>
            <Field label="Lead time (days)">
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
                placeholder="7"
                className={inputClass}
              />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <textarea
                value={newSupplier.notes}
                onChange={(event) =>
                  setNewSupplier((prev) => ({ ...prev, notes: event.target.value }))
                }
                rows={3}
                placeholder="MOQ, shipping terms, pricing notes..."
                className={`${inputClass} min-h-[96px] py-3`}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createSupplier}
              className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#05070a]"
            >
              Create supplier
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
            >
              Reset
            </button>
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Directory"
        title="Supplier records"
        description="Search, update, and remove supplier records with catalog context."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search suppliers by name, email, contact..."
            className="h-10 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20 sm:min-w-[260px]"
          />
          <span className="text-xs text-slate-500">
            {filteredSuppliers.length} suppliers
          </span>
        </div>

        <div className="grid gap-4">
          {filteredSuppliers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
              No suppliers found.
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="rounded-[24px] border border-white/10 bg-[#090d12] p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{supplier.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-300">
                        {supplier.productCount} products
                      </span>
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                        {supplier.activeProductCount} active
                      </span>
                      <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-300">
                        {supplier.lowStockProductCount} low stock
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Updated {new Date(supplier.updatedAt).toLocaleDateString("de-DE")}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Supplier name">
                    <input
                      value={supplier.name}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((item) =>
                            item.id === supplier.id
                              ? { ...item, name: event.target.value }
                              : item
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Primary contact">
                    <input
                      value={supplier.contactName ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((item) =>
                            item.id === supplier.id
                              ? { ...item, contactName: event.target.value }
                              : item
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      value={supplier.email ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((item) =>
                            item.id === supplier.id
                              ? { ...item, email: event.target.value }
                              : item
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={supplier.phone ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((item) =>
                            item.id === supplier.id
                              ? { ...item, phone: event.target.value }
                              : item
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Website">
                    <input
                      value={supplier.website ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((item) =>
                            item.id === supplier.id
                              ? { ...item, website: event.target.value }
                              : item
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Lead time (days)">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={supplier.leadTimeDays ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((item) =>
                            item.id === supplier.id
                              ? {
                                  ...item,
                                  leadTimeDays:
                                    event.target.value === ""
                                      ? null
                                      : Number(event.target.value),
                                }
                              : item
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Notes" className="md:col-span-2">
                    <textarea
                      value={supplier.notes ?? ""}
                      onChange={(event) =>
                        setSuppliers((prev) =>
                          prev.map((item) =>
                            item.id === supplier.id
                              ? { ...item, notes: event.target.value }
                              : item
                          )
                        )
                      }
                      rows={3}
                      className={`${inputClass} min-h-[96px] py-3`}
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void updateSupplier(supplier)}
                    disabled={savingId === supplier.id}
                    className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#05070a] disabled:opacity-60"
                  >
                    {savingId === supplier.id ? "Saving..." : "Save supplier"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePassword("");
                      setDeletePasswordError("");
                      setDeleteTarget({ id: supplier.id, name: supplier.name });
                    }}
                    className="inline-flex h-10 items-center rounded-full border border-red-400/20 bg-red-400/10 px-4 text-sm font-semibold text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-3 sm:items-center sm:px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setDeleteTarget(null)}
            aria-label="Close dialog"
          />
          <div className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[24px] border border-white/10 bg-[#0a0d12] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:rounded-[28px] sm:p-6">
            <h3 className="text-lg font-semibold text-white">Delete supplier?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This will permanently delete <span className="font-semibold text-slate-100">{deleteTarget.name}</span>.
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(event) => {
                setDeletePassword(event.target.value);
                if (deletePasswordError) setDeletePasswordError("");
              }}
              placeholder="Admin password"
              className="mt-4 h-10 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            {deletePasswordError ? (
              <p className="mt-2 text-xs text-red-300">{deletePasswordError}</p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
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
                  if (!target) return;
                  await deleteSupplier(target.id, adminPassword);
                }}
                className="inline-flex h-10 items-center rounded-full bg-red-500 px-4 text-sm font-semibold text-white"
              >
                Delete supplier
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500";

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs font-semibold text-slate-400 ${className}`}>
      {label}
      {children}
    </label>
  );
}
