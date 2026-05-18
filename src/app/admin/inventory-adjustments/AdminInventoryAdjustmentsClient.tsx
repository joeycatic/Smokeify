"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_INVENTORY_REASON_LABELS,
  type AdminInventoryAdjustmentMode,
  type AdminInventoryReasonCode,
} from "@/lib/adminInventory";

type VariantSearchResult = {
  id: string;
  title: string;
  sku: string | null;
  productId: string;
  productTitle: string;
  manufacturer: string | null;
  quantityOnHand: number;
  reserved: number;
};

type Props = {
  inventoryStorageAvailable: boolean;
};

const REASON_CODES = Object.keys(
  ADMIN_INVENTORY_REASON_LABELS,
) as AdminInventoryReasonCode[];

export default function AdminInventoryAdjustmentsClient({
  inventoryStorageAvailable,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantSearchResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<VariantSearchResult | null>(null);
  const [mode, setMode] = useState<AdminInventoryAdjustmentMode>("delta");
  const [quantity, setQuantity] = useState("");
  const [reasonCode, setReasonCode] = useState<AdminInventoryReasonCode>("MANUAL_RECOUNT");
  const [note, setNote] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!inventoryStorageAvailable || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/admin/inventory-adjustments?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = (await response.json().catch(() => ({}))) as {
          variants?: VariantSearchResult[];
        };
        if (!controller.signal.aborted) {
          setResults(data.variants ?? []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [inventoryStorageAvailable, query]);

  const parsedQuantity = Number(quantity);
  const preview = useMemo(() => {
    if (!selectedVariant || !Number.isFinite(parsedQuantity)) return null;
    const beforeOnHand = selectedVariant.quantityOnHand;
    const afterOnHand =
      mode === "set_on_hand" ? Math.trunc(parsedQuantity) : beforeOnHand + Math.trunc(parsedQuantity);
    return {
      beforeOnHand,
      delta: afterOnHand - beforeOnHand,
      afterOnHand,
    };
  }, [mode, parsedQuantity, selectedVariant]);

  const submit = async () => {
    if (!selectedVariant) {
      setError("Select a variant first.");
      return;
    }
    if (!Number.isFinite(parsedQuantity)) {
      setError("Quantity is invalid.");
      return;
    }
    if (!note.trim()) {
      setError("A short adjustment note is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/inventory-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          mode,
          quantity: Math.trunc(parsedQuantity),
          reasonCode,
          note,
          sourceReference: sourceReference.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        inventory?: { afterOnHand: number };
      };
      if (!response.ok) {
        setError(data.error ?? "Inventory adjustment failed.");
        return;
      }
      const afterOnHand = data.inventory?.afterOnHand ?? selectedVariant.quantityOnHand;
      setSelectedVariant((current) =>
        current ? { ...current, quantityOnHand: afterOnHand } : current,
      );
      setResults((current) =>
        current.map((entry) =>
          entry.id === selectedVariant.id ? { ...entry, quantityOnHand: afterOnHand } : entry,
        ),
      );
      setQuantity("");
      setNote("");
      setSourceReference("");
      setNotice("Inventory adjustment recorded.");
    } catch {
      setError("Inventory adjustment failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#090d12] p-5 shadow-[0_20px_56px_rgba(2,6,23,0.32)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Manual adjustments
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Create audited stock corrections</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Search a variant, choose delta or set-on-hand mode, preview the result, then save an
            audited inventory adjustment with a reason and source reference.
          </p>
        </div>
        {selectedVariant ? (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs text-cyan-100">
            On hand {selectedVariant.quantityOnHand} · Reserved {selectedVariant.reserved}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Variant search
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU, variant, product, manufacturer..."
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          {searching ? <p className="mt-3 text-sm text-slate-500">Searching…</p> : null}
          <div className="mt-3 space-y-2">
            {results.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => {
                  setSelectedVariant(variant);
                  setQuery(
                    `${variant.manufacturer ? `${variant.manufacturer} ` : ""}${variant.productTitle} / ${variant.title}`,
                  );
                  setResults([]);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-cyan-400/20 hover:bg-cyan-400/5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {variant.manufacturer ? `${variant.manufacturer} ` : ""}
                    {variant.productTitle}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {variant.title}
                    {variant.sku ? ` · SKU ${variant.sku}` : ""}
                  </div>
                </div>
                <span className="text-xs text-cyan-200">On hand {variant.quantityOnHand}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mode
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as AdminInventoryAdjustmentMode)}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none"
              >
                <option value="delta">Delta</option>
                <option value="set_on_hand">Set on hand</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Reason
              <select
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value as AdminInventoryReasonCode)}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none"
              >
                {REASON_CODES.map((value) => (
                  <option key={value} value={value}>
                    {ADMIN_INVENTORY_REASON_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {mode === "set_on_hand" ? "Set on hand to" : "Quantity delta"}
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={mode === "set_on_hand" ? "18" : "-2 or +5"}
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Source reference
            <input
              value={sourceReference}
              onChange={(event) => setSourceReference(event.target.value)}
              placeholder="PO count sheet, aisle recount, damaged box reference..."
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Adjustment note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Explain why this stock correction is needed."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
            {selectedVariant && preview ? (
              <>
                <div className="font-semibold text-white">
                  {selectedVariant.manufacturer ? `${selectedVariant.manufacturer} ` : ""}
                  {selectedVariant.productTitle}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedVariant.title}
                  {selectedVariant.sku ? ` · SKU ${selectedVariant.sku}` : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <span>Before {preview.beforeOnHand}</span>
                  <span>Delta {preview.delta > 0 ? `+${preview.delta}` : preview.delta}</span>
                  <span>After {preview.afterOnHand}</span>
                </div>
              </>
            ) : (
              <span>Select a variant and enter a quantity to preview the adjustment.</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!inventoryStorageAvailable || !selectedVariant || saving}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {saving ? "Saving..." : "Create inventory adjustment"}
          </button>
        </div>
      </div>
    </section>
  );
}
