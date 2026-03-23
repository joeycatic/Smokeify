"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HorizontalBarsChart, type AdminChartPoint } from "@/components/admin/AdminCharts";

type Segment =
  | "new"
  | "repeat"
  | "high_value"
  | "churn_risk"
  | "discount_driven"
  | "return_risk"
  | "vip";

type BaseCustomer = {
  email: string;
  name: string | null;
  orderCount: number;
  totalSpentCents: number;
  refundedCents: number;
  netRevenueCents: number;
  aovCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  discountOrderCount: number;
  returnCount: number;
  segments: Segment[];
};

type RegisteredCustomer = BaseCustomer & {
  type: "registered";
  id: string;
  joinedAt: string;
  newsletterOptIn: boolean;
  loyaltyPointsBalance: number;
  storeCreditBalance: number;
  customerGroup: string | null;
  notes: string | null;
};

type GuestCustomer = BaseCustomer & {
  type: "guest";
};

type Customer = RegisteredCustomer | GuestCustomer;

const SEGMENT_META: Record<
  Segment,
  { label: string; tone: string; description: string }
> = {
  new: {
    label: "New",
    tone: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    description: "First order in the last 30 days.",
  },
  repeat: {
    label: "Repeat",
    tone: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    description: "Customer has already ordered at least twice.",
  },
  high_value: {
    label: "High value",
    tone: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    description: "Strong gross revenue contribution.",
  },
  churn_risk: {
    label: "Churn risk",
    tone: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    description: "Repeat buyer without a recent order.",
  },
  discount_driven: {
    label: "Discount driven",
    tone: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
    description: "Most purchases came through a discount.",
  },
  return_risk: {
    label: "Return risk",
    tone: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    description: "Return volume is high relative to order count.",
  },
  vip: {
    label: "VIP",
    tone: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    description: "Priority customer worth manual care.",
  },
};

const formatEur = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "percent",
    maximumFractionDigits: value >= 0.1 ? 0 : 1,
  }).format(value);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    dateStyle: "medium",
  });
};

