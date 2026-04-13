"use client";

import { useState } from "react";
import Image from "next/image";

type RefundRequestPortalProps = {
  orderId: string;
  orderNumber: number;
  storefrontName: string;
  customerName: string;
  customerEmail: string;
  token?: string;
  expires?: number;
  existingRequest: {
    status: string;
    adminNote: string | null;
  } | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    imageUrl?: string | null;
    options?: Array<{ name: string; value: string }>;
  }>;
};

const formatOptions = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options.map((option) => `${option.name}: ${option.value}`).join(" · ");
};

export default function RefundRequestPortal({
  orderId,
  orderNumber,
  storefrontName,
  customerName: initialCustomerName,
  customerEmail: initialCustomerEmail,
  token,
  expires,
  existingRequest,
  items,
}: RefundRequestPortalProps) {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail);
  const [reason, setReason] = useState("");
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  const selectedCount = Object.values(selection).reduce(
    (sum, quantity) => sum + (quantity > 0 ? 1 : 0),
    0,
  );

  const submit = async () => {
    setError("");
    setStatus("loading");
    try {
      const response = await fetch(`/api/returns/request/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          expires,
          customerName,
          customerEmail,
          reason,
          items: Object.entries(selection)
            .filter(([, quantity]) => quantity > 0)
            .map(([id, quantity]) => ({ id, quantity })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Refund request failed.");
        setStatus("error");
        return;
      }
      setStatus("ok");
    } catch {
      setError("Refund request failed.");
      setStatus("error");
    }
  };

  if (existingRequest) {
    return (
      <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm text-emerald-50">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
          Request received
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Refund request already submitted
        </h2>
        <p className="mt-3 leading-6 text-emerald-100/85">
          Status: <span className="font-semibold text-white">{existingRequest.status}</span>
        </p>
        {existingRequest.adminNote ? (
          <p className="mt-3 leading-6 text-emerald-100/80">
            Admin note: {existingRequest.adminNote}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Secure refund request
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Bestellung #{orderNumber}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This form is linked to your {storefrontName} order. Confirm your contact details,
          choose the affected items, and tell us why you want to request a refund.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Full name
            </span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b111c] px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10"
              placeholder="Your full name"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Email
            </span>
            <input
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b111c] px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Refund reason
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b111c] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10"
              placeholder="Describe the issue and what should be refunded."
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {status === "ok" ? (
            <p className="text-sm text-emerald-300">
              Your refund request was submitted successfully.
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={
              status === "loading" ||
              !customerName.trim() ||
              !customerEmail.trim() ||
              !reason.trim() ||
              selectedCount === 0
            }
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          >
            {status === "loading" ? "Submitting..." : "Submit refund request"}
          </button>
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Order items
          </p>
          {items.map((item) => {
            const quantity = selection[item.id] ?? 0;
            const selected = quantity > 0;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/8 bg-[#0b111c] px-4 py-4"
              >
                <div className="flex gap-3">
                  <label className="mt-3 flex items-center">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        setSelection((current) => ({
                          ...current,
                          [item.id]: event.target.checked ? 1 : 0,
                        }))
                      }
                    />
                  </label>
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.05]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    {item.options?.length ? (
                      <p className="mt-1 text-xs text-slate-400">{formatOptions(item.options)}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Ordered quantity: {item.quantity}</span>
                      {item.quantity > 1 ? (
                        <input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={quantity}
                          onChange={(event) =>
                            setSelection((current) => ({
                              ...current,
                              [item.id]: Math.min(
                                item.quantity,
                                Math.max(0, Number(event.target.value) || 0),
                              ),
                            }))
                          }
                          className="h-10 w-20 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-center text-sm font-semibold text-white outline-none transition focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
