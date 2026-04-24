"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminButton,
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

type PurchaseOrderListItem = {
  id: string;
  purchaseOrderNumber: number;
  supplierId: string;
  supplierName: string;
  status: "DRAFT" | "SUBMITTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELED";
  reference: string | null;
  note: string | null;
  expectedDeliveryAt: string | null;
  submittedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  orderedUnits: number;
  receivedUnits: number;
  openUnits: number;
};

type SupplierSummary = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  leadTimeDays: number | null;
  openPurchaseOrderCount: number;
  latePurchaseOrderCount: number;
  lastReceiptAt: string | null;
};

type VariantOption = {
  productId: string;
  productTitle: string;
  supplierId: string | null;
  supplierName: string | null;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  costCents: number;
};

type DraftLine = {
  variantId: string;
  orderedQuantity: string;
  unitCostCents: string;
  note: string;
};

type Props = {
  purchaseOrders: PurchaseOrderListItem[];
  suppliers: SupplierSummary[];
  userRole: string;
  variantOptions: VariantOption[];
};

const STATUS_TONE: Record<PurchaseOrderListItem["status"], string> = {
  DRAFT: "border-white/10 bg-white/[0.05] text-slate-200",
  SUBMITTED: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
  PARTIALLY_RECEIVED: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  RECEIVED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  CANCELED: "border-red-400/20 bg-red-400/10 text-red-200",
};

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function createEmptyLine(): DraftLine {
  return {
    variantId: "",
    orderedQuantity: "1",
    unitCostCents: "0",
    note: "",
  };
}

function getVariantLabel(option: VariantOption) {
  const parts = [option.productTitle, option.variantTitle];
  if (option.sku) parts.push(`SKU ${option.sku}`);
  return parts.filter(Boolean).join(" · ");
}

