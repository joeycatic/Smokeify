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
      <div className="text-sm text-stone-600">
        Status:{" "}
        <span className="font-semibold text-stone-800">{existingStatus}</span>
        {adminNote && (
          <div className="mt-1 text-xs text-stone-500">Note: {adminNote}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">
        Beantrage eine Rueckgabe fuer diese Bestellung.
      </p>
      <div className="space-y-2 text-sm">
        {items.map((item) => {
          const qty = selection[item.id] ?? 0;
          const isSelected = qty > 0;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-3 py-2"
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
                />
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-10 w-10 rounded-lg border border-black/10 object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg border border-black/10 bg-stone-100" />
                )}
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-stone-500">
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
                  className="h-8 w-14 rounded-md border border-black/10 px-0 text-[11px] text-center"
                />
              )}
            </div>
          );
        })}
      </div>
      <label className="block text-xs font-semibold text-stone-600">
        Grund
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          placeholder="Warum moechtest du zurueckgeben?"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {status === "ok" && (
        <p className="text-xs text-emerald-700">
          Rueckgabeanfrage gesendet.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!reason.trim() || status === "loading" || selectedCount === 0}
        className="h-9 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white disabled:opacity-50"
      >
        {status === "loading" ? "Senden..." : "Rueckgabe anfragen"}
      </button>
    </div>
  );
}
