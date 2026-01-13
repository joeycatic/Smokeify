"use client";

import { useState } from "react";

type Props = {
  orderId: string;
  existingStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  adminNote: string | null;
};

export default function ReturnRequestForm({
  orderId,
  existingStatus,
  adminNote,
}: Props) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setStatus("loading");
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason }),
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
        disabled={!reason.trim() || status === "loading"}
        className="h-9 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white disabled:opacity-50"
      >
        {status === "loading" ? "Senden..." : "Rueckgabe anfragen"}
      </button>
    </div>
  );
}
