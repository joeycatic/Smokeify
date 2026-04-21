"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";
import { HorizontalBarsChart } from "@/components/admin/AdminCharts";
import type {
  Customer,
  CustomerCohort,
  CustomerSegment as Segment,
  CustomerSummary,
  RegisteredCustomer,
} from "@/lib/adminCustomers";
import { ADMIN_STOREFRONT_SCOPE_LABELS, parseAdminStorefrontScope } from "@/lib/storefronts";

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

const EMPTY_SUMMARY: CustomerSummary = {
  totalCustomers: 0,
  totalNetRevenueCents: 0,
  vipCustomers: 0,
  churnRiskCustomers: 0,
  discountDrivenCustomers: 0,
  averageClvCents: 0,
  segmentBars: [],
  topCustomers: [],
  atRiskCustomers: [],
};

export default function AdminCustomersClient() {
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cohorts, setCohorts] = useState<CustomerCohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [tab, setTab] = useState<"all" | "registered" | "guest">("all");
  const [segmentFilter, setSegmentFilter] = useState<Segment | "all">("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<CustomerSummary>(EMPTY_SUMMARY);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [customerMutationId, setCustomerMutationId] = useState<string | null>(null);
  const [cohortName, setCohortName] = useState("");
  const [cohortDescription, setCohortDescription] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [flagDraft, setFlagDraft] = useState("");
  const [storeCreditAmount, setStoreCreditAmount] = useState("");
  const [storeCreditReason, setStoreCreditReason] = useState("");
  const [storeCreditPassword, setStoreCreditPassword] = useState("");
  const storefrontScope = parseAdminStorefrontScope(searchParams?.get("storefront"));
  const storefrontLabel = ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope];

  const loadCustomers = useEffectEvent(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
      if (tab !== "all") params.set("tab", tab);
      if (segmentFilter !== "all") params.set("segment", segmentFilter);
      params.set("storefront", storefrontScope);
      const res = await fetch(`/api/admin/customers?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load customers.");
        return;
      }
      const data = (await res.json()) as {
        customers?: Customer[];
        cohorts?: CustomerCohort[];
        currentPage?: number;
        totalCount?: number;
        totalPages?: number;
        summary?: CustomerSummary;
      };
      setCustomers(data.customers ?? []);
      setCohorts(data.cohorts ?? []);
      setPage(data.currentPage ?? page);
      setTotalCount(data.totalCount ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setSummary(data.summary ?? EMPTY_SUMMARY);
    } catch {
      setError("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadCustomers();
  }, [deferredQuery, page, refreshNonce, segmentFilter, storefrontScope, tab]);

  useEffect(() => {
    if (!customers.length) {
      setSelectedKey(null);
      return;
    }
    if (selectedKey && customers.some((customer) => getCustomerKey(customer) === selectedKey)) {
      return;
    }
    setSelectedKey(getCustomerKey(customers[0]));
  }, [customers, selectedKey]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => getCustomerKey(customer) === selectedKey) ?? customers[0] ?? null,
    [customers, selectedKey],
  );

  useEffect(() => {
    if (selectedCustomer?.type === "registered") {
      setNoteDraft(selectedCustomer.notes ?? "");
      setFlagDraft(selectedCustomer.crmFlags.join(", "));
    } else {
      setNoteDraft("");
      setFlagDraft("");
    }
  }, [selectedCustomer]);

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

  const updateCustomerRow = (customerId: string, updater: (customer: RegisteredCustomer) => RegisteredCustomer) => {
    setCustomers((current) =>
      current.map((customer) => {
        if (customer.type !== "registered" || customer.id !== customerId) return customer;
        return updater(customer);
      }),
    );
  };

  const saveCustomerCrm = async () => {
    if (!selectedCustomer || selectedCustomer.type !== "registered") return;
    setError("");
    setNotice("");
    setCustomerMutationId(selectedCustomer.id);
    try {
      const response = await fetch(`/api/admin/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: noteDraft,
          crmFlags: flagDraft
            .split(",")
            .map((flag) => flag.trim())
            .filter(Boolean),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        customer?: { notes: string | null; crmFlags: string[] };
      };
      if (!response.ok || !data.customer) {
        setError(data.error ?? "Failed to update CRM details.");
        return;
      }
      updateCustomerRow(selectedCustomer.id, (customer) => ({
        ...customer,
        notes: data.customer?.notes ?? null,
        crmFlags: data.customer?.crmFlags ?? [],
      }));
      setNotice("Customer CRM details updated.");
    } catch {
      setError("Failed to update CRM details.");
    } finally {
      setCustomerMutationId(null);
    }
  };

  const issueStoreCredit = async () => {
    if (!selectedCustomer || selectedCustomer.type !== "registered") return;
    setError("");
    setNotice("");
    setCustomerMutationId(selectedCustomer.id);
    try {
      const amountCents = Math.round(Number(storeCreditAmount.replace(",", ".")) * 100);
      const response = await fetch(`/api/admin/customers/${selectedCustomer.id}/store-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          reason: storeCreditReason,
          adminPassword: storeCreditPassword,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        storeCreditBalance?: number;
      };
      if (!response.ok || typeof data.storeCreditBalance !== "number") {
        setError(data.error ?? "Failed to issue store credit.");
        return;
      }
      updateCustomerRow(selectedCustomer.id, (customer) => ({
        ...customer,
        storeCreditBalance: data.storeCreditBalance!,
      }));
      setStoreCreditAmount("");
      setStoreCreditReason("");
      setStoreCreditPassword("");
      setNotice("Store credit issued.");
    } catch {
      setError("Failed to issue store credit.");
    } finally {
      setCustomerMutationId(null);
    }
  };

  const saveCohort = async () => {
    setError("");
    setNotice("");
    setCustomerMutationId("cohort");
    try {
      const response = await fetch("/api/admin/customers/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cohortName,
          description: cohortDescription,
          customerCount: totalCount,
          filters: {
            q: deferredQuery.trim() || undefined,
            tab,
            segment: segmentFilter,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        cohort?: CustomerCohort;
      };
      if (!response.ok || !data.cohort) {
        setError(data.error ?? "Failed to save cohort.");
        return;
      }
      setCohorts((current) => [data.cohort!, ...current].slice(0, 12));
      setCohortName("");
      setCohortDescription("");
      setNotice("Reactivation cohort saved.");
    } catch {
      setError("Failed to save cohort.");
    } finally {
      setCustomerMutationId(null);
    }
  };

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
            <div className="mt-4 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
              {storefrontLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRefreshNonce((prev) => prev + 1)}
            className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh customers"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Customers" value={String(summary.totalCustomers)} />
          <MetricCard label="Net revenue" value={formatEur(summary.totalNetRevenueCents)} />
          <MetricCard label="VIP / high touch" value={String(summary.vipCustomers)} />
          <MetricCard label="Churn risk" value={String(summary.churnRiskCustomers)} />
          <MetricCard label="Avg. CLV" value={formatEur(summary.averageClvCents)} />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          eyebrow="Segments"
          title="Revenue quality mix"
          description="Who is valuable, risky, discount-heavy, or newly acquired."
        >
          {summary.segmentBars.length === 0 ? (
            <EmptyPanelCopy message="No segment data available yet." />
          ) : (
            <HorizontalBarsChart data={summary.segmentBars} colorClassName="bg-cyan-400" />
          )}
        </Panel>

        <Panel
          eyebrow="Leaders"
          title="Top customer value"
          description={`Highest net revenue accounts and guests in ${storefrontLabel}.`}
        >
          <CustomerSummaryList
            customers={summary.topCustomers}
            onSelect={(customer) => {
              setQuery(customer.email);
              setPage(1);
              setSelectedKey(getCustomerKey(customer));
            }}
          />
        </Panel>

        <Panel
          eyebrow="Action queue"
          title="Customers needing attention"
          description={`Focus repeat buyers at churn risk, margin-heavy accounts, and return-risk cases in ${storefrontLabel}.`}
        >
          <CustomerSummaryList
            customers={summary.atRiskCustomers}
            onSelect={(customer) => {
              setQuery(customer.email);
              setPage(1);
              setSelectedKey(getCustomerKey(customer));
            }}
          />
        </Panel>
      </div>

      <Panel
        eyebrow="Reactivation"
        title="Saved CRM cohorts"
        description="Persist current filters as reusable cohorts for churn-risk, VIP, and discount-led follow-up work."
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
          <input
            type="text"
            value={cohortName}
            onChange={(event) => setCohortName(event.target.value)}
            placeholder="Cohort name"
            className="h-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
          />
          <input
            type="text"
            value={cohortDescription}
            onChange={(event) => setCohortDescription(event.target.value)}
            placeholder="Description (optional)"
            className="h-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
          />
          <button
            type="button"
            onClick={saveCohort}
            disabled={customerMutationId === "cohort"}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:text-cyan-300"
          >
            {customerMutationId === "cohort" ? "Saving..." : "Save current cohort"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {cohorts.length === 0 ? (
            <EmptyPanelCopy message="No saved cohorts yet." />
          ) : (
            cohorts.map((cohort) => (
              <button
                key={cohort.id}
                type="button"
                onClick={() => {
                  setQuery(cohort.filters.q ?? "");
                  setTab(cohort.filters.tab ?? "all");
                  setSegmentFilter(cohort.filters.segment ?? "all");
                  setPage(1);
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 text-left transition hover:bg-white/[0.05]"
              >
                <div className="text-sm font-semibold text-slate-100">{cohort.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {cohort.customerCount} customers · updated {formatDate(cohort.updatedAt)}
                </div>
                {cohort.description ? (
                  <p className="mt-2 text-sm text-slate-400">{cohort.description}</p>
                ) : null}
              </button>
            ))
          )}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
      <Panel
        eyebrow="Directory"
        title="Customer records"
        description="Filter by type, segment, and intent. Select a row to open the intelligence drawer."
      >
          <div className="mb-4 flex flex-col items-stretch gap-3">
            <div className="flex overflow-hidden rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold">
              {(["all", "registered", "guest"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTab(value);
                    setPage(1);
                  }}
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
                onClick={() => {
                  setSegmentFilter("all");
                  setPage(1);
                }}
              />
              {(Object.keys(SEGMENT_META) as Segment[]).map((segment) => (
                <SegmentFilterChip
                  key={segment}
                  active={segmentFilter === segment}
                  label={SEGMENT_META[segment].label}
                  onClick={() => {
                    setSegmentFilter(segment);
                    setPage(1);
                  }}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by email, name, segment, group..."
                className="h-10 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20 sm:min-w-[240px]"
              />
              <span className="text-xs text-slate-500">{totalCount} results</span>
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-[#090d12] px-4 py-10 text-center text-sm text-slate-500">
              {loading ? "Loading..." : "No customers found."}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {customers.map((customer, index) => {
                  const key = getCustomerKey(customer);
                  const isSelected = key === getCustomerKey(selectedCustomer);
                  return (
                    <button
                      key={`${key}-${index}`}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left text-sm text-slate-300 transition ${
                        isSelected
                          ? "border-cyan-400/20 bg-cyan-400/[0.07]"
                          : "border-white/10 bg-[#090d12] hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              customer.type === "registered"
                                ? "bg-emerald-400/10 text-emerald-300"
                                : "bg-amber-400/10 text-amber-300"
                            }`}
                          >
                            {customer.type === "registered" ? "Registered" : "Guest"}
                          </span>
                          <div className="mt-3 break-all font-medium text-slate-100">{customer.email}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {customer.name ?? "Unknown"} · last active {formatDate(customer.lastOrderAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-100">
                            {formatEur(customer.netRevenueCents)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{customer.orderCount} orders</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {customer.segments.slice(0, 3).map((segment) => (
                          <SegmentBadge key={segment} segment={segment} />
                        ))}
                        {customer.segments.length > 3 ? (
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">
                            +{customer.segments.length - 3}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniMetric label="Net" value={formatEur(customer.netRevenueCents)} />
                        <MiniMetric label="AOV" value={formatEur(customer.aovCents)} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="admin-data-grid-scroll hidden rounded-[24px] border border-white/10 bg-[#090d12] md:block">
                <div className="grid min-w-[760px] grid-cols-[auto_1.15fr_0.75fr_120px_110px_110px] gap-x-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  <div>Type</div>
                  <div>Email</div>
                  <div>Segments</div>
                  <div className="text-right">Orders</div>
                  <div className="text-right">Net</div>
                  <div className="text-right">AOV</div>
                </div>

                <div className="divide-y divide-white/5">
                  {customers.map((customer, index) => {
                    const key = getCustomerKey(customer);
                    const isSelected = key === getCustomerKey(selectedCustomer);
                    return (
                      <button
                        key={`${key}-${index}`}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={`grid w-full min-w-[760px] grid-cols-[auto_1.15fr_0.75fr_120px_110px_110px] items-center gap-x-4 px-4 py-3 text-left text-sm text-slate-300 transition ${
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
                            {customer.name ?? "Unknown"} · last active {formatDate(customer.lastOrderAt)}
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
              </div>
            </>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-col items-start justify-between gap-3 text-xs text-slate-400 sm:flex-row sm:items-center">
              <span>
                Page {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-9 items-center rounded-full border border-white/10 px-4 font-semibold text-slate-100 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-600"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-9 items-center rounded-full border border-white/10 px-4 font-semibold text-slate-100 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-600"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
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
                <InfoRow label="Open orders" value={String(selectedCustomer.openOrderCount)} />
                <InfoRow label="Open returns" value={String(selectedCustomer.openReturnCount)} />
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
                    <InfoRow
                      label="CRM flags"
                      value={selectedCustomer.crmFlags.length ? selectedCustomer.crmFlags.join(", ") : "—"}
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
                    onClick={() => {
                      setQuery(selectedCustomer.email);
                      setPage(1);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
                  >
                    Filter CRM by this email
                  </button>
                  {selectedCustomer.segments[0] ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentFilter(selectedCustomer.segments[0]);
                        setPage(1);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      Open {SEGMENT_META[selectedCustomer.segments[0]].label} segment
                    </button>
                  ) : null}
                  <Link
                    href={`/admin/orders?customer=${encodeURIComponent(selectedCustomer.email)}`}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
                  >
                    Open customer orders
                  </Link>
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

              {"crmFlags" in selectedCustomer && selectedCustomer.crmFlags.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    CRM flags
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCustomer.crmFlags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold text-fuchsia-100"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedCustomer.type === "registered" ? (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    CRM actions
                  </p>
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    rows={4}
                    placeholder="Internal notes"
                    className="w-full rounded-2xl border border-white/10 bg-[#090d12] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                  />
                  <input
                    type="text"
                    value={flagDraft}
                    onChange={(event) => setFlagDraft(event.target.value)}
                    placeholder="Flags, comma separated"
                    className="h-10 w-full rounded-2xl border border-white/10 bg-[#090d12] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                  />
                  <button
                    type="button"
                    onClick={saveCustomerCrm}
                    disabled={customerMutationId === selectedCustomer.id}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    {customerMutationId === selectedCustomer.id ? "Saving..." : "Save notes and flags"}
                  </button>
                </div>
              ) : null}

              {selectedCustomer.type === "registered" ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0b1016] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Store credit workflow
                  </p>
                  <div className="grid gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={storeCreditAmount}
                      onChange={(event) => setStoreCreditAmount(event.target.value)}
                      placeholder="Amount in EUR"
                      className="h-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                    />
                    <input
                      type="text"
                      value={storeCreditReason}
                      onChange={(event) => setStoreCreditReason(event.target.value)}
                      placeholder="Reason"
                      className="h-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                    />
                    <input
                      type="password"
                      value={storeCreditPassword}
                      onChange={(event) => setStoreCreditPassword(event.target.value)}
                      placeholder="Admin password"
                      className="h-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                    />
                    <button
                      type="button"
                      onClick={issueStoreCredit}
                      disabled={customerMutationId === selectedCustomer.id}
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:text-emerald-300"
                    >
                      {customerMutationId === selectedCustomer.id ? "Issuing..." : "Issue store credit"}
                    </button>
                  </div>
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
  onSelect: (customer: Customer) => void;
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
          onClick={() => onSelect(customer)}
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
