"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { AdminPage, AdminPrimaryGrid } from "@/components/admin/ui";

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
  const [nowTs, setNowTs] = useState(() => Date.now());
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
      setNowTs(Date.now());
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
  const activeDiscounts = useMemo(
    () => sorted.filter((discount) => discount.active),
    [sorted]
  );
  const inactiveDiscounts = useMemo(
    () => sorted.filter((discount) => !discount.active),
    [sorted]
  );
  const expiringSoon = useMemo(
    () =>
      discounts.filter((discount) => {
        if (!discount.expiresAt) return false;
        const diff = discount.expiresAt * 1000 - nowTs;
        return diff > 0 && diff < 1000 * 60 * 60 * 24 * 14;
      }).length,
    [discounts, nowTs]
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
    <AdminPage layout="editor">
      <AdminPageIntro
        eyebrow="Admin / Discounts"
        title="Promotion code console"
        description="Create and manage local Viva checkout discount codes with the editor beside the active-code queue."
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

      <AdminPrimaryGrid rail="wide">
        <AdminPanel
          eyebrow="Create"
          title="New promotion code"
          description="Build a one-off percent or amount-based Viva checkout code with redemption and expiry limits."
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
          description="Review active and inactive codes separately with clearer value, usage, and expiry signals."
          className="admin-reveal-delay-2"
        >
          {sorted.length === 0 ? (
            <AdminEmptyState
              title="No promotion codes"
              description="Create the first code to start managing discount campaigns here."
            />
          ) : (
            <div className="space-y-4">
              <DiscountSection
                title="Active codes"
                badge={`${activeDiscounts.length}`}
                badgeTone="text-[var(--adm-success)] border-[var(--adm-success)] bg-[var(--adm-primary-soft)]"
                discounts={activeDiscounts}
                nowTs={nowTs}
                onToggle={updateDiscount}
              />
              <DiscountSection
                title="Inactive codes"
                badge={`${inactiveDiscounts.length}`}
                badgeTone="text-[var(--adm-text-muted)] border-[var(--adm-border)] bg-[var(--adm-surface-2)]"
                discounts={inactiveDiscounts}
                nowTs={nowTs}
                onToggle={updateDiscount}
              />
            </div>
          )}
        </AdminPanel>
      </AdminPrimaryGrid>
    </AdminPage>
  );
}

function DiscountSection({
  title,
  badge,
  badgeTone,
  discounts,
  nowTs,
  onToggle,
}: {
  title: string;
  badge: string;
  badgeTone: string;
  discounts: Discount[];
  nowTs: number;
  onToggle: (id: string, active: boolean) => Promise<void>;
}) {
  return (
    <div className="admin-data-grid-scroll rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
          {title}
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${badgeTone}`}
        >
          {badge}
        </span>
      </div>
      {discounts.length === 0 ? (
        <div className="px-4 py-6 text-sm text-[var(--adm-text-faint)]">No codes in this state.</div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {discounts.map((discount) => {
              const expiringSoonForRow =
                Boolean(discount.expiresAt) &&
                (discount.expiresAt as number) * 1000 - nowTs <
                  1000 * 60 * 60 * 24 * 14;
              return (
                <div
                  key={discount.id}
                  className="rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-sm text-[var(--adm-text-muted)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--adm-text)]">{discount.code}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            discount.active
                              ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                              : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
                          }`}
                        >
                          {discount.active ? "Active" : "Inactive"}
                        </span>
                        <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">
                          {discount.coupon.percentOff !== null ? "Percent" : "Amount"}
                        </span>
                        {expiringSoonForRow ? (
                          <span className="rounded-full border border-[#e2a136] bg-[#fff4dd] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#81560e]">
                            Expiring soon
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <AdminButton
                      tone={discount.active ? "secondary" : "primary"}
                      onClick={() => void onToggle(discount.id, !discount.active)}
                    >
                      {discount.active ? "Deactivate" : "Activate"}
                    </AdminButton>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MobileValue label="Value">
                      {discount.coupon.percentOff !== null
                        ? formatPercent(discount.coupon.percentOff)
                        : formatAmount(discount.coupon.amountOff, discount.coupon.currency)}
                    </MobileValue>
                    <MobileValue label="Duration">{discount.coupon.duration ?? "once"}</MobileValue>
                    <MobileValue label="Usage">{String(discount.timesRedeemed)}</MobileValue>
                    <MobileValue label="Cap">
                      Max {discount.maxRedemptions ?? "unlimited"}
                    </MobileValue>
                    <MobileValue label="Expires">{formatDate(discount.expiresAt)}</MobileValue>
                    <MobileValue label="Health">
                      {expiringSoonForRow ? "Within 14 days" : "Healthy"}
                    </MobileValue>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block">
            <div className="grid min-w-[760px] grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 border-b border-[var(--adm-border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
              <div>Code</div>
              <div>Value</div>
              <div>Usage</div>
              <div>Expires</div>
              <div>State</div>
            </div>
            <div className="divide-y divide-white/5">
              {discounts.map((discount) => {
                const expiringSoonForRow =
                  Boolean(discount.expiresAt) &&
                  (discount.expiresAt as number) * 1000 - nowTs <
                    1000 * 60 * 60 * 24 * 14;
                return (
                  <div
                    key={discount.id}
                    className="grid min-w-[760px] grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-4 text-sm text-[var(--adm-text-muted)] transition hover:bg-[var(--adm-surface)]"
                  >
                    <div>
                      <div className="font-semibold text-[var(--adm-text)]">{discount.code}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            discount.active
                              ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                              : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
                          }`}
                        >
                          {discount.active ? "Active" : "Inactive"}
                        </span>
                        <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-muted)]">
                          {discount.coupon.percentOff !== null ? "Percent" : "Amount"}
                        </span>
                        {expiringSoonForRow ? (
                          <span className="rounded-full border border-[#e2a136] bg-[#fff4dd] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#81560e]">
                            Expiring soon
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--adm-text)]">
                        {discount.coupon.percentOff !== null
                          ? formatPercent(discount.coupon.percentOff)
                          : formatAmount(discount.coupon.amountOff, discount.coupon.currency)}
                      </div>
                      <div className="text-xs text-[var(--adm-text-faint)]">
                        {discount.coupon.duration ?? "once"}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--adm-text)]">{discount.timesRedeemed}</div>
                      <div className="text-xs text-[var(--adm-text-faint)]">
                        Max {discount.maxRedemptions ?? "unlimited"}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--adm-text)]">{formatDate(discount.expiresAt)}</div>
                      <div className="text-xs text-[var(--adm-text-faint)]">
                        {expiringSoonForRow ? "Within 14 days" : "Healthy"}
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <AdminButton
                        tone={discount.active ? "secondary" : "primary"}
                        onClick={() => void onToggle(discount.id, !discount.active)}
                      >
                        {discount.active ? "Deactivate" : "Activate"}
                      </AdminButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MobileValue({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--adm-text)]">{children}</div>
    </div>
  );
}
