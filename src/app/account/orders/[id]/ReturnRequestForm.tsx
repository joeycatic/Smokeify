"use client";

import { useState } from "react";

type Props = {
  orderId: string;
  existingStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  adminNote: string | null;
  items: Array<{ id: string; name: string; quantity: number; imageUrl?: string | null }>;
};

export default function ReturnRequestForm({
  orderId,
  existingStatus,
  adminNote,
  items,
}: Props) {
  const [reason, setReason] = useState("");
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const selectedCount = Object.values(selection).reduce(
    (sum, qty) => sum + (qty > 0 ? 1 : 0),
    0
  );

  const submit = async () => {
    setError("");
    setStatus("loading");
    try {
      const selectedItems = Object.entries(selection)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ id, quantity }));
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason, items: selectedItems }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Request failed");
        setStatus("error");
        return;
      }
      setStatus("ok");
    } catch {
      setError("Request failed");
      setStatus("error");
    }
  };

  if (existingStatus) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0c1410] px-4 py-3 text-sm text-emerald-200/80">
        Status:{" "}
        <span className="font-semibold text-emerald-100">
          {existingStatus}
        </span>
        {adminNote && (
        <div className="mt-1 text-xs text-emerald-200/60">
            Hinweis: {adminNote}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#0c1410] px-3 py-3 text-sm">
        {items.map((item) => {
          const qty = selection[item.id] ?? 0;
          const isSelected = qty > 0;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) =>
                    setSelection((prev) => ({
                      ...prev,
                      [item.id]: event.target.checked ? 1 : 0,
                    }))
                  }
                  className="h-4 w-4 rounded border border-white/20 bg-[#0f1713] text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1713]"
                />
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                    loading="lazy"
                    decoding="async"
                    width={40}
                    height={40}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg border border-white/10 bg-[#0f1713]" />
                )}
                <div>
                  <div className="font-semibold text-emerald-100">
                    {item.name}
                  </div>
                  <div className="text-xs text-emerald-200/60">
                    Menge: {item.quantity}
                  </div>
                </div>
              </div>
              {item.quantity > 1 && (
                <input
                  type="number"
                  min={0}
                  max={item.quantity}
                  value={qty}
                  onChange={(event) =>
                    setSelection((prev) => ({
                      ...prev,
                      [item.id]: Number(event.target.value),
                    }))
                  }
                  className="h-8 w-14 rounded-md border border-white/10 bg-[#0f1713] px-0 text-[11px] text-center text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1713]"
                />
              )}
            </div>
          );
        })}
      </div>
      <label className="block text-xs font-semibold text-stone-600">
        Grund
        <p className="mt-2 text-sm text-emerald-200/60">
          Warum möchtest du die Rückgabe beantragen?
        </p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1713] px-3 py-2 text-sm text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1713]"
          placeholder="Warum möchtest du zurückgeben?"
        />
      </label>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {status === "ok" && (
        <p className="text-xs text-emerald-300">
          Rückgabeanfrage gesendet.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!reason.trim() || status === "loading" || selectedCount === 0}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 px-5 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1713]"
      >
        <span aria-hidden="true">🛒</span>
        {status === "loading" ? "Senden..." : "Rückgabe anfragen"}
      </button>
    </div>
  );
}
