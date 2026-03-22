"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  type AdminChartPoint,
  HorizontalBarsChart,
  SparklineChart,
} from "@/components/admin/AdminCharts";

type Funnel = {
  totalOrders: number;
  paidOrders: number;
  fulfilledOrders: number;
  refundedOrders: number;
  canceledOrders: number;
};

type TopProduct = {
  productId: string | null;
  productTitle: string | null;
  name: string;
  units: number;
  revenueCents: number;
};

type Stockout = {
  variantId: string;
  sku: string | null;
  productId: string | null;
  productTitle: string;
  variantTitle: string;
  quantityOnHand: number;
  reserved: number;
  available: number;
};

type Revenue = {
  totalCents: number;
  last30DaysCents: number;
};

type InventorySummary = {
  stockoutCount: number;
  lowStockCount: number;
  trackedVariants: number;
};

type Trends = {
  daily: Array<{
    label: string;
    revenueCents: number;
    orders: number;
  }>;
  orderVelocity: {
    today: number;
    last7Days: number;
    last30Days: number;
  };
};

type CustomerSummary = {
  registeredCount: number;
  guestCount: number;
  repeatRegisteredCount: number;
  repeatGuestCount: number;
  highValueRegisteredCount: number;
};

type AiQuality = {
  totalAnalyses: number;
  fallbackRate: number;
  lowConfidenceRate: number;
  feedbackTotal: number;
  feedbackCorrectRate: number;
  topIssueLabels: Array<{ label: string; count: number }>;
};

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount / 100);

const percent = (value: number) => `${Math.round(value * 100)}%`;

const initialFunnel: Funnel = {
  totalOrders: 0,
  paidOrders: 0,
  fulfilledOrders: 0,
  refundedOrders: 0,
  canceledOrders: 0,
};

const initialRevenue: Revenue = {
  totalCents: 0,
  last30DaysCents: 0,
};

const initialInventory: InventorySummary = {
  stockoutCount: 0,
  lowStockCount: 0,
  trackedVariants: 0,
};

const emptyTrends: Trends = {
  daily: [],
  orderVelocity: {
    today: 0,
    last7Days: 0,
    last30Days: 0,
  },
};

const initialCustomers: CustomerSummary = {
  registeredCount: 0,
  guestCount: 0,
  repeatRegisteredCount: 0,
  repeatGuestCount: 0,
  highValueRegisteredCount: 0,
};

const initialAiQuality: AiQuality = {
  totalAnalyses: 0,
  fallbackRate: 0,
  lowConfidenceRate: 0,
  feedbackTotal: 0,
  feedbackCorrectRate: 0,
  topIssueLabels: [],
};