export default function AdminProcurementClient({
  purchaseOrders,
  suppliers,
  userRole,
  variantOptions,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    supplierId: suppliers[0]?.id ?? "",
    reference: "",
    note: "",
    expectedDeliveryAt: "",
    lines: [createEmptyLine()],
  });

  const supplierVariantOptions = useMemo(() => {
    if (!form.supplierId) return variantOptions;
    return variantOptions.filter((option) => option.supplierId === form.supplierId);
  }, [form.supplierId, variantOptions]);

  const filteredPurchaseOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return purchaseOrders;
    return purchaseOrders.filter((purchaseOrder) =>
      [
        purchaseOrder.purchaseOrderNumber,
        purchaseOrder.supplierName,
        purchaseOrder.reference ?? "",
        purchaseOrder.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [purchaseOrders, query]);

  const openPurchaseOrderCount = purchaseOrders.filter(
    (purchaseOrder) =>
      purchaseOrder.status === "SUBMITTED" ||
      purchaseOrder.status === "PARTIALLY_RECEIVED",
  ).length;
  const latePurchaseOrderCount = suppliers.reduce(
    (sum, supplier) => sum + supplier.latePurchaseOrderCount,
    0,
  );
  const totalOpenUnits = purchaseOrders.reduce(
    (sum, purchaseOrder) => sum + purchaseOrder.openUnits,
    0,
  );

  const updateLine = (index: number, nextLine: DraftLine) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? nextLine : line)),
    }));
  };

  const handleVariantChange = (index: number, variantId: string) => {
    const option = variantOptions.find((entry) => entry.variantId === variantId);
    updateLine(index, {
      ...form.lines[index],
      variantId,
      unitCostCents: option ? String(option.costCents) : form.lines[index]?.unitCostCents ?? "0",
    });
  };

  const createPurchaseOrder = async () => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const items = form.lines.map((line) => {
        const option = variantOptions.find((entry) => entry.variantId === line.variantId);
        if (!option) {
          throw new Error("Each line needs a valid variant.");
        }
        return {
          productId: option.productId,
          variantId: option.variantId,
          orderedQuantity: Number(line.orderedQuantity),
          unitCostCents: Number(line.unitCostCents),
          note: line.note.trim() || null,
        };
      });

      const response = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          reference: form.reference.trim() || null,
          note: form.note.trim() || null,
          expectedDeliveryAt: form.expectedDeliveryAt || null,
          items,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        purchaseOrder?: { id: string };
      };
      if (!response.ok || !data.purchaseOrder) {
        throw new Error(data.error ?? "Failed to create purchase order.");
      }

      setNotice("Purchase order created.");
      router.push(`/admin/procurement/${data.purchaseOrder.id}`);
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create purchase order.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Procurement"
        title="Purchase orders and receiving"
        description="Draft supplier orders, move them into receiving, and track open inbound stock against the live catalog."
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Purchase orders" value={String(purchaseOrders.length)} />
            <AdminMetricCard label="Open POs" value={String(openPurchaseOrderCount)} />
            <AdminMetricCard label="Late POs" value={String(latePurchaseOrderCount)} />
            <AdminMetricCard label="Open units" value={String(totalOpenUnits)} />
          </div>
        }
        actions={
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
            {userRole} access
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminPanel
          eyebrow="Create"
          title="New purchase order"
          description="Draft against existing supplier-linked variants. Submitted orders lock supplier and line composition."
          actions={
            <AdminButton onClick={createPurchaseOrder} disabled={saving}>
              {saving ? "Creating..." : "Create draft"}
            </AdminButton>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="Supplier">
              <AdminSelect
                value={form.supplierId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplierId: event.target.value,
                    lines: current.lines.map((line) => {
                      const matchesSupplier = variantOptions.find(
                        (option) =>
                          option.variantId === line.variantId &&
                          option.supplierId === event.target.value,
                      );
                      return matchesSupplier ? line : createEmptyLine();
                    }),
                  }))
                }
              >
                <option value="">Choose supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Expected delivery" optional="optional">
              <AdminInput
                type="datetime-local"
                value={form.expectedDeliveryAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expectedDeliveryAt: event.target.value,
                  }))
                }
              />
            </AdminField>
            <AdminField label="Reference" optional="optional">
              <AdminInput
                value={form.reference}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reference: event.target.value }))
                }
                placeholder="Supplier ref, quote, invoice link..."
              />
            </AdminField>
            <AdminField label="Ops note" optional="optional">
              <AdminInput
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="Receiving note, MOQ, freight context..."
              />
            </AdminField>
          </div>

          <div className="mt-5 space-y-3">
            {form.lines.map((line, index) => (
              <div
                key={`draft-line-${index}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="grid gap-3 lg:grid-cols-[2.2fr_0.8fr_0.9fr_auto]">
                  <AdminField label={`Line ${index + 1}`}>
                    <AdminSelect
                      value={line.variantId}
                      onChange={(event) => handleVariantChange(index, event.target.value)}
                    >
                      <option value="">Choose variant</option>
                      {supplierVariantOptions.map((option) => (
                        <option key={option.variantId} value={option.variantId}>
                          {getVariantLabel(option)}
                        </option>
                      ))}
                    </AdminSelect>
                  </AdminField>
                  <AdminField label="Qty">
                    <AdminInput
                      type="number"
                      min={1}
                      step={1}
                      value={line.orderedQuantity}
                      onChange={(event) =>
                        updateLine(index, {
                          ...line,
                          orderedQuantity: event.target.value,
                        })
                      }
                    />
                  </AdminField>
                  <AdminField label="Unit cost (cents)">
                    <AdminInput
                      type="number"
                      min={0}
                      step={1}
                      value={line.unitCostCents}
                      onChange={(event) =>
                        updateLine(index, {
                          ...line,
                          unitCostCents: event.target.value,
                        })
                      }
                    />
                  </AdminField>
                  <div className="flex items-end">
                    <AdminButton
                      tone="secondary"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          lines:
                            current.lines.length === 1
                              ? [createEmptyLine()]
                              : current.lines.filter((_, lineIndex) => lineIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </AdminButton>
                  </div>
                </div>
                <div className="mt-3">
                  <AdminField label="Line note" optional="optional">
                    <AdminTextarea
                      value={line.note}
                      onChange={(event) =>
                        updateLine(index, {
                          ...line,
                          note: event.target.value,
                        })
                      }
                      rows={2}
                      placeholder="MOQ, case pack, replacement SKU, customs note..."
                    />
                  </AdminField>
                </div>
              </div>
            ))}

            <AdminButton
              tone="secondary"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  lines: [...current.lines, createEmptyLine()],
                }))
              }
            >
              Add line
            </AdminButton>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Suppliers"
          title="Inbound pressure"
          description="Late and open supplier pipelines so procurement issues are visible before receiving slips."
        >
          <div className="space-y-3">
            {suppliers.length === 0 ? (
              <AdminEmptyState
                title="No suppliers yet"
                description="Create a supplier record before drafting purchase orders."
              />
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{supplier.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {supplier.contactName || supplier.email || "No primary contact"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                        {supplier.openPurchaseOrderCount} open
                      </span>
                      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-amber-200">
                        {supplier.latePurchaseOrderCount} late
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <div>
                      Lead time:{" "}
                      {typeof supplier.leadTimeDays === "number"
                        ? `${supplier.leadTimeDays} days`
                        : "—"}
                    </div>
                    <div>Last receipt: {formatDate(supplier.lastReceiptAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        eyebrow="Directory"
        title="Purchase-order queue"
        description="Drafts stay editable. Submitted orders move into receiving and keep a full event trail."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <AdminInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by PO number, supplier, status, or reference"
            className="min-w-[280px] flex-1"
          />
          <div className="text-xs text-slate-500">{filteredPurchaseOrders.length} results</div>
        </div>

        <div className="space-y-3">
          {filteredPurchaseOrders.length === 0 ? (
            <AdminEmptyState
              title="No purchase orders found"
              description="Adjust the current search or create a new draft purchase order."
            />
          ) : (
            filteredPurchaseOrders.map((purchaseOrder) => (
              <Link
                key={purchaseOrder.id}
                href={`/admin/procurement/${purchaseOrder.id}`}
                className="block rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold text-white">
                        PO #{purchaseOrder.purchaseOrderNumber}
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${STATUS_TONE[purchaseOrder.status]}`}
                      >
                        {purchaseOrder.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {purchaseOrder.supplierName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {purchaseOrder.reference || "No reference"} · Updated{" "}
                      {formatDate(purchaseOrder.updatedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {purchaseOrder.receivedUnits}/{purchaseOrder.orderedUnits} units
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Open {purchaseOrder.openUnits} · Expected{" "}
                      {formatDate(purchaseOrder.expectedDeliveryAt)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                  <span>Submitted {formatDate(purchaseOrder.submittedAt)}</span>
                  <span>Received {formatDate(purchaseOrder.receivedAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
