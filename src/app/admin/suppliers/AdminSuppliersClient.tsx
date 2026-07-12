"use client";

import { useEffect, useMemo, useState } from "react";
import { HorizontalBarsChart, type AdminChartPoint } from "@/components/admin/AdminCharts";
import {
  AdminKpiStrip,
  AdminPage,
  AdminPageHeader,
  AdminSplitView,
  AdminStat,
} from "@/components/admin/ui";

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
  openPurchaseOrderCount: number;
  latePurchaseOrderCount: number;
  lastReceiptAt: string | null;
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

export default function AdminSuppliersClient({
  initialSearchQuery = "",
}: {
  initialSearchQuery?: string;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState(initialSearchQuery);
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
    let active = true;

    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/suppliers", { method: "GET" });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          if (active) {
            setError(data.error ?? "Failed to load suppliers.");
          }
          return;
        }
        const data = (await res.json()) as { suppliers?: Supplier[] };
        if (active) {
          setSuppliers(data.suppliers ?? []);
        }
      } catch {
        if (active) {
          setError("Failed to load suppliers.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
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
  const totalOpenPurchaseOrders = useMemo(
    () => suppliers.reduce((sum, supplier) => sum + supplier.openPurchaseOrderCount, 0),
    [suppliers]
  );
  const totalLatePurchaseOrders = useMemo(
    () => suppliers.reduce((sum, supplier) => sum + supplier.latePurchaseOrderCount, 0),
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
    <AdminPage layout="master-detail">
      <AdminPageHeader
        eyebrow="Admin / Suppliers"
        title="Supplier records"
        description="Contact maintenance, lead-time visibility, catalog exposure, and stock pressure."
        actions={
          <button
            type="button"
            onClick={loadSuppliers}
            className="inline-flex h-8 items-center rounded-[10px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-[13px] font-semibold text-[var(--adm-text)] transition hover:bg-[var(--adm-surface-2)]"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh suppliers"}
          </button>
        }
      >
        <AdminKpiStrip>
          <AdminStat label="Suppliers" value={totalSuppliers} />
          <AdminStat label="Catalog products" value={totalProducts} />
          <AdminStat label="Avg. lead time" value={`${averageLeadTime}d`} />
          <AdminStat label="Low stock" value={totalLowStockProducts} />
          <AdminStat label="Open POs" value={totalOpenPurchaseOrders} />
          <AdminStat label="Late POs" value={totalLatePurchaseOrders} deltaTone="error" />
        </AdminKpiStrip>
      </AdminPageHeader>

      {(error || notice) ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-red-500/20 bg-[#fae7e3] text-[var(--adm-error)]"
              : "border-emerald-500/20 bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
          }`}
        >
          {error || notice}
        </div>
      ) : null}

      <AdminSplitView>
        <Panel
          eyebrow="Exposure"
          title="Supplier footprint"
          description="Largest suppliers by attached catalog products."
        >
          <HorizontalBarsChart
            data={supplierBars}
            colorClassName="bg-[var(--adm-primary)]"
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
              className="inline-flex h-8 items-center rounded-full bg-cyan-300 px-4 text-sm font-semibold text-white"
            >
              Create supplier
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-8 items-center rounded-full border border-[var(--adm-border)] px-4 text-sm font-semibold text-[var(--adm-text-muted)]"
            >
              Reset
            </button>
          </div>
        </Panel>
      </AdminSplitView>

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
            className="h-8 min-w-0 flex-1 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)] focus:border-[var(--adm-border-strong)] sm:min-w-[260px]"
          />
          <span className="text-xs text-[var(--adm-text-faint)]">
            {filteredSuppliers.length} suppliers
          </span>
        </div>

        <div className="grid gap-4">
          {filteredSuppliers.length === 0 ? (
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-6 text-sm text-[var(--adm-text-faint)]">
              No suppliers found.
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--adm-text)]">{supplier.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full bg-[var(--adm-primary-soft)] px-2.5 py-1 text-[var(--adm-primary)]">
                        {supplier.productCount} products
                      </span>
                      <span className="rounded-full bg-[var(--adm-primary-soft)] px-2.5 py-1 text-[var(--adm-success)]">
                        {supplier.activeProductCount} active
                      </span>
                      <span className="rounded-full bg-[#fff4dd] px-2.5 py-1 text-[#81560e]">
                        {supplier.lowStockProductCount} low stock
                      </span>
                      <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-sky-300">
                        {supplier.openPurchaseOrderCount} open POs
                      </span>
                      <span className="rounded-full bg-[#fae7e3] px-2.5 py-1 text-[var(--adm-error)]">
                        {supplier.latePurchaseOrderCount} late
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[var(--adm-text-faint)]">
                      Last receipt{" "}
                      {supplier.lastReceiptAt
                        ? new Date(supplier.lastReceiptAt).toLocaleDateString("de-DE")
                        : "—"}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--adm-text-faint)]">
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
                    className="inline-flex h-8 items-center rounded-full bg-cyan-300 px-4 text-sm font-semibold text-white disabled:opacity-60"
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
                    className="inline-flex h-8 items-center rounded-full border border-[var(--adm-error)] bg-[#fae7e3] px-4 text-sm font-semibold text-[var(--adm-error)]"
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
          <div className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:rounded-xl sm:p-6">
            <h3 className="text-lg font-semibold text-[var(--adm-text)]">Delete supplier?</h3>
            <p className="mt-2 text-sm text-[var(--adm-text-muted)]">
              This will permanently delete <span className="font-semibold text-[var(--adm-text)]">{deleteTarget.name}</span>.
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(event) => {
                setDeletePassword(event.target.value);
                if (deletePasswordError) setDeletePasswordError("");
              }}
              placeholder="Admin password"
              className="mt-4 h-8 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)]"
            />
            {deletePasswordError ? (
              <p className="mt-2 text-xs text-[var(--adm-error)]">{deletePasswordError}</p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="inline-flex h-8 items-center rounded-full border border-[var(--adm-border)] px-4 text-sm font-semibold text-[var(--adm-text-muted)]"
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
                className="inline-flex h-8 items-center rounded-full bg-red-500 px-4 text-sm font-semibold text-[var(--adm-text)]"
              >
                Delete supplier
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-2.5 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)]";

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
    <section className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--adm-text-faint)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[var(--adm-text)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--adm-text-muted)]">{description}</p>
      </div>
      {children}
    </section>
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
    <label className={`block text-xs font-semibold text-[var(--adm-text-muted)] ${className}`}>
      {label}
      {children}
    </label>
  );
}
