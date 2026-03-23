"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  type AdminChartPoint,
  HorizontalBarsChart,
  SparklineChart,
} from "@/components/admin/AdminCharts";

type ComparisonMetric = {
  current: number;
  previous: number;
  deltaRatio: number | null;
};

type LiveSnapshot = {
  activeVisitorCount: number;
  topPages: Array<{
    path: string;
    pageType: string;
    count: number;
  }>;
  trafficSources: Array<{
    label: string;
    count: number;
  }>;
};

type Funnel = {
  sessions: number;
  productViews: number;
  addToCart: number;
  beginCheckout: number;
  paidOrders: number;
  sessionToOrderRate: number;
  viewToCartRate: number;
  cartToCheckoutRate: number;
  checkoutToPaidRate: number;
  cartAbandonmentRate: number;
  checkoutAbandonmentRate: number;
  totalOrders: number;
  fulfilledOrders: number;
  refundedOrders: number;
  canceledOrders: number;
};

type ProductPerformance = {
  productId: string;
  productTitle: string;
  views: number;
  addToCart: number;
  beginCheckout: number;
  purchases: number;
  revenueCents: number;
  marginCents: number;
  conversionRate: number;
  addToCartRate: number;
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
  newRevenueCents: number;
  returningRevenueCents: number;
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
  newCustomerCount: number;
  returningCustomerCount: number;
  repeatRate: number;
};

type AiQuality = {
  totalAnalyses: number;
  fallbackRate: number;
  lowConfidenceRate: number;
  feedbackTotal: number;
  feedbackCorrectRate: number;
  topIssueLabels: Array<{ label: string; count: number }>;
};

type TrafficSource = {
  label: string;
  sessions: number;
  beginCheckout: number;
};

type DiscountInsight = {
  code: string;
  orders: number;
  revenueCents: number;
  discountCents: number;
};

type PaymentInsight = {
  method: string;
  orders: number;
  revenueCents: number;
  refundedCents: number;
};

type Retention = {
  repeatCustomerRate: number;
  newRevenueCents: number;
  returningRevenueCents: number;
};

type PeriodComparison = {
  currency: string;
  revenue: ComparisonMetric;
  paidOrders: ComparisonMetric;
  aov: ComparisonMetric;
  refundRate: ComparisonMetric;
};

