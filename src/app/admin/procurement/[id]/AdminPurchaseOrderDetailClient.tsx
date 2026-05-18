"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

type PurchaseOrderDetail = {
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
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    productTitle: string;
    variantTitle: string;
    skuSnapshot: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    openQuantity: number;
    unitCostCents: number;
    note: string | null;
  }>;
  receipts: Array<{
    id: string;
    note: string | null;
    receivedAt: string;
    createdByEmail: string | null;
    reversedAt: string | null;
    reversedByEmail: string | null;
    reversalNote: string | null;
    items: Array<{
      id: string;
      purchaseOrderItemId: string;
      quantityReceived: number;
      productTitle: string;
      variantTitle: string;
    }>;
  }>;
  events: Array<{
    id: string;
    actorEmail: string | null;
    eventType: string;
    summary: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

type DraftLine = {
  variantId: string;
  orderedQuantity: string;
  unitCostCents: string;
  note: string;
};

type Props = {
  purchaseOrder: PurchaseOrderDetail;
  suppliers: SupplierSummary[];
  userRole: string;
  variantOptions: VariantOption[];
};

const STATUS_TONE: Record<PurchaseOrderDetail["status"], string> = {
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

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount / 100);

function buildDraftState(purchaseOrder: PurchaseOrderDetail) {
  return {
    supplierId: purchaseOrder.supplierId,
    reference: purchaseOrder.reference ?? "",
    note: purchaseOrder.note ?? "",
    expectedDeliveryAt: purchaseOrder.expectedDeliveryAt
      ? purchaseOrder.expectedDeliveryAt.slice(0, 16)
      : "",
    lines: purchaseOrder.items.map((item) => ({
      variantId: item.variantId,
      orderedQuantity: String(item.orderedQuantity),
      unitCostCents: String(item.unitCostCents),
      note: item.note ?? "",
    })),
  };
}

function buildReceiptQuantities(purchaseOrder: PurchaseOrderDetail) {
  return Object.fromEntries(
    purchaseOrder.items.map((item) => [item.id, item.openQuantity > 0 ? String(item.openQuantity) : "0"]),
  );
}

function createEmptyLine() {
  return {
    variantId: "",
    orderedQuantity: "1",
    unitCostCents: "0",
    note: "",
  } satisfies DraftLine;
}

function getVariantLabel(option: VariantOption) {
  const parts = [option.productTitle, option.variantTitle];
  if (option.sku) parts.push(`SKU ${option.sku}`);
  return parts.filter(Boolean).join(" · ");
}

export default function AdminPurchaseOrderDetailClient({
  purchaseOrder: initialPurchaseOrder,
  suppliers,
  userRole,
  variantOptions,
}: Props) {
  const [purchaseOrder, setPurchaseOrder] = useState(initialPurchaseOrder);
  const [draft, setDraft] = useState(() => buildDraftState(initialPurchaseOrder));
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptQuantities, setReceiptQuantities] = useState(() =>
    buildReceiptQuantities(initialPurchaseOrder),
  );
  const [reversalNote, setReversalNote] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [reversingReceiptId, setReversingReceiptId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canEditDraft = purchaseOrder.status === "DRAFT";
  const canReceive =
    purchaseOrder.status === "SUBMITTED" || purchaseOrder.status === "PARTIALLY_RECEIVED";
  const filteredVariantOptions = useMemo(() => {
    return variantOptions.filter((option) => option.supplierId === draft.supplierId);
  }, [draft.supplierId, variantOptions]);
  const totalValueCents = purchaseOrder.items.reduce(
    (sum, item) => sum + item.orderedQuantity * item.unitCostCents,
    0,
  );

  const syncPurchaseOrder = (nextPurchaseOrder: PurchaseOrderDetail) => {
    setPurchaseOrder(nextPurchaseOrder);
    setDraft(buildDraftState(nextPurchaseOrder));
    setReceiptQuantities(buildReceiptQuantities(nextPurchaseOrder));
  };

  const updateDraftLine = (index: number, line: DraftLine) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((entry, lineIndex) => (lineIndex === index ? line : entry)),
    }));
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    setError("");
    setNotice("");

    try {
      const items = draft.lines.map((line) => {
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

      const response = await fetch(`/api/admin/purchase-orders/${purchaseOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: draft.supplierId,
          reference: draft.reference.trim() || null,
          note: draft.note.trim() || null,
          expectedDeliveryAt: draft.expectedDeliveryAt || null,
          items,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        purchaseOrder?: PurchaseOrderDetail;
      };
      if (!response.ok || !data.purchaseOrder) {
        throw new Error(data.error ?? "Failed to update purchase order.");
      }

      syncPurchaseOrder(data.purchaseOrder);
      setNotice("Draft purchase order updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update purchase order.");
    } finally {
      setSavingDraft(false);
    }
  };

  const submitDraft = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/purchase-orders/${purchaseOrder.id}/submit`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        purchaseOrder?: PurchaseOrderDetail;
      };
      if (!response.ok || !data.purchaseOrder) {
        throw new Error(data.error ?? "Failed to submit purchase order.");
      }

      syncPurchaseOrder(data.purchaseOrder);
      setNotice("Purchase order submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit purchase order.");
    } finally {
      setSubmitting(false);
    }
  };

  const receiveStock = async () => {
    setReceiving(true);
    setError("");
    setNotice("");

    try {
      const lines = purchaseOrder.items
        .map((item) => ({
          purchaseOrderItemId: item.id,
          quantityReceived: Number(receiptQuantities[item.id] ?? "0"),
        }))
        .filter((item) => item.quantityReceived > 0);

      if (lines.length === 0) {
        throw new Error("Choose at least one line with a received quantity.");
      }

      const response = await fetch(`/api/admin/purchase-orders/${purchaseOrder.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: receiptNote.trim() || null,
          lines,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        purchaseOrder?: PurchaseOrderDetail;
      };
      if (!response.ok || !data.purchaseOrder) {
        throw new Error(data.error ?? "Failed to receive purchase order.");
      }

      syncPurchaseOrder(data.purchaseOrder);
      setReceiptNote("");
      setNotice("Receipt posted and stock ledger updated.");
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : "Failed to receive purchase order.");
    } finally {
      setReceiving(false);
    }
  };

  const reverseReceipt = async (receiptId: string) => {
    setReversingReceiptId(receiptId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/purchase-orders/${purchaseOrder.id}/reverse-receipt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptId,
            note: reversalNote.trim() || null,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        purchaseOrder?: PurchaseOrderDetail;
      };
      if (!response.ok || !data.purchaseOrder) {
        throw new Error(data.error ?? "Failed to reverse receipt.");
      }

      syncPurchaseOrder(data.purchaseOrder);
      setReversalNote("");
      setNotice("Receipt reversed with compensating stock entries.");
    } catch (reverseError) {
      setError(reverseError instanceof Error ? reverseError.message : "Failed to reverse receipt.");
    } finally {
      setReversingReceiptId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Procurement"
        title={`PO #${purchaseOrder.purchaseOrderNumber}`}
        description="Track supplier inbound, receiving progress, and receipt history against the live stock ledger."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/procurement"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              Back to queue
            </Link>
            {canEditDraft ? (
              <>
                <AdminButton tone="secondary" onClick={saveDraft} disabled={savingDraft}>
                  {savingDraft ? "Saving..." : "Save draft"}
                </AdminButton>
                <AdminButton onClick={submitDraft} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit PO"}
                </AdminButton>
              </>
            ) : null}
          </div>
        }
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Status" value={purchaseOrder.status.replaceAll("_", " ")} />
            <AdminMetricCard
              label="Units"
              value={`${purchaseOrder.receivedUnits}/${purchaseOrder.orderedUnits}`}
              detail={`${purchaseOrder.openUnits} units still open`}
            />
            <AdminMetricCard
              label="PO value"
              value={formatMoney(totalValueCents)}
              detail={`${purchaseOrder.items.length} line items`}
            />
            <AdminMetricCard
              label="Expected"
              value={purchaseOrder.expectedDeliveryAt ? formatDate(purchaseOrder.expectedDeliveryAt) : "—"}
              detail={`Supplier ${purchaseOrder.supplierName}`}
            />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <AdminPanel
          eyebrow="Header"
          title="Purchase-order details"
          description="Draft orders can still change supplier and lines. Submitted orders become receive-only."
        >
          <div className="mb-4">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${STATUS_TONE[purchaseOrder.status]}`}
            >
              {purchaseOrder.status.replaceAll("_", " ")}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="Supplier">
              <AdminSelect
                disabled={!canEditDraft}
                value={draft.supplierId}
                onChange={(event) =>
                  setDraft((current) => ({
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
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Expected delivery" optional="optional">
              <AdminInput
                disabled={!canEditDraft}
                type="datetime-local"
                value={draft.expectedDeliveryAt}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    expectedDeliveryAt: event.target.value,
                  }))
                }
              />
            </AdminField>
            <AdminField label="Reference" optional="optional">
              <AdminInput
                disabled={!canEditDraft}
                value={draft.reference}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, reference: event.target.value }))
                }
              />
            </AdminField>
            <AdminField label="Note" optional="optional">
              <AdminInput
                disabled={!canEditDraft}
                value={draft.note}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, note: event.target.value }))
                }
              />
            </AdminField>
          </div>

          <div className="mt-5 space-y-3">
            {draft.lines.map((line, index) => (
              <div
                key={`po-line-${index}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="grid gap-3 lg:grid-cols-[2.2fr_0.8fr_0.9fr_auto]">
                  <AdminField label={`Line ${index + 1}`}>
                    <AdminSelect
                      disabled={!canEditDraft}
                      value={line.variantId}
                      onChange={(event) => {
                        const option = variantOptions.find(
                          (entry) => entry.variantId === event.target.value,
                        );
                        updateDraftLine(index, {
                          ...line,
                          variantId: event.target.value,
                          unitCostCents: option ? String(option.costCents) : line.unitCostCents,
                        });
                      }}
                    >
                      <option value="">Choose variant</option>
                      {filteredVariantOptions.map((option) => (
                        <option key={option.variantId} value={option.variantId}>
                          {getVariantLabel(option)}
                        </option>
                      ))}
                    </AdminSelect>
                  </AdminField>
                  <AdminField label="Qty">
                    <AdminInput
                      disabled={!canEditDraft}
                      type="number"
                      min={1}
                      step={1}
                      value={line.orderedQuantity}
                      onChange={(event) =>
                        updateDraftLine(index, {
                          ...line,
                          orderedQuantity: event.target.value,
                        })
                      }
                    />
                  </AdminField>
                  <AdminField label="Unit cost (cents)">
                    <AdminInput
                      disabled={!canEditDraft}
                      type="number"
                      min={0}
                      step={1}
                      value={line.unitCostCents}
                      onChange={(event) =>
                        updateDraftLine(index, {
                          ...line,
                          unitCostCents: event.target.value,
                        })
                      }
                    />
                  </AdminField>
                  {canEditDraft ? (
                    <div className="flex items-end">
                      <AdminButton
                        tone="secondary"
                        onClick={() =>
                          setDraft((current) => ({
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
                  ) : null}
                </div>
                <div className="mt-3">
                  <AdminField label="Line note" optional="optional">
                    <AdminTextarea
                      disabled={!canEditDraft}
                      rows={2}
                      value={line.note}
                      onChange={(event) =>
                        updateDraftLine(index, {
                          ...line,
                          note: event.target.value,
                        })
                      }
                    />
                  </AdminField>
                </div>
              </div>
            ))}

            {canEditDraft ? (
              <AdminButton
                tone="secondary"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    lines: [...current.lines, createEmptyLine()],
                  }))
                }
              >
                Add line
              </AdminButton>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Receiving"
          title="Post receipts"
          description="Receipt posting updates inventory immediately and writes stock-ledger rows per line."
        >
          {!canReceive ? (
            <AdminEmptyState
              title="Not receivable"
              description="This purchase order is either still a draft or already fully received."
            />
          ) : (
            <div className="space-y-3">
              {purchaseOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {item.productTitle}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.variantTitle}
                        {item.skuSnapshot ? ` · SKU ${item.skuSnapshot}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>
                        {item.receivedQuantity}/{item.orderedQuantity} received
                      </div>
                      <div>{item.openQuantity} still open</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <AdminField label="Receive quantity">
                      <AdminInput
                        type="number"
                        min={0}
                        step={1}
                        max={item.openQuantity}
                        value={receiptQuantities[item.id] ?? "0"}
                        onChange={(event) =>
                          setReceiptQuantities((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                    </AdminField>
                  </div>
                </div>
              ))}

              <AdminField label="Receipt note" optional="optional">
                <AdminTextarea
                  rows={3}
                  value={receiptNote}
                  onChange={(event) => setReceiptNote(event.target.value)}
                  placeholder="Carrier note, box count, discrepancy, receiving condition..."
                />
              </AdminField>

              <AdminButton onClick={receiveStock} disabled={receiving}>
                {receiving ? "Posting receipt..." : "Post receipt"}
              </AdminButton>
            </div>
          )}
        </AdminPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          eyebrow="Receipts"
          title="Receipt history"
          description="Each receipt is immutable. Reversal creates compensating stock movements instead of deleting history."
        >
          <div className="mb-4">
            <AdminField label="Reversal note" optional="admin-only">
              <AdminTextarea
                rows={2}
                value={reversalNote}
                onChange={(event) => setReversalNote(event.target.value)}
                placeholder="Required context for admin receipt reversal."
              />
            </AdminField>
          </div>
          <div className="space-y-3">
            {purchaseOrder.receipts.length === 0 ? (
              <AdminEmptyState
                title="No receipts yet"
                description="Post the first receipt to move stock into inventory and create ledger rows."
              />
            ) : (
              purchaseOrder.receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Received {formatDate(receipt.receivedAt)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        By {receipt.createdByEmail ?? "Unknown operator"}
                      </div>
                    </div>
                    {receipt.reversedAt ? (
                      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200">
                        Reversed
                      </span>
                    ) : userRole === "ADMIN" ? (
                      <AdminButton
                        tone="danger"
                        onClick={() => reverseReceipt(receipt.id)}
                        disabled={reversingReceiptId === receipt.id}
                      >
                        {reversingReceiptId === receipt.id ? "Reversing..." : "Reverse receipt"}
                      </AdminButton>
                    ) : null}
                  </div>
                  {receipt.note ? (
                    <div className="mt-3 text-sm text-slate-300">{receipt.note}</div>
                  ) : null}
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    {receipt.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                      >
                        <div>
                          {item.productTitle} · {item.variantTitle}
                        </div>
                        <div className="font-semibold text-white">+{item.quantityReceived}</div>
                      </div>
                    ))}
                  </div>
                  {receipt.reversedAt ? (
                    <div className="mt-3 text-xs text-red-200">
                      Reversed {formatDate(receipt.reversedAt)} by{" "}
                      {receipt.reversedByEmail ?? "Unknown operator"}
                      {receipt.reversalNote ? ` · ${receipt.reversalNote}` : ""}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Timeline"
          title="PO event log"
          description="Operator-readable milestones for creation, update, submission, receipt, and reversal."
        >
          <div className="space-y-3">
            {purchaseOrder.events.length === 0 ? (
              <AdminEmptyState
                title="No events yet"
                description="Creation, submission, receipt, and reversal events will appear here."
              />
            ) : (
              purchaseOrder.events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">
                      {event.summary ?? event.eventType}
                    </div>
                    <div className="text-xs text-slate-500">{formatDate(event.createdAt)}</div>
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {event.eventType}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {event.actorEmail ?? "Unknown operator"}
                  </div>
                  {event.note ? (
                    <div className="mt-3 text-sm text-slate-300">{event.note}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