export default function AdminAnalyticsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [funnel, setFunnel] = useState<Funnel>(initialFunnel);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [stockouts, setStockouts] = useState<Stockout[]>([]);
  const [revenue, setRevenue] = useState<Revenue>(initialRevenue);
  const [inventory, setInventory] = useState<InventorySummary>(initialInventory);
  const [trends, setTrends] = useState<Trends>(emptyTrends);
  const [customers, setCustomers] = useState<CustomerSummary>(initialCustomers);
  const [aiQuality, setAiQuality] = useState<AiQuality>(initialAiQuality);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load analytics.");
        return;
      }
      const data = (await res.json()) as {
        funnel?: Funnel;
        revenue?: Revenue;
        topProducts?: TopProduct[];
        stockouts?: Stockout[];
        inventory?: InventorySummary;
        trends?: Trends;
        customers?: CustomerSummary;
        aiQuality?: AiQuality;
      };
      setFunnel(data.funnel ?? initialFunnel);
      setRevenue(data.revenue ?? initialRevenue);
      setTopProducts(data.topProducts ?? []);
      setStockouts(data.stockouts ?? []);
      setInventory(data.inventory ?? initialInventory);
      setTrends(data.trends ?? emptyTrends);
      setCustomers(data.customers ?? initialCustomers);
      setAiQuality(data.aiQuality ?? initialAiQuality);
    } catch {
      setError("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const revenueTrend = useMemo<AdminChartPoint[]>(
    () =>
      trends.daily.map((point) => ({
        label: point.label,
        value: point.revenueCents,
      })),
    [trends.daily]
  );

  const ordersTrend = useMemo<AdminChartPoint[]>(
    () =>
      trends.daily.map((point) => ({
        label: point.label,
        value: point.orders,
      })),
    [trends.daily]
  );

  const topProductBars = useMemo<AdminChartPoint[]>(
    () =>
      topProducts.slice(0, 6).map((item) => ({
        label: item.productTitle ?? item.name,
        value: item.revenueCents,
        secondaryValue: item.units,
      })),
    [topProducts]
  );

  const issueBars = useMemo<AdminChartPoint[]>(
    () =>
      aiQuality.topIssueLabels.map((item) => ({
        label: item.label,
        value: item.count,
      })),
    [aiQuality.topIssueLabels]
  );

  const customerMixBars = useMemo<AdminChartPoint[]>(
    () => [
      { label: "Registered", value: customers.registeredCount },
      { label: "Guest", value: customers.guestCount },
      { label: "Repeat (reg)", value: customers.repeatRegisteredCount },
      { label: "Repeat (guest)", value: customers.repeatGuestCount },
      { label: "High value", value: customers.highValueRegisteredCount },
    ],
    [customers]
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Analytics
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Revenue, conversion, inventory and CRM
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Operational readout for commerce, stock pressure, customer mix, and
              analyzer quality.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.1]"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh analytics"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Lifetime revenue" value={formatPrice(revenue.totalCents)} />
          <MetricCard label="30d revenue" value={formatPrice(revenue.last30DaysCents)} />
          <MetricCard
            label="Paid conversion"
            value={
              funnel.totalOrders > 0
                ? `${Math.round((funnel.paidOrders / funnel.totalOrders) * 100)}%`
                : "0%"
            }
          />
          <MetricCard label="Low-stock variants" value={String(inventory.lowStockCount)} />
          <MetricCard label="Stockouts" value={String(inventory.stockoutCount)} />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[18rem] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3 text-slate-300">
            <LoadingSpinner size="lg" />
            <span className="text-sm font-semibold">Loading analytics...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <Panel
              eyebrow="Trend"
              title="Revenue, last 14 days"
              description={`Orders today: ${trends.orderVelocity.today} · last 7 days: ${trends.orderVelocity.last7Days} · last 30 days: ${trends.orderVelocity.last30Days}`}
            >
              <SparklineChart data={revenueTrend} />
            </Panel>

            <Panel
              eyebrow="Funnel"
              title="Conversion health"
              description="Raw order lifecycle counts."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Orders" value={String(funnel.totalOrders)} compact />
                <MetricCard label="Paid" value={String(funnel.paidOrders)} compact />
                <MetricCard
                  label="Fulfilled"
                  value={String(funnel.fulfilledOrders)}
                  compact
                />
                <MetricCard label="Refunded" value={String(funnel.refundedOrders)} compact />
                <MetricCard label="Canceled" value={String(funnel.canceledOrders)} compact />
                <MetricCard
                  label="Tracked variants"
                  value={String(inventory.trackedVariants)}
                  compact
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_1.15fr_0.8fr]">
            <Panel
              eyebrow="Orders"
              title="Daily order volume"
              description="Recent order count trend."
            >
              <SparklineChart
                data={ordersTrend}
                strokeClassName="stroke-violet-300"
                fillClassName="fill-violet-400/10"
              />
            </Panel>

            <Panel
              eyebrow="Top products"
              title="Revenue leaders"
              description="Highest revenue products from order snapshots."
            >
              <HorizontalBarsChart
                data={topProductBars}
                valueFormatter={(value) => formatPrice(value)}
                colorClassName="bg-emerald-400"
              />
            </Panel>

            <Panel
              eyebrow="Customers"
              title="Customer mix"
              description="Registered, guest and repeat segments."
            >
              <HorizontalBarsChart
                data={customerMixBars}
                colorClassName="bg-cyan-400"
              />
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel
              eyebrow="Inventory"
              title="Stock pressure"
              description="Variants currently fully out of stock."
            >
              <div className="space-y-3">
                {stockouts.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400">
                    No stockouts right now.
                  </div>
                ) : (
                  stockouts.slice(0, 6).map((item) => (
                    <div
                      key={item.variantId}
                      className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {item.productTitle}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {item.variantTitle}
                            {item.sku ? ` · SKU ${item.sku}` : ""}
                          </p>
                        </div>
                        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold text-red-200">
                          0 available
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel
              eyebrow="Analyzer"
              title="Model quality"
              description={`Fallback ${percent(aiQuality.fallbackRate)} · Low confidence ${percent(aiQuality.lowConfidenceRate)} · Correct feedback ${percent(aiQuality.feedbackCorrectRate)}`}
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Analyses" value={String(aiQuality.totalAnalyses)} compact />
                <MetricCard label="Feedback" value={String(aiQuality.feedbackTotal)} compact />
                <MetricCard
                  label="Correct rate"
                  value={percent(aiQuality.feedbackCorrectRate)}
                  compact
                />
              </div>
              <HorizontalBarsChart data={issueBars} colorClassName="bg-amber-400" />
            </Panel>
          </div>
        </>
      )}
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

function MetricCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 font-semibold text-white ${compact ? "text-xl" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}