const formatPrice = (amount: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const percent = (value: number) => `${Math.round(value * 100)}%`;

const formatDelta = (value: number | null, percentMode = true) => {
  if (value === null) return "No baseline";
  const numeric = percentMode ? value * 100 : value;
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${Math.round(numeric)}${percentMode ? "%" : ""}`;
};

const initialLive: LiveSnapshot = {
  activeVisitorCount: 0,
  topPages: [],
  trafficSources: [],
};

const initialFunnel: Funnel = {
  sessions: 0,
  productViews: 0,
  addToCart: 0,
  beginCheckout: 0,
  paidOrders: 0,
  sessionToOrderRate: 0,
  viewToCartRate: 0,
  cartToCheckoutRate: 0,
  checkoutToPaidRate: 0,
  cartAbandonmentRate: 0,
  checkoutAbandonmentRate: 0,
  totalOrders: 0,
  fulfilledOrders: 0,
  refundedOrders: 0,
  canceledOrders: 0,
};

const initialRevenue: Revenue = {
  totalCents: 0,
  last30DaysCents: 0,
  newRevenueCents: 0,
  returningRevenueCents: 0,
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
  newCustomerCount: 0,
  returningCustomerCount: 0,
  repeatRate: 0,
};

const initialAiQuality: AiQuality = {
  totalAnalyses: 0,
  fallbackRate: 0,
  lowConfidenceRate: 0,
  feedbackTotal: 0,
  feedbackCorrectRate: 0,
  topIssueLabels: [],
};

const initialRetention: Retention = {
  repeatCustomerRate: 0,
  newRevenueCents: 0,
  returningRevenueCents: 0,
};

const initialPeriodComparison: PeriodComparison = {
  currency: "EUR",
  revenue: { current: 0, previous: 0, deltaRatio: 0 },
  paidOrders: { current: 0, previous: 0, deltaRatio: 0 },
  aov: { current: 0, previous: 0, deltaRatio: 0 },
  refundRate: { current: 0, previous: 0, deltaRatio: 0 },
};

export default function AdminAnalyticsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState<LiveSnapshot>(initialLive);
  const [funnel, setFunnel] = useState<Funnel>(initialFunnel);
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [underperformingProducts, setUnderperformingProducts] = useState<ProductPerformance[]>([]);
  const [stockouts, setStockouts] = useState<Stockout[]>([]);
  const [revenue, setRevenue] = useState<Revenue>(initialRevenue);
  const [inventory, setInventory] = useState<InventorySummary>(initialInventory);
  const [trends, setTrends] = useState<Trends>(emptyTrends);
  const [customers, setCustomers] = useState<CustomerSummary>(initialCustomers);
  const [aiQuality, setAiQuality] = useState<AiQuality>(initialAiQuality);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [discountAnalysis, setDiscountAnalysis] = useState<DiscountInsight[]>([]);
  const [paymentAnalysis, setPaymentAnalysis] = useState<PaymentInsight[]>([]);
  const [retention, setRetention] = useState<Retention>(initialRetention);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison>(
    initialPeriodComparison,
  );

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
        live?: LiveSnapshot;
        funnel?: Funnel;
        revenue?: Revenue;
        topProducts?: ProductPerformance[];
        underperformingProducts?: ProductPerformance[];
        stockouts?: Stockout[];
        inventory?: InventorySummary;
        trends?: Trends;
        customers?: CustomerSummary;
        trafficSources?: TrafficSource[];
        discountAnalysis?: DiscountInsight[];
        paymentAnalysis?: PaymentInsight[];
        retention?: Retention;
        periodComparison?: PeriodComparison;
        aiQuality?: AiQuality;
      };
      setLive(data.live ?? initialLive);
      setFunnel(data.funnel ?? initialFunnel);
      setRevenue(data.revenue ?? initialRevenue);
      setTopProducts(data.topProducts ?? []);
      setUnderperformingProducts(data.underperformingProducts ?? []);
      setStockouts(data.stockouts ?? []);
      setInventory(data.inventory ?? initialInventory);
      setTrends(data.trends ?? emptyTrends);
      setCustomers(data.customers ?? initialCustomers);
      setTrafficSources(data.trafficSources ?? []);
      setDiscountAnalysis(data.discountAnalysis ?? []);
      setPaymentAnalysis(data.paymentAnalysis ?? []);
      setRetention(data.retention ?? initialRetention);
      setPeriodComparison(data.periodComparison ?? initialPeriodComparison);
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
    [trends.daily],
  );

  const ordersTrend = useMemo<AdminChartPoint[]>(
    () =>
      trends.daily.map((point) => ({
        label: point.label,
        value: point.orders,
      })),
    [trends.daily],
  );

  const sourceBars = useMemo<AdminChartPoint[]>(
    () =>
      trafficSources.map((source) => ({
        label: source.label,
        value: source.sessions,
        secondaryValue: source.beginCheckout,
      })),
    [trafficSources],
  );

  const customerMixBars = useMemo<AdminChartPoint[]>(
    () => [
      { label: "Registered", value: customers.registeredCount },
      { label: "Guest", value: customers.guestCount },
      { label: "Repeat buyers", value: customers.repeatRegisteredCount + customers.repeatGuestCount },
      { label: "High value", value: customers.highValueRegisteredCount },
      { label: "New 30d", value: customers.newCustomerCount },
      { label: "Returning 30d", value: customers.returningCustomerCount },
    ],
    [customers],
  );

  const issueBars = useMemo<AdminChartPoint[]>(
    () =>
      aiQuality.topIssueLabels.map((item) => ({
        label: item.label,
        value: item.count,
      })),
    [aiQuality.topIssueLabels],
  );

  const paymentBars = useMemo<AdminChartPoint[]>(
    () =>
      paymentAnalysis.map((item) => ({
        label: item.method,
        value: item.revenueCents,
        secondaryValue: item.orders,
      })),
    [paymentAnalysis],
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
              Live traffic, funnel health and revenue quality
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              First-party commerce analytics for live sessions, checkout pressure,
              customer quality, discounts and payment mix.
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

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Live visitors" value={String(live.activeVisitorCount)} />
          <MetricCard
            label="30d revenue"
            value={formatPrice(periodComparison.revenue.current, periodComparison.currency)}
            detail={formatDelta(periodComparison.revenue.deltaRatio)}
          />
          <MetricCard
            label="Session CVR"
            value={percent(funnel.sessionToOrderRate)}
            detail={formatDelta(funnel.sessionToOrderRate - 0)}
          />
          <MetricCard
            label="Checkout abandon"
            value={percent(funnel.checkoutAbandonmentRate)}
          />
          <MetricCard
            label="AOV"
            value={formatPrice(periodComparison.aov.current, periodComparison.currency)}
            detail={formatDelta(periodComparison.aov.deltaRatio)}
          />
          <MetricCard label="Low-stock variants" value={String(inventory.lowStockCount)} />
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
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel
              eyebrow="Live"
              title="Active pages right now"
              description="Rolling 5-minute session heartbeat across the storefront."
            >
              <div className="space-y-3">
                {live.topPages.length === 0 ? (
                  <EmptyState copy="No active storefront sessions in the current window." />
                ) : (
                  live.topPages.map((page) => (
                    <div
                      key={`${page.pageType}:${page.path}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {page.path}
                        </div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {page.pageType}
                        </div>
                      </div>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                        {page.count} active
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel
              eyebrow="Acquisition"
              title="Traffic sources"
              description="30-day first-party session volume and checkout starts."
            >
              <HorizontalBarsChart
                data={sourceBars}
                valueFormatter={(value) => `${value} sessions`}
                colorClassName="bg-cyan-400"
              />
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <Panel
              eyebrow="Revenue"
              title="Revenue trend, last 14 days"
              description={`Orders today: ${trends.orderVelocity.today} · last 7 days: ${trends.orderVelocity.last7Days} · last 30 days: ${trends.orderVelocity.last30Days}`}
            >
              <SparklineChart data={revenueTrend} />
            </Panel>

            <Panel
              eyebrow="Funnel"
              title="Funnel and abandonment"
              description="Session-based funnel stages backed by first-party event data."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <CompactMetric label="Sessions" value={String(funnel.sessions)} />
                <CompactMetric label="Product views" value={String(funnel.productViews)} />
                <CompactMetric label="Add to cart" value={String(funnel.addToCart)} />
                <CompactMetric label="Begin checkout" value={String(funnel.beginCheckout)} />
                <CompactMetric label="Paid orders" value={String(funnel.paidOrders)} />
                <CompactMetric label="Session CVR" value={percent(funnel.sessionToOrderRate)} />
                <CompactMetric label="View to cart" value={percent(funnel.viewToCartRate)} />
                <CompactMetric label="Cart to checkout" value={percent(funnel.cartToCheckoutRate)} />
                <CompactMetric label="Checkout to paid" value={percent(funnel.checkoutToPaidRate)} />
                <CompactMetric label="Cart abandon" value={percent(funnel.cartAbandonmentRate)} />
                <CompactMetric
                  label="Checkout abandon"
                  value={percent(funnel.checkoutAbandonmentRate)}
                />
                <CompactMetric label="Canceled orders" value={String(funnel.canceledOrders)} />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
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
              eyebrow="Customers"
              title="Customer mix"
              description={`Repeat rate ${percent(customers.repeatRate)} · New revenue ${formatPrice(retention.newRevenueCents)} · Returning revenue ${formatPrice(retention.returningRevenueCents)}`}
            >
              <HorizontalBarsChart
                data={customerMixBars}
                colorClassName="bg-emerald-400"
              />
            </Panel>

            <Panel
              eyebrow="Comparison"
              title="Period deltas"
              description="Current 30-day period versus the previous 30 days."
            >
              <div className="space-y-3">
                <DeltaRow
                  label="Revenue"
                  value={formatPrice(periodComparison.revenue.current, periodComparison.currency)}
                  delta={formatDelta(periodComparison.revenue.deltaRatio)}
                />
                <DeltaRow
                  label="Paid orders"
                  value={String(periodComparison.paidOrders.current)}
                  delta={formatDelta(periodComparison.paidOrders.deltaRatio)}
                />
                <DeltaRow
                  label="AOV"
                  value={formatPrice(periodComparison.aov.current, periodComparison.currency)}
                  delta={formatDelta(periodComparison.aov.deltaRatio)}
                />
                <DeltaRow
                  label="Refund rate"
                  value={percent(periodComparison.refundRate.current)}
                  delta={formatDelta(periodComparison.refundRate.deltaRatio)}
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel
              eyebrow="Products"
              title="Revenue leaders"
              description="Products with the strongest combined revenue and conversion signal."
            >
              <ProductList
                rows={topProducts}
                valueFormatter={(row) => formatPrice(row.revenueCents)}
                detailFormatter={(row) =>
                  `${row.views} views · ${percent(row.conversionRate)} CVR · ${formatPrice(
                    row.marginCents,
                  )} margin`
                }
                emptyCopy="No product performance data yet."
              />
            </Panel>

            <Panel
              eyebrow="Products"
              title="High views, weak conversion"
              description="Products getting attention but not converting well."
            >
              <ProductList
                rows={underperformingProducts}
                valueFormatter={(row) => `${row.views} views`}
                detailFormatter={(row) =>
                  `${percent(row.conversionRate)} CVR · ${row.addToCart} carts · ${row.purchases} units`
                }
                emptyCopy="No weak-conversion products in the current window."
              />
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
            <Panel
              eyebrow="Payments"
              title="Payment method mix"
              description="Paid revenue and refund exposure by payment type."
            >
              <HorizontalBarsChart
                data={paymentBars}
                valueFormatter={(value) => formatPrice(value)}
                colorClassName="bg-violet-400"
              />
            </Panel>

            <Panel
              eyebrow="Discounts"
              title="Discount code impact"
              description="Revenue generated and discount volume over the last 30 days."
            >
              <div className="space-y-3">
                {discountAnalysis.length === 0 ? (
                  <EmptyState copy="No discount-backed paid orders in the current window." />
                ) : (
                  discountAnalysis.map((item) => (
                    <div
                      key={item.code}
                      className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">
                            {item.code}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.orders} orders · {formatPrice(item.discountCents)} discount
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-cyan-300">
                          {formatPrice(item.revenueCents)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel
              eyebrow="Inventory"
              title="Stock pressure"
              description="Variants currently fully out of stock."
            >
              <div className="space-y-3">
                {stockouts.length === 0 ? (
                  <EmptyState copy="No stockouts right now." />
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
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Panel
              eyebrow="Retention"
              title="Revenue quality"
              description="How much current revenue is coming from newly acquired versus returning customers."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Repeat rate"
                  value={percent(retention.repeatCustomerRate)}
                />
                <MetricCard
                  label="New revenue"
                  value={formatPrice(retention.newRevenueCents)}
                />
                <MetricCard
                  label="Returning revenue"
                  value={formatPrice(retention.returningRevenueCents)}
                />
                <MetricCard
                  label="Lifetime revenue"
                  value={formatPrice(revenue.totalCents)}
                />
              </div>
            </Panel>

            <Panel
              eyebrow="Analyzer"
              title="Model quality"
              description={`Fallback ${percent(aiQuality.fallbackRate)} · Low confidence ${percent(aiQuality.lowConfidenceRate)} · Correct feedback ${percent(aiQuality.feedbackCorrectRate)}`}
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <CompactMetric label="Analyses" value={String(aiQuality.totalAnalyses)} />
                <CompactMetric label="Feedback" value={String(aiQuality.feedbackTotal)} />
                <CompactMetric
                  label="Correct rate"
                  value={percent(aiQuality.feedbackCorrectRate)}
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
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function DeltaRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">vs previous 30-day period</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-white">{value}</div>
        <div className="text-xs text-cyan-300">{delta}</div>
      </div>
    </div>
  );
}

function ProductList({
  rows,
  valueFormatter,
  detailFormatter,
  emptyCopy,
}: {
  rows: ProductPerformance[];
  valueFormatter: (row: ProductPerformance) => string;
  detailFormatter: (row: ProductPerformance) => string;
  emptyCopy: string;
}) {
  if (rows.length === 0) {
    return <EmptyState copy={emptyCopy} />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.productId}
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-100">
                {row.productTitle}
              </div>
              <div className="mt-1 text-xs text-slate-500">{detailFormatter(row)}</div>
            </div>
            <div className="shrink-0 text-sm font-semibold text-cyan-300">
              {valueFormatter(row)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
      {copy}
    </div>
  );
}
