"use client";

import { useEffect, useMemo, useState } from "react";
import { HorizontalBarsChart, type AdminChartPoint } from "@/components/admin/AdminCharts";

type RegisteredCustomer = {
  type: "registered";
  id: string;
  email: string;
  name: string | null;
  joinedAt: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
};

type GuestCustomer = {
  type: "guest";
  email: string;
  name: string | null;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
};

type Customer = RegisteredCustomer | GuestCustomer;

const formatEur = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE");
};

export default function AdminCustomersClient() {
  const [registeredCustomers, setRegisteredCustomers] = useState<
    RegisteredCustomer[]
  >([]);
  const [guestCustomers, setGuestCustomers] = useState<GuestCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "registered" | "guest">("all");

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

  const allCustomers: Customer[] = useMemo(
    () => [...registeredCustomers, ...guestCustomers],
    [registeredCustomers, guestCustomers]
  );

  const filtered = useMemo(() => {
    let list: Customer[] =
      tab === "registered"
        ? registeredCustomers
        : tab === "guest"
          ? guestCustomers
          : allCustomers;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (customer) =>
          customer.email.toLowerCase().includes(q) ||
          (customer.name?.toLowerCase().includes(q) ?? false)
      );
    }

    return [...list].sort((a, b) => {
      const aDate = a.lastOrderAt ?? ("joinedAt" in a ? a.joinedAt : "");
      const bDate = b.lastOrderAt ?? ("joinedAt" in b ? b.joinedAt : "");
      return bDate.localeCompare(aDate);
    });
  }, [allCustomers, guestCustomers, query, registeredCustomers, tab]);

  const totalRevenueCents = useMemo(
    () => allCustomers.reduce((sum, customer) => sum + customer.totalSpentCents, 0),
    [allCustomers]
  );

  const repeatCustomers = useMemo(
    () => allCustomers.filter((customer) => customer.orderCount >= 2).length,
    [allCustomers]
  );

  const highValueCustomers = useMemo(
    () =>
      allCustomers.filter((customer) => customer.totalSpentCents >= 25_000).length,
    [allCustomers]
  );

  const averageSpendCents = useMemo(() => {
    if (allCustomers.length === 0) return 0;
    return Math.round(totalRevenueCents / allCustomers.length);
  }, [allCustomers.length, totalRevenueCents]);

  const segmentBars = useMemo<AdminChartPoint[]>(
    () => [
      { label: "Registered", value: registeredCustomers.length },
      { label: "Guest", value: guestCustomers.length },
      { label: "Repeat buyers", value: repeatCustomers },
      { label: "High-value", value: highValueCustomers },
    ],
    [guestCustomers.length, highValueCustomers, registeredCustomers.length, repeatCustomers]
  );

  const topCustomers = useMemo(
    () =>
      [...allCustomers]
        .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
        .slice(0, 6),
    [allCustomers]
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Customers
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              CRM and customer segmentation
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Registered and guest customers, revenue concentration, repeat-buyer
              signals, and quick drilldown into buyer history.
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
          <MetricCard label="Revenue" value={formatEur(totalRevenueCents)} />
          <MetricCard label="Repeat buyers" value={String(repeatCustomers)} />
          <MetricCard label="High value" value={String(highValueCustomers)} />
          <MetricCard label="Avg. spend" value={formatEur(averageSpendCents)} />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel
          eyebrow="Segments"
          title="Customer mix"
          description="Registered, guest, repeat and high-value buckets."
        >
          <HorizontalBarsChart data={segmentBars} colorClassName="bg-cyan-400" />
        </Panel>

        <Panel
          eyebrow="Leaders"
          title="Top spenders"
          description="Highest-value customers across both account and guest orders."
        >
          <div className="space-y-3">
            {topCustomers.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
                No customer data yet.
              </div>
            ) : (
              topCustomers.map((customer, index) => (
                <div
                  key={customer.type === "registered" ? customer.id : `${customer.email}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {customer.email}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {customer.name ?? "Unknown"} · {customer.orderCount} orders ·{" "}
                      {customer.type === "registered" ? "Registered" : "Guest"}
                    </p>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-cyan-300">
                    {formatEur(customer.totalSpentCents)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Directory"
        title="Customer records"
        description="Searchable list with segmentation filters and direct links for registered users."
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
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email or name..."
            className="h-10 min-w-[220px] flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
          />
          <span className="text-xs text-slate-500">
            {filtered.length} results
          </span>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#090d12]">
          <div className="grid grid-cols-[auto_1.2fr_0.8fr_90px_110px_110px] gap-x-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <div>Type</div>
            <div>Email</div>
            <div>Name</div>
            <div className="text-right">Orders</div>
            <div className="text-right">Spent</div>
            <div className="text-right">Last order</div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              {loading ? "Loading..." : "No customers found."}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((customer, index) => (
                <div
                  key={customer.type === "registered" ? customer.id : `${customer.email}-${index}`}
                  className="grid grid-cols-[auto_1.2fr_0.8fr_90px_110px_110px] items-center gap-x-4 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.03]"
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
                  <div className="truncate font-medium text-slate-100">
                    {customer.type === "registered" ? (
                      <a href={`/admin/users/${customer.id}`} className="hover:underline">
                        {customer.email}
                      </a>
                    ) : (
                      customer.email
                    )}
                  </div>
                  <div className="truncate text-slate-500">{customer.name ?? "—"}</div>
                  <div className="text-right tabular-nums">{customer.orderCount}</div>
                  <div className="text-right tabular-nums font-medium text-slate-100">
                    {formatEur(customer.totalSpentCents)}
                  </div>
                  <div className="text-right text-slate-500">
                    {formatDate(customer.lastOrderAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
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
