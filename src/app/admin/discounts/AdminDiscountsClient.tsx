"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/components/admin/AdminWorkspace";

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
  if (!epochSeconds) return "No expiry";
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
  const expiringSoon = useMemo(
    () =>
      discounts.filter((discount) => {
        if (!discount.expiresAt) return false;
        const diff = discount.expiresAt * 1000 - Date.now();
        return diff > 0 && diff < 1000 * 60 * 60 * 24 * 14;
      }).length,
    [discounts]
  );
  const mostRedeemed = useMemo(
    () =>
      [...discounts].sort((a, b) => b.timesRedeemed - a.timesRedeemed)[0] ?? null,
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
        setDiscounts((prev) => prev.map((item) => (item.id === id ? data.discount! : item)));
      } else {
        await loadDiscounts();
      }
      setNotice("Discount updated.");
    } catch {
      setError("Failed to update discount.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Discounts"
        title="Promotion code console"
        description="Create and manage Stripe promotion codes from a compact dark operations surface instead of the old stacked form page."
        actions={
          <AdminButton tone="secondary" onClick={() => void loadDiscounts()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </AdminButton>
        }
        metrics={
          <div className="grid gap-3 md:grid-cols-4">
            <AdminMetricCard label="Codes" value={String(discounts.length)} detail="Total promotion codes" />
            <AdminMetricCard label="Active" value={String(activeCount)} detail="Currently redeemable" />
            <AdminMetricCard label="Expiring soon" value={String(expiringSoon)} detail="Within 14 days" />
            <AdminMetricCard
              label="Most redeemed"
              value={mostRedeemed ? String(mostRedeemed.timesRedeemed) : "0"}
              detail={mostRedeemed ? mostRedeemed.code : "No redemption data"}
            />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminPanel
          eyebrow="Create"
          title="New promotion code"
          description="Build a one-off percent or amount-based Stripe code with redemption and expiry limits."
          className="admin-reveal-delay-1"
        >
          <div className="grid gap-4">
            <AdminField label="Code">
              <AdminInput
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="WELCOME10"
              />
            </AdminField>

            <AdminField label="Discount type">
              <AdminSelect
                value={mode}
                onChange={(event) => setMode(event.target.value as "percent" | "amount")}
              >
                <option value="percent">Percent off</option>
                <option value="amount">Fixed amount</option>
              </AdminSelect>
            </AdminField>

            <div className="grid gap-4 md:grid-cols-2">
              {mode === "percent" ? (
                <AdminField label="Percent off">
                  <AdminInput
                    value={percentOff}
                    onChange={(event) => setPercentOff(event.target.value)}
                    placeholder="10"
                    inputMode="decimal"
                  />
                </AdminField>
              ) : (
                <>
                  <AdminField label="Amount off">
                    <AdminInput
                      value={amountOff}
                      onChange={(event) => setAmountOff(event.target.value)}
                      placeholder="5.00"
                      inputMode="decimal"
                    />
                  </AdminField>
                  <AdminField label="Currency">
                    <AdminInput
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                      placeholder="EUR"
                    />
                  </AdminField>
                </>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Max redemptions" optional="optional">
                <AdminInput
                  value={maxRedemptions}
                  onChange={(event) => setMaxRedemptions(event.target.value)}
                  placeholder="100"
                  inputMode="numeric"
                />
              </AdminField>
              <AdminField label="Expires at" optional="optional">
                <AdminInput
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </AdminField>
            </div>

            <div className="flex flex-wrap gap-2">
              <AdminButton onClick={() => void createDiscount()}>Create code</AdminButton>
              <AdminButton tone="secondary" onClick={resetForm}>
                Reset
              </AdminButton>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Status"
          title="Code list"
          description="Review value, usage, expiry pressure, and active state in one dense admin table."
          className="admin-reveal-delay-2"
        >
          {sorted.length === 0 ? (
            <AdminEmptyState
              title="No promotion codes"
              description="Create the first code to start managing discount campaigns here."
            />
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#070a0f]">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <div>Code</div>
                <div>Value</div>
                <div>Usage</div>
                <div>Expires</div>
                <div>State</div>
              </div>
              <div className="divide-y divide-white/5">
                {sorted.map((discount) => {
                  const expiringSoonForRow =
                    Boolean(discount.expiresAt) &&
                    (discount.expiresAt as number) * 1000 - Date.now() < 1000 * 60 * 60 * 24 * 14;
                  return (
                    <div
                      key={discount.id}
                      className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-4 text-sm text-slate-300 transition hover:bg-white/[0.03]"
                    >
                      <div>
                        <div className="font-semibold text-white">{discount.code}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                              discount.active
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                : "border-white/10 bg-white/[0.04] text-slate-400"
                            }`}
                          >
                            {discount.active ? "Active" : "Inactive"}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {discount.coupon.percentOff !== null ? "Percent" : "Amount"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {discount.coupon.percentOff !== null
                            ? formatPercent(discount.coupon.percentOff)
                            : formatAmount(discount.coupon.amountOff, discount.coupon.currency)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {discount.coupon.duration ?? "once"}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{discount.timesRedeemed}</div>
                        <div className="text-xs text-slate-500">
                          Max {discount.maxRedemptions ?? "unlimited"}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{formatDate(discount.expiresAt)}</div>
                        <div className="text-xs text-slate-500">
                          {expiringSoonForRow ? "Expiring soon" : "Healthy"}
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <AdminButton
                          tone={discount.active ? "secondary" : "primary"}
                          onClick={() => void updateDiscount(discount.id, !discount.active)}
                        >
                          {discount.active ? "Deactivate" : "Activate"}
                        </AdminButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
