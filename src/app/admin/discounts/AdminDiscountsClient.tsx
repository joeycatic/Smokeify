"use client";

import { useEffect, useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type DiscountCoupon = {
  id: string | null;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: string | null;
  durationInMonths: number | null;
  valid: boolean | null;
};

type Discount = {
  id: string;
  code: string;
  active: boolean;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: number | null;
  createdAt: string | null;
  coupon: DiscountCoupon;
};

const formatAmount = (amount: number | null, currency: string | null) => {
  if (amount === null) return "-";
  const code = currency?.toUpperCase() || "EUR";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
  }).format(amount / 100);
};

const formatPercent = (percent: number | null) => {
  if (percent === null) return "-";
  return `${percent}%`;
};

const formatDate = (epochSeconds: number | null) => {
  if (!epochSeconds) return "-";
  return new Date(epochSeconds * 1000).toLocaleDateString("de-DE");
};

export default function AdminDiscountsClient() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const loadDiscounts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/discounts", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load discounts.");
        return;
      }
      const data = (await res.json()) as { discounts?: Discount[] };
      setDiscounts(data.discounts ?? []);
    } catch {
      setError("Failed to load discounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDiscounts();
  }, []);

  const sorted = useMemo(
    () =>
      [...discounts].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.code.localeCompare(b.code);
      }),
    [discounts]
  );
  const activeCount = useMemo(
    () => discounts.filter((discount) => discount.active).length,
    [discounts]
  );

  const resetForm = () => {
    setCode("");
    setPercentOff("");
    setAmountOff("");
    setCurrency("EUR");
    setMaxRedemptions("");
    setExpiresAt("");
    setMode("percent");
  };

  const createDiscount = async () => {
    setError("");
    setNotice("");
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Code is required.");
      return;
    }

    const payload: {
      code: string;
      percentOff?: number;
      amountOffCents?: number;
      currency?: string;
      maxRedemptions?: number;
      expiresAt?: number;
    } = { code: trimmedCode };

    if (mode === "percent") {
      const percentValue = Number(percentOff);
      if (!Number.isFinite(percentValue) || percentValue <= 0 || percentValue > 100) {
        setError("Percent off must be between 1 and 100.");
        return;
      }
      payload.percentOff = percentValue;
    } else {
      const amountValue = Number(amountOff);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setError("Amount off must be greater than 0.");
        return;
      }
      payload.amountOffCents = Math.round(amountValue * 100);
      payload.currency = currency.trim().toUpperCase() || "EUR";
    }

    if (maxRedemptions.trim()) {
      const maxValue = Number(maxRedemptions);
      if (!Number.isFinite(maxValue) || maxValue <= 0) {
        setError("Max redemptions must be greater than 0.");
        return;
      }
      payload.maxRedemptions = Math.floor(maxValue);
    }

    if (expiresAt) {
      const expiresDate = new Date(`${expiresAt}T23:59:59`);
      const expiresSeconds = Math.floor(expiresDate.getTime() / 1000);
      if (!Number.isFinite(expiresSeconds) || expiresSeconds <= 0) {
        setError("Expiration date is invalid.");
        return;
      }
      payload.expiresAt = expiresSeconds;
    }

    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create discount.");
        return;
      }
      const data = (await res.json()) as { discount?: Discount };
      if (data.discount) {
        setDiscounts((prev) => [data.discount as Discount, ...prev]);
      } else {
        await loadDiscounts();
      }
      resetForm();
      setNotice("Discount created.");
    } catch {
      setError("Failed to create discount.");
    }
  };

  const updateDiscount = async (id: string, active: boolean) => {
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update discount.");
        return;
      }
      const data = (await res.json()) as { discount?: Discount };
      if (data.discount) {
        setDiscounts((prev) =>
          prev.map((item) => (item.id === id ? data.discount! : item))
        );
      } else {
        await loadDiscounts();
      }
      setNotice("Discount updated.");
    } catch {
      setError("Failed to update discount.");
    }
  };

  return (
    <div className="space-y-10 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / DISCOUNTS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Discounts</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {discounts.length} codes
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {activeCount} active
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <button
              type="button"
              onClick={loadDiscounts}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:bg-emerald-50"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-emerald-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              01
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Promotion codes
              </p>
              <p className="text-xs text-stone-500">
                Create one-off Stripe promotion codes.
              </p>
            </div>
          </div>
        </div>
        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {notice}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-stone-600">
            Code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="WELCOME10"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Discount type
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as "percent" | "amount")
              }
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            >
              <option value="percent">Percent off</option>
              <option value="amount">Amount off</option>
            </select>
          </label>
          {mode === "percent" ? (
            <label className="text-xs font-semibold text-stone-600">
              Percent off
              <input
                value={percentOff}
                onChange={(event) => setPercentOff(event.target.value)}
                placeholder="10"
                inputMode="decimal"
                className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
              />
            </label>
          ) : (
            <label className="text-xs font-semibold text-stone-600">
              Amount off
              <input
                value={amountOff}
                onChange={(event) => setAmountOff(event.target.value)}
                placeholder="5.00"
                inputMode="decimal"
                className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
              />
            </label>
          )}
          {mode === "amount" && (
            <label className="text-xs font-semibold text-stone-600">
              Currency
              <input
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                placeholder="EUR"
                className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
              />
            </label>
          )}
          <label className="text-xs font-semibold text-stone-600">
            Max redemptions
            <input
              value={maxRedemptions}
              onChange={(event) => setMaxRedemptions(event.target.value)}
              placeholder="100"
              inputMode="numeric"
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-stone-600">
            Expiration date
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-black/15 bg-white px-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={createDiscount}
            className="h-10 rounded-md bg-[#2f3e36] px-4 text-xs font-semibold text-white hover:bg-[#24312b]"
          >
            Create discount
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="h-10 rounded-md border border-black/10 px-4 text-xs font-semibold text-stone-700"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(251,191,36,0.14)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
              02
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                Active codes
              </p>
              <p className="text-xs text-stone-500">
                Review usage, expiry, and status.
              </p>
            </div>
          </div>
          <div className="text-xs text-stone-500">
            {sorted.length ? `${sorted.length} total` : "No codes"}
          </div>
        </div>
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-6 text-sm text-stone-500">
            No promotion codes found.
          </div>
        ) : (
          <div className="divide-y divide-black/10 rounded-2xl border border-amber-200/70 bg-white/90">
            {sorted.map((discount) => (
              <div
                key={discount.id}
                className="grid gap-3 px-4 py-4 text-sm text-stone-700 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]"
              >
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">
                    Code
                  </div>
                  <div className="font-semibold text-stone-900">
                    {discount.code}
                  </div>
                  <div className="text-xs text-stone-500">
                    {discount.active ? "Active" : "Inactive"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">
                    Value
                  </div>
                  <div className="font-semibold text-stone-900">
                    {discount.coupon.percentOff !== null
                      ? formatPercent(discount.coupon.percentOff)
                      : formatAmount(
                          discount.coupon.amountOff,
                          discount.coupon.currency
                        )}
                  </div>
                  <div className="text-xs text-stone-500">
                    {discount.coupon.duration ?? "once"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">
                    Redeemed
                  </div>
                  <div className="font-semibold text-stone-900">
                    {discount.timesRedeemed}
                  </div>
                  <div className="text-xs text-stone-500">
                    Max {discount.maxRedemptions ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">
                    Expires
                  </div>
                  <div className="font-semibold text-stone-900">
                    {formatDate(discount.expiresAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">
                    Created
                  </div>
                  <div className="font-semibold text-stone-900">
                    {discount.createdAt
                      ? new Date(discount.createdAt).toLocaleDateString("de-DE")
                      : "-"}
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => updateDiscount(discount.id, !discount.active)}
                    className="h-9 rounded-md border border-amber-200 px-3 text-xs font-semibold text-amber-800 hover:border-amber-300"
                  >
                    {discount.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
