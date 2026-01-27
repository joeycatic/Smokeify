"use client";

import { useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import AdminBackButton from "@/components/admin/AdminBackButton";

type ReturnRequestRow = {
  id: string;
  orderId: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string | null; name: string | null };
  order: { id: string; amountTotal: number; currency: string; status: string };
};

type Props = {
  requests: ReturnRequestRow[];
};

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

export default function AdminReturnsClient({ requests }: Props) {
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    setError("");
    setNotice("");
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote: noteDrafts[id],
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
      } else {
        setNotice("Return request updated.");
      }
    } catch {
      setError("Update failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / RETURNS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Return requests</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <AdminBackButton
              inline
              showOnReturns
              className="h-9 px-4 text-sm text-[#2f3e36] hover:bg-emerald-50"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-stone-600">No return requests yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-stone-900">
                    Return {req.order.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-xs text-stone-500">
                    {new Date(req.createdAt).toLocaleDateString("de-DE")} ·{" "}
                    {req.user?.email ?? "No email"}
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-emerald-900">
                  {formatPrice(req.order.amountTotal, req.order.currency)}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                  Order: {req.order.status}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                  Return: {req.status}
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm text-stone-700">
                <div className="text-xs font-semibold text-stone-600 mb-1">
                  Reason
                </div>
                <div>{req.reason}</div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="text-xs font-semibold text-stone-600">
                  Admin note
                  <input
                    value={noteDrafts[req.id] ?? req.adminNote ?? ""}
                    onChange={(event) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [req.id]: event.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(req.id, "APPROVED")}
                    className="h-10 rounded-md border border-emerald-200 px-4 text-xs font-semibold text-emerald-800 hover:border-emerald-300"
                    disabled={savingId === req.id}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(req.id, "REJECTED")}
                    className="h-10 rounded-md border border-amber-200 px-4 text-xs font-semibold text-amber-800 hover:border-amber-300"
                    disabled={savingId === req.id}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