const getDaysSince = (iso: string | null) => {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const getLastActivity = (customer: Customer) => customer.lastOrderAt ?? null;

const getSegmentScore = (customer: Customer) => {
  let score = 0;
  if (customer.segments.includes("vip")) score += 4;
  if (customer.segments.includes("high_value")) score += 3;
  if (customer.segments.includes("churn_risk")) score += 2;
  if (customer.segments.includes("return_risk")) score += 2;
  if (customer.segments.includes("discount_driven")) score += 1;
  return score;
};

export default function AdminCustomersClient() {
  const [registeredCustomers, setRegisteredCustomers] = useState<RegisteredCustomer[]>([]);
  const [guestCustomers, setGuestCustomers] = useState<GuestCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "registered" | "guest">("all");
  const [segmentFilter, setSegmentFilter] = useState<Segment | "all">("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load customers.");
        return;
      }
      const data = (await res.json()) as {
        registeredCustomers?: RegisteredCustomer[];
        guestCustomers?: GuestCustomer[];
      };
      setRegisteredCustomers(data.registeredCustomers ?? []);
      setGuestCustomers(data.guestCustomers ?? []);
    } catch {
      setError("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const allCustomers = useMemo<Customer[]>(
    () => [...registeredCustomers, ...guestCustomers],
    [guestCustomers, registeredCustomers],
  );

  const filtered = useMemo(() => {
    let list: Customer[] =
      tab === "registered"
        ? registeredCustomers
        : tab === "guest"
          ? guestCustomers
          : allCustomers;

    if (segmentFilter !== "all") {
      list = list.filter((customer) => customer.segments.includes(segmentFilter));
    }

    if (query.trim()) {
      const normalized = query.trim().toLowerCase();
      list = list.filter((customer) => {
        const haystack = [
          customer.email,
          customer.name ?? "",
          customer.type === "registered" ? customer.customerGroup ?? "" : "",
          ...customer.segments.map((segment) => SEGMENT_META[segment].label),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      });
    }

    return [...list].sort((left, right) => {
      const dateDiff =
        new Date(getLastActivity(right) ?? 0).getTime() -
        new Date(getLastActivity(left) ?? 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (right.netRevenueCents !== left.netRevenueCents) {
        return right.netRevenueCents - left.netRevenueCents;
      }
      return getSegmentScore(right) - getSegmentScore(left);
    });
  }, [allCustomers, guestCustomers, query, registeredCustomers, segmentFilter, tab]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedKey(null);
      return;
    }
    if (selectedKey && filtered.some((customer) => getCustomerKey(customer) === selectedKey)) {
      return;
    }
    setSelectedKey(getCustomerKey(filtered[0]));
  }, [filtered, selectedKey]);

  const selectedCustomer = useMemo(
    () => filtered.find((customer) => getCustomerKey(customer) === selectedKey) ?? filtered[0] ?? null,
    [filtered, selectedKey],
  );

  const totalNetRevenueCents = useMemo(
    () => allCustomers.reduce((sum, customer) => sum + customer.netRevenueCents, 0),
    [allCustomers],
  );

  const vipCustomers = useMemo(
    () => allCustomers.filter((customer) => customer.segments.includes("vip")).length,
    [allCustomers],
  );

  const churnRiskCustomers = useMemo(
    () => allCustomers.filter((customer) => customer.segments.includes("churn_risk")).length,
    [allCustomers],
  );

  const discountDrivenCustomers = useMemo(
    () =>
      allCustomers.filter((customer) => customer.segments.includes("discount_driven")).length,
    [allCustomers],
  );

  const averageClvCents = useMemo(() => {
    if (allCustomers.length === 0) return 0;
    return Math.round(totalNetRevenueCents / allCustomers.length);
  }, [allCustomers.length, totalNetRevenueCents]);

  const segmentBars = useMemo<AdminChartPoint[]>(
    () =>
      [
        { label: "VIP", value: vipCustomers },
        { label: "Churn risk", value: churnRiskCustomers },
        { label: "Discount driven", value: discountDrivenCustomers },
        {
          label: "Return risk",
          value: allCustomers.filter((customer) => customer.segments.includes("return_risk"))
            .length,
        },
        {
          label: "New",
          value: allCustomers.filter((customer) => customer.segments.includes("new")).length,
        },
      ].filter((entry) => entry.value > 0),
    [allCustomers, churnRiskCustomers, discountDrivenCustomers, vipCustomers],
  );

  const topCustomers = useMemo(
    () => [...allCustomers].sort((a, b) => b.netRevenueCents - a.netRevenueCents).slice(0, 6),
    [allCustomers],
  );

  const atRiskCustomers = useMemo(
    () =>
      [...allCustomers]
        .filter(
          (customer) =>
            customer.segments.includes("churn_risk") || customer.segments.includes("return_risk"),
        )
        .sort((a, b) => {
          const riskDiff = getSegmentScore(b) - getSegmentScore(a);
          if (riskDiff !== 0) return riskDiff;
          return b.netRevenueCents - a.netRevenueCents;
        })
        .slice(0, 6),
    [allCustomers],
  );

  const actionSummary = useMemo(() => {
    if (!selectedCustomer) return null;
    const lastOrderDays = getDaysSince(selectedCustomer.lastOrderAt);
    return {
      hasReactivationPotential:
        selectedCustomer.segments.includes("churn_risk") &&
        selectedCustomer.netRevenueCents >= 25_000,
      shouldProtectMargin:
        selectedCustomer.segments.includes("discount_driven") &&
        selectedCustomer.netRevenueCents >= 20_000,
      needsManualReview: selectedCustomer.segments.includes("return_risk"),
      lastOrderDays,
    };
  }, [selectedCustomer]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Customers
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              CRM intelligence and retention control
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              CLV, churn risk, discount dependence, loyalty balance, and direct actions for the
              existing CRM without rebuilding the underlying customer system.
            </p>
          </div>
          <button
            type="button"
            onClick={loadCustomers}
            className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh customers"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Customers" value={String(allCustomers.length)} />
          <MetricCard label="Net revenue" value={formatEur(totalNetRevenueCents)} />
          <MetricCard label="VIP / high touch" value={String(vipCustomers)} />
          <MetricCard label="Churn risk" value={String(churnRiskCustomers)} />
          <MetricCard label="Avg. CLV" value={formatEur(averageClvCents)} />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          eyebrow="Segments"
          title="Revenue quality mix"
          description="Who is valuable, risky, discount-heavy, or newly acquired."
        >
          {segmentBars.length === 0 ? (
            <EmptyPanelCopy message="No segment data available yet." />
          ) : (
            <HorizontalBarsChart data={segmentBars} colorClassName="bg-cyan-400" />
          )}
        </Panel>

        <Panel
          eyebrow="Leaders"
          title="Top customer value"
          description="Highest net revenue accounts and guests across the whole CRM."
        >
          <CustomerSummaryList customers={topCustomers} onSelect={setSelectedKey} />
        </Panel>

        <Panel
          eyebrow="Action queue"
          title="Customers needing attention"
          description="Focus repeat buyers at churn risk, margin-heavy accounts, and return-risk cases."
        >
          <CustomerSummaryList customers={atRiskCustomers} onSelect={setSelectedKey} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
        <Panel
          eyebrow="Directory"
          title="Customer records"
          description="Filter by type, segment, and intent. Select a row to open the intelligence drawer."
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold">
              {(["all", "registered", "guest"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`px-4 py-2 transition ${
                    tab === value
                      ? "bg-white text-[#05070a]"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                  }`}
                >
                  {value === "all" ? "All" : value === "registered" ? "Registered" : "Guest"}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <SegmentFilterChip
                active={segmentFilter === "all"}
                label="All segments"
                onClick={() => setSegmentFilter("all")}
              />
              {(Object.keys(SEGMENT_META) as Segment[]).map((segment) => (
                <SegmentFilterChip
                  key={segment}
                  active={segmentFilter === segment}
                  label={SEGMENT_META[segment].label}
                  onClick={() => setSegmentFilter(segment)}
                />
              ))}
            </div>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by email, name, segment, group..."
              className="h-10 min-w-[240px] flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
            />
            <span className="text-xs text-slate-500">{filtered.length} results</span>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#090d12]">
            <div className="grid grid-cols-[auto_1.15fr_0.75fr_120px_110px_110px] gap-x-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <div>Type</div>
              <div>Email</div>
              <div>Segments</div>
              <div className="text-right">Orders</div>
              <div className="text-right">Net</div>
              <div className="text-right">AOV</div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                {loading ? "Loading..." : "No customers found."}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filtered.map((customer, index) => {
                  const key = getCustomerKey(customer);
                  const isSelected = key === getCustomerKey(selectedCustomer);
                  return (
                    <button
                      key={`${key}-${index}`}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`grid w-full grid-cols-[auto_1.15fr_0.75fr_120px_110px_110px] items-center gap-x-4 px-4 py-3 text-left text-sm text-slate-300 transition ${
                        isSelected ? "bg-cyan-400/[0.07]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            customer.type === "registered"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {customer.type === "registered" ? "Registered" : "Guest"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-100">{customer.email}</div>
                        <div className="truncate text-xs text-slate-500">
                          {customer.name ?? "Unknown"} · last active {formatDate(getLastActivity(customer))}
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-wrap gap-1">
                        {customer.segments.slice(0, 2).map((segment) => (
                          <SegmentBadge key={segment} segment={segment} />
                        ))}
                        {customer.segments.length > 2 ? (
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">
                            +{customer.segments.length - 2}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right tabular-nums">{customer.orderCount}</div>
                      <div className="text-right tabular-nums font-medium text-slate-100">
                        {formatEur(customer.netRevenueCents)}
                      </div>
                      <div className="text-right text-slate-500">{formatEur(customer.aovCents)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Customer intelligence"
          title={selectedCustomer ? selectedCustomer.email : "No customer selected"}
          description={
            selectedCustomer
              ? "Actionable CRM profile with CLV, retention risk, discount dependence, and direct follow-up paths."
              : "Select a customer to inspect value and risk signals."
          }
        >
          {selectedCustomer ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {selectedCustomer.name ?? "Unknown customer"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {selectedCustomer.type === "registered"
                        ? "Registered account"
                        : "Guest checkout customer"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCustomer.segments.length ? (
                      selectedCustomer.segments.map((segment) => (
                        <SegmentBadge key={segment} segment={segment} />
                      ))
                    ) : (
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-500">
                        No active segments
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniMetric label="Net revenue" value={formatEur(selectedCustomer.netRevenueCents)} />
                  <MiniMetric label="AOV" value={formatEur(selectedCustomer.aovCents)} />
                  <MiniMetric label="Orders" value={String(selectedCustomer.orderCount)} />
                  <MiniMetric
                    label="Refund pressure"
                    value={formatPercent(
                      selectedCustomer.totalSpentCents > 0
                        ? selectedCustomer.refundedCents / selectedCustomer.totalSpentCents
                        : 0,
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
                <InfoRow label="First order" value={formatDate(selectedCustomer.firstOrderAt)} />
                <InfoRow label="Last order" value={formatDate(selectedCustomer.lastOrderAt)} />
                <InfoRow
                  label="Discount usage"
                  value={`${selectedCustomer.discountOrderCount}/${selectedCustomer.orderCount} orders`}
                />
                <InfoRow label="Returns" value={String(selectedCustomer.returnCount)} />
                {"joinedAt" in selectedCustomer ? (
                  <>
                    <InfoRow label="Joined" value={formatDate(selectedCustomer.joinedAt)} />
                    <InfoRow
                      label="Newsletter"
                      value={selectedCustomer.newsletterOptIn ? "Opted in" : "Not opted in"}
                    />
                    <InfoRow
                      label="Store credit"
                      value={formatEur(selectedCustomer.storeCreditBalance)}
                    />
                    <InfoRow
                      label="Loyalty points"
                      value={String(selectedCustomer.loyaltyPointsBalance)}
                    />
                    <InfoRow
                      label="Customer group"
                      value={selectedCustomer.customerGroup ?? "—"}
                    />
                  </>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Quick actions
                </p>
                <div className="grid gap-2">
                  {selectedCustomer.type === "registered" ? (
                    <Link
                      href={`/admin/users/${selectedCustomer.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                    >
                      Open customer profile
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setQuery(selectedCustomer.email)}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                  >
                    Filter CRM by this email
                  </button>
                  {selectedCustomer.segments[0] ? (
                    <button
                      type="button"
                      onClick={() => setSegmentFilter(selectedCustomer.segments[0])}
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      Open {SEGMENT_META[selectedCustomer.segments[0]].label} segment
                    </button>
                  ) : null}
                </div>
              </div>

              {actionSummary ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b1016] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Suggested next step
                  </p>
                  {actionSummary.hasReactivationPotential ? (
                    <ActionNote>
                      High-value customer has been inactive for {actionSummary.lastOrderDays} days.
                      Prioritize a manual reactivation or win-back offer.
                    </ActionNote>
                  ) : null}
                  {actionSummary.shouldProtectMargin ? (
                    <ActionNote>
                      Purchase history is strongly discount-led. Prefer bundle or loyalty incentives
                      before issuing another generic coupon.
                    </ActionNote>
                  ) : null}
                  {actionSummary.needsManualReview ? (
                    <ActionNote>
                      Return pressure is elevated. Review product fit, support notes, and refund
                      pattern before triggering another offer.
                    </ActionNote>
                  ) : null}
                  {!actionSummary.hasReactivationPotential &&
                  !actionSummary.shouldProtectMargin &&
                  !actionSummary.needsManualReview ? (
                    <ActionNote>
                      Healthy account. Use profile, order history, or loyalty balance as the next
                      operator surface.
                    </ActionNote>
                  ) : null}
                </div>
              ) : null}

              {"notes" in selectedCustomer && selectedCustomer.notes ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Notes / support context
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                    {selectedCustomer.notes}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyPanelCopy message="Select a customer to inspect CRM signals." />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#090d12] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function SegmentBadge({ segment }: { segment: Segment }) {
  const meta = SEGMENT_META[segment];
  return (
    <span
      title={meta.description}
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

function SegmentFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function CustomerSummaryList({
  customers,
  onSelect,
}: {
  customers: Customer[];
  onSelect: (key: string) => void;
}) {
  if (customers.length === 0) {
    return <EmptyPanelCopy message="No customer data yet." />;
  }

  return (
    <div className="space-y-3">
      {customers.map((customer, index) => (
        <button
          key={`${getCustomerKey(customer)}-${index}`}
          type="button"
          onClick={() => onSelect(getCustomerKey(customer))}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.05]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{customer.email}</p>
            <p className="truncate text-xs text-slate-500">
              {customer.name ?? "Unknown"} · {customer.orderCount} orders · {formatDate(customer.lastOrderAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold text-cyan-300">
              {formatEur(customer.netRevenueCents)}
            </div>
            <div className="text-[11px] text-slate-500">{customer.segments[0] ? SEGMENT_META[customer.segments[0]].label : "Healthy"}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-100">{value}</span>
    </div>
  );
}

function ActionNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
      {children}
    </div>
  );
}

function EmptyPanelCopy({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

function getCustomerKey(customer: Customer | null) {
  if (!customer) return "";
  return customer.type === "registered" ? customer.id : `guest:${customer.email.toLowerCase()}`;
}
