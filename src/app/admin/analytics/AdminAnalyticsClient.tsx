"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  type AdminChartPoint,
  DonutChart,
  FunnelChart,
  HorizontalBarsChart,
  MultiSeriesTrendChart,
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
  purchaseSessions: number;
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

type FunnelComparison = {
  sessions: ComparisonMetric;
  beginCheckout: ComparisonMetric;
  paidOrders: ComparisonMetric;
  purchaseSessions: ComparisonMetric;
  sessionToOrderRate: ComparisonMetric;
  checkoutAbandonmentRate: ComparisonMetric;
  cartAbandonmentRate: ComparisonMetric;
};

type FunnelTrendPoint = {
  label: string;
  sessions: number;
  productViews: number;
  addToCart: number;
  beginCheckout: number;
  purchases: number;
  paidOrders: number;
  revenueCents: number;
  sessionConversionRate: number;
  checkoutRate: number;
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

type FinanceSummary = {
  currency: string;
  paidOrderCount: number;
  recognizedOrderCount: number;
  refundedOrderCount: number;
  grossRevenueCents: number;
  refundedGrossCents: number;
  netCollectedGrossCents: number;
  outputVatCents: number;
  refundedVatEstimateCents: number;
  netOutputVatCents: number;
  netRevenueCents: number;
  shippingCollectedCents: number;
  cogsCents: number;
  paymentFeesCents: number;
  variableCostCents: number;
  contributionMarginCents: number;
  contributionMarginRatio: number;
  estimatedProfitCents: number;
  ordersMissingTaxCount: number;
  taxCoverageRate: number;
};

type VatSummary = {
  monthLabel: string;
  accountingModeLabel: string;
  taxationModeLabel: string;
  outputVatCents: number;
  refundedVatEstimateCents: number;
  inputVatCents: number;
  estimatedLiabilityCents: number;
  taxCoverageRate: number;
  ordersMissingTaxCount: number;
  status: "estimated" | "review_required" | "ready_for_handover";
  blockers: string[];
  notes: string[];
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

const formatVatStatus = (value: "estimated" | "review_required" | "ready_for_handover") => {
  if (value === "ready_for_handover") return "Ready";
  if (value === "review_required") return "Review";
  return "Estimated";
};

const getDeltaToneClassName = (value: number | null, inverted = false) => {
  if (value === null || value === 0) return "text-slate-500";
  const positive = value > 0;
  const isGood = inverted ? !positive : positive;
  return isGood ? "text-emerald-300" : "text-rose-300";
};

const getRatioDelta = (current: number, previous: number) =>
  previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0;

const getToneSurfaceClassName = (tone: "slate" | "emerald" | "violet" | "amber") =>
  tone === "emerald"
    ? "from-emerald-500/16 via-emerald-400/6 to-transparent"
    : tone === "violet"
      ? "from-violet-500/16 via-violet-400/6 to-transparent"
      : tone === "amber"
        ? "from-amber-500/18 via-amber-400/8 to-transparent"
        : "from-cyan-500/14 via-slate-400/6 to-transparent";

const getToneGlowClassName = (tone: "slate" | "emerald" | "violet" | "amber") =>
  tone === "emerald"
    ? "bg-emerald-400/20"
    : tone === "violet"
      ? "bg-violet-400/20"
      : tone === "amber"
        ? "bg-amber-400/20"
        : "bg-cyan-300/18";

const getToneValueClassName = (tone: "slate" | "emerald" | "violet" | "amber") =>
  tone === "emerald"
    ? "text-emerald-50"
    : tone === "violet"
      ? "text-violet-50"
      : tone === "amber"
        ? "text-amber-50"
        : "text-white";

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
  purchaseSessions: 0,
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

const initialFunnelComparison: FunnelComparison = {
  sessions: { current: 0, previous: 0, deltaRatio: 0 },
  beginCheckout: { current: 0, previous: 0, deltaRatio: 0 },
  paidOrders: { current: 0, previous: 0, deltaRatio: 0 },
  purchaseSessions: { current: 0, previous: 0, deltaRatio: 0 },
  sessionToOrderRate: { current: 0, previous: 0, deltaRatio: 0 },
  checkoutAbandonmentRate: { current: 0, previous: 0, deltaRatio: 0 },
  cartAbandonmentRate: { current: 0, previous: 0, deltaRatio: 0 },
};

const initialRevenue: Revenue = {
  totalCents: 0,
  last30DaysCents: 0,
  newRevenueCents: 0,
  returningRevenueCents: 0,
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

const initialFinanceSummary: FinanceSummary = {
  currency: "EUR",
  paidOrderCount: 0,
  recognizedOrderCount: 0,
  refundedOrderCount: 0,
  grossRevenueCents: 0,
  refundedGrossCents: 0,
  netCollectedGrossCents: 0,
  outputVatCents: 0,
  refundedVatEstimateCents: 0,
  netOutputVatCents: 0,
  netRevenueCents: 0,
  shippingCollectedCents: 0,
  cogsCents: 0,
  paymentFeesCents: 0,
  variableCostCents: 0,
  contributionMarginCents: 0,
  contributionMarginRatio: 0,
  estimatedProfitCents: 0,
  ordersMissingTaxCount: 0,
  taxCoverageRate: 1,
};

const initialVatSummary: VatSummary = {
  monthLabel: "",
  accountingModeLabel: "Cash-based VAT (Istversteuerung)",
  taxationModeLabel: "Regular VAT with input tax deduction",
  outputVatCents: 0,
  refundedVatEstimateCents: 0,
  inputVatCents: 0,
  estimatedLiabilityCents: 0,
  taxCoverageRate: 1,
  ordersMissingTaxCount: 0,
  status: "estimated",
  blockers: [],
  notes: [],
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
  const [trends, setTrends] = useState<Trends>(emptyTrends);
  const [funnelTrend, setFunnelTrend] = useState<FunnelTrendPoint[]>([]);
  const [funnelComparison, setFunnelComparison] = useState<FunnelComparison>(
    initialFunnelComparison,
  );
  const [customers, setCustomers] = useState<CustomerSummary>(initialCustomers);
  const [aiQuality, setAiQuality] = useState<AiQuality>(initialAiQuality);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [discountAnalysis, setDiscountAnalysis] = useState<DiscountInsight[]>([]);
  const [paymentAnalysis, setPaymentAnalysis] = useState<PaymentInsight[]>([]);
  const [retention, setRetention] = useState<Retention>(initialRetention);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison>(
    initialPeriodComparison,
  );
  const [finance, setFinance] = useState<FinanceSummary>(initialFinanceSummary);
  const [previousFinance, setPreviousFinance] = useState<FinanceSummary>(
    initialFinanceSummary,
  );
  const [vat, setVat] = useState<VatSummary>(initialVatSummary);

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
        funnelComparison?: FunnelComparison;
        funnelTrend?: FunnelTrendPoint[];
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
        finance?: FinanceSummary;
        previousFinance?: FinanceSummary;
        vat?: VatSummary;
        aiQuality?: AiQuality;
      };
      setLive(data.live ?? initialLive);
      setFunnel(data.funnel ?? initialFunnel);
      setRevenue(data.revenue ?? initialRevenue);
      setTopProducts(data.topProducts ?? []);
      setUnderperformingProducts(data.underperformingProducts ?? []);
      setStockouts(data.stockouts ?? []);
      setTrends(data.trends ?? emptyTrends);
      setFunnelTrend(data.funnelTrend ?? []);
      setFunnelComparison(data.funnelComparison ?? initialFunnelComparison);
      setCustomers(data.customers ?? initialCustomers);
      setTrafficSources(data.trafficSources ?? []);
      setDiscountAnalysis(data.discountAnalysis ?? []);
      setPaymentAnalysis(data.paymentAnalysis ?? []);
      setRetention(data.retention ?? initialRetention);
      setPeriodComparison(data.periodComparison ?? initialPeriodComparison);
      setFinance(data.finance ?? initialFinanceSummary);
      setPreviousFinance(data.previousFinance ?? initialFinanceSummary);
      setVat(data.vat ?? initialVatSummary);
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

  const discountBars = useMemo<AdminChartPoint[]>(
    () =>
      discountAnalysis.map((item) => ({
        label: item.code,
        value: item.revenueCents,
        secondaryValue: item.discountCents,
      })),
    [discountAnalysis],
  );

  const productMomentumBars = useMemo<AdminChartPoint[]>(
    () =>
      topProducts.slice(0, 6).map((item) => ({
        label: item.productTitle,
        value: item.revenueCents,
        secondaryValue: item.marginCents,
      })),
    [topProducts],
  );

  const trafficSourceMixDonut = useMemo(
    () =>
      trafficSources.slice(0, 5).map((source, index) => ({
        label: source.label,
        value: source.sessions,
        colorClassName: ["#22d3ee", "#818cf8", "#34d399", "#f59e0b", "#f87171"][index % 5],
      })),
    [trafficSources],
  );

  const paymentMixDonut = useMemo(
    () =>
      paymentAnalysis.map((item, index) => ({
        label: item.method,
        value: item.revenueCents,
        colorClassName: ["#a78bfa", "#22d3ee", "#34d399", "#f59e0b", "#fb7185"][index % 5],
      })),
    [paymentAnalysis],
  );

  const funnelLabels = useMemo(() => funnelTrend.map((point) => point.label), [funnelTrend]);

  const funnelSeries = useMemo(
    () => [
      {
        label: "Sessions",
        color: "#22d3ee",
        values: funnelTrend.map((point) => point.sessions),
      },
      {
        label: "Checkout",
        color: "#a78bfa",
        values: funnelTrend.map((point) => point.beginCheckout),
      },
      {
        label: "Purchases",
        color: "#34d399",
        values: funnelTrend.map((point) => point.purchases),
      },
    ],
    [funnelTrend],
  );

  const conversionRateSeries = useMemo(
    () => [
      {
        label: "View to cart",
        color: "#22d3ee",
        values: funnelTrend.map((point) =>
          point.productViews > 0 ? point.addToCart / point.productViews * 100 : 0,
        ),
      },
      {
        label: "Cart to checkout",
        color: "#a78bfa",
        values: funnelTrend.map((point) =>
          point.addToCart > 0 ? point.beginCheckout / point.addToCart * 100 : 0,
        ),
      },
      {
        label: "Session to purchase",
        color: "#34d399",
        values: funnelTrend.map((point) => point.sessionConversionRate * 100),
      },
    ],
    [funnelTrend],
  );

  const funnelStages = useMemo(
    () => [
      {
        label: "Sessions",
        value: funnel.sessions,
        helper: "Top-of-funnel visitors",
        color: "#22d3ee",
      },
      {
        label: "Product views",
        value: funnel.productViews,
        helper: percent(funnel.productViews > 0 && funnel.sessions > 0 ? funnel.productViews / funnel.sessions : 0),
        color: "#60a5fa",
      },
      {
        label: "Add to cart",
        value: funnel.addToCart,
        helper: percent(funnel.viewToCartRate),
        color: "#f59e0b",
      },
      {
        label: "Begin checkout",
        value: funnel.beginCheckout,
        helper: percent(funnel.cartToCheckoutRate),
        color: "#a78bfa",
      },
      {
        label: "Purchases",
        value: funnel.purchaseSessions > 0 ? funnel.purchaseSessions : funnel.paidOrders,
        helper: percent(funnel.checkoutToPaidRate),
        color: "#34d399",
      },
    ],
    [funnel],
  );

  const customerMixDonut = useMemo(
    () => [
      { label: "Registered", value: customers.registeredCount, colorClassName: "#22c55e" },
      { label: "Guest", value: customers.guestCount, colorClassName: "#f59e0b" },
      {
        label: "Repeat buyers",
        value: customers.repeatRegisteredCount + customers.repeatGuestCount,
        colorClassName: "#38bdf8",
      },
    ],
    [customers],
  );

  const revenueMixDonut = useMemo(
    () => [
      { label: "New revenue", value: retention.newRevenueCents, colorClassName: "#22c55e" },
      {
        label: "Returning revenue",
        value: retention.returningRevenueCents,
        colorClassName: "#818cf8",
      },
    ],
    [retention],
  );

  const abandonmentDonut = useMemo(() => {
    const completed = funnel.purchaseSessions > 0 ? funnel.purchaseSessions : funnel.paidOrders;
    return [
      { label: "Completed", value: completed, colorClassName: "#34d399" },
      {
        label: "Checkout drop",
        value: Math.max(funnel.beginCheckout - completed, 0),
        colorClassName: "#f59e0b",
      },
      {
        label: "Cart drop",
        value: Math.max(funnel.addToCart - funnel.beginCheckout, 0),
        colorClassName: "#f87171",
      },
    ];
  }, [funnel]);

  const netRevenueDelta = useMemo(
    () => getRatioDelta(finance.netRevenueCents, previousFinance.netRevenueCents),
    [finance.netRevenueCents, previousFinance.netRevenueCents],
  );
  const contributionMarginDelta = useMemo(
    () =>
      getRatioDelta(
        finance.contributionMarginCents,
        previousFinance.contributionMarginCents,
      ),
    [finance.contributionMarginCents, previousFinance.contributionMarginCents],
  );
  const vatLiabilityDelta = useMemo(
    () =>
      getRatioDelta(
        vat.estimatedLiabilityCents,
        previousFinance.netOutputVatCents,
      ),
    [previousFinance.netOutputVatCents, vat.estimatedLiabilityCents],
  );
  const vatStatusToneClassName =
    vat.status === "ready_for_handover"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : vat.status === "review_required"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
        : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";

  const heroSignals = [
    {
      label: "Live pulse",
      value: `${live.activeVisitorCount}`,
      detail: live.topPages[0]?.path ?? "No active page yet",
      tone: "slate" as const,
    },
    {
      label: "Revenue quality",
      value: formatPrice(finance.netRevenueCents, finance.currency),
      detail: `${percent(finance.contributionMarginRatio)} contribution`,
      tone: "emerald" as const,
    },
    {
      label: "Tax state",
      value: formatVatStatus(vat.status),
      detail: formatPrice(vat.estimatedLiabilityCents, finance.currency),
      tone: "amber" as const,
    },
  ];

  return (
    <div className="admin-legacy-page space-y-6">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#060b14] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.2),_transparent_30%),radial-gradient(circle_at_78%_14%,_rgba(250,204,21,0.12),_transparent_18%),radial-gradient(circle_at_72%_76%,_rgba(129,140,248,0.18),_transparent_24%),linear-gradient(135deg,_rgba(6,11,20,0.98),_rgba(10,18,35,0.96)_46%,_rgba(12,17,31,0.96))]" />
        <div className="pointer-events-none absolute -left-8 top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-36 w-36 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-200/65">
                  Admin / Analytics
                </p>
                <h1 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-[2.9rem]">
                  Live traffic, finance visibility and revenue quality
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  First-party commerce analytics for live sessions, checkout pressure, net revenue,
                  VAT exposure, customer quality, discounts and payment mix.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadAnalytics()}
                className="inline-flex h-11 items-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:bg-cyan-300/10"
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh analytics"}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-semibold text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
                {live.activeVisitorCount} live visitors
              </span>
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 font-semibold text-violet-100">
                {funnel.beginCheckout} checkout starts
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-100">
                {formatPrice(finance.contributionMarginCents, finance.currency)} contribution
              </span>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 font-semibold text-amber-100">
                {formatPrice(vat.estimatedLiabilityCents, finance.currency)} VAT liability
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_42%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_40%)]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Signal Board
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Fast read across traffic, margin, and tax state.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                  live
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {heroSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-white/10 bg-[#0a101c]/90 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {signal.label}
                        </div>
                        <div className={`mt-2 text-xl font-semibold ${getToneValueClassName(signal.tone)}`}>
                          {signal.value}
                        </div>
                      </div>
                      <span
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${getToneGlowClassName(signal.tone)}`}
                      />
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{signal.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Live visitors" value={String(live.activeVisitorCount)} footnote="active now" />
          <MetricCard
            label="30d gross revenue"
            value={formatPrice(periodComparison.revenue.current, periodComparison.currency)}
            detail={formatDelta(periodComparison.revenue.deltaRatio)}
            detailBadgeClassName="orders-kpi-badge-emerald"
            footnote="vs previous 30d"
            tone="emerald"
          />
          <MetricCard
            label="Net revenue"
            value={formatPrice(finance.netRevenueCents, finance.currency)}
            detail={formatDelta(netRevenueDelta)}
            detailBadgeClassName="orders-kpi-badge-emerald"
            footnote="gross less VAT and refunds"
            tone="emerald"
          />
          <MetricCard
            label="Contribution"
            value={formatPrice(finance.contributionMarginCents, finance.currency)}
            detail={formatDelta(contributionMarginDelta)}
            detailBadgeClassName="orders-kpi-badge-violet"
            footnote={`${percent(finance.contributionMarginRatio)} after COGS and fees`}
            tone="violet"
          />
          <MetricCard
            label="VAT liability"
            value={formatPrice(vat.estimatedLiabilityCents, finance.currency)}
            detail={formatDelta(vatLiabilityDelta)}
            detailBadgeClassName="orders-kpi-badge-amber"
            footnote={vat.status === "ready_for_handover" ? "handover ready" : "estimated"}
            tone="amber"
          />
          <MetricCard
            label="Session CVR"
            value={percent(funnel.sessionToOrderRate)}
            detail={formatDelta(funnelComparison.sessionToOrderRate.deltaRatio)}
            detailBadgeClassName="orders-kpi-badge-violet"
            footnote="session to paid"
            tone="violet"
          />
          <MetricCard
            label="Checkout abandon"
            value={percent(funnel.checkoutAbandonmentRate)}
            detail={formatDelta(funnelComparison.checkoutAbandonmentRate.deltaRatio)}
            detailBadgeClassName="orders-kpi-badge-amber"
            footnote="drop-off after checkout start"
            tone="amber"
          />
          <MetricCard
            label="AOV"
            value={formatPrice(periodComparison.aov.current, periodComparison.currency)}
            detail={formatDelta(periodComparison.aov.deltaRatio)}
            detailBadgeClassName="orders-kpi-badge-violet"
            footnote="average order value"
            tone="violet"
          />
          <MetricCard
            label="Tax coverage"
            value={percent(vat.taxCoverageRate)}
            detail={vat.ordersMissingTaxCount > 0 ? `${vat.ordersMissingTaxCount} missing` : "Complete"}
            detailBadgeClassName="orders-kpi-badge-slate"
            footnote="paid orders with VAT data"
          />
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
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel
              eyebrow="Trends"
              title="Revenue and conversion pressure"
              description="14-day view of sessions, checkouts and purchases, paired with paid revenue."
            >
              <div className="space-y-4">
                <MultiSeriesTrendChart
                  labels={funnelLabels}
                  series={funnelSeries}
                  valueFormatter={(value) => `${Math.round(value)} sessions`}
                />
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Paid Revenue
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          14-day paid revenue pacing
                        </div>
                      </div>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                        {formatPrice(periodComparison.revenue.current, periodComparison.currency)}
                      </span>
                    </div>
                    <SparklineChart
                      data={revenueTrend}
                      valueFormatter={(value) => formatPrice(value, periodComparison.currency)}
                    />
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Paid Orders
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          Confirmed order volume trend
                        </div>
                      </div>
                      <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
                        {periodComparison.paidOrders.current} orders
                      </span>
                    </div>
                    <SparklineChart
                      data={ordersTrend}
                      strokeClassName="stroke-violet-300"
                      fillClassName="fill-violet-400/10"
                      valueFormatter={(value) => `${Math.round(value)} orders`}
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              eyebrow="Funnel"
              title="Stage flow and abandonment"
              description="Session-based funnel stages backed by first-party storefront events."
            >
              <FunnelChart stages={funnelStages} />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CompactMetric label="Purchase sessions" value={String(funnel.purchaseSessions)} />
                <CompactMetric label="Paid orders" value={String(funnel.paidOrders)} />
                <CompactMetric label="Session CVR" value={percent(funnel.sessionToOrderRate)} />
                <CompactMetric label="Checkout to paid" value={percent(funnel.checkoutToPaidRate)} />
                <CompactMetric label="Cart abandon" value={percent(funnel.cartAbandonmentRate)} />
                <CompactMetric label="Checkout abandon" value={percent(funnel.checkoutAbandonmentRate)} />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel
              eyebrow="Conversion"
              title="Step-rate trend"
              description="Interactive rate view across the main conversion steps so you can inspect where efficiency is improving or slipping."
            >
              <MultiSeriesTrendChart
                labels={funnelLabels}
                series={conversionRateSeries}
                valueFormatter={(value) => `${Math.round(value)}%`}
              />
            </Panel>

            <Panel
              eyebrow="Products"
              title="Product momentum"
              description="Interactive revenue ranking for the strongest products in the current window."
            >
              <HorizontalBarsChart
                data={productMomentumBars}
                valueFormatter={(value) => formatPrice(value)}
                colorClassName="bg-emerald-400"
              />
            </Panel>
          </div>

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
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <HorizontalBarsChart
                  data={sourceBars}
                  valueFormatter={(value) => `${value} sessions`}
                  colorClassName="bg-cyan-400"
                />
                <DonutChart
                  data={trafficSourceMixDonut}
                  totalLabel="Sources"
                  totalValue={String(trafficSources.length)}
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
            <Panel
              eyebrow="Mix"
              title="Customer mix"
              description={`Repeat rate ${percent(customers.repeatRate)} · ${customers.newCustomerCount} new buyers in 30 days.`}
            >
              <DonutChart
                data={customerMixDonut}
                totalLabel="Customers"
                totalValue={String(customers.registeredCount + customers.guestCount)}
              />
            </Panel>

            <Panel
              eyebrow="Revenue"
              title="New vs returning revenue"
              description="Revenue quality split across newly acquired and repeat customers."
            >
              <DonutChart
                data={revenueMixDonut}
                totalLabel="30d revenue"
                totalValue={formatPrice(
                  retention.newRevenueCents + retention.returningRevenueCents,
                )}
              />
            </Panel>

            <Panel
              eyebrow="Abandonment"
              title="Cart and checkout drop-off"
              description="How many sessions fall out before becoming completed purchases."
            >
              <DonutChart
                data={abandonmentDonut}
                totalLabel="Intent"
                totalValue={String(funnel.addToCart)}
              />
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
            <Panel
              eyebrow="Customers"
              title="Customer bars"
              description="Registered, guest, repeat and high-value composition."
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
                  deltaToneClassName={getDeltaToneClassName(periodComparison.revenue.deltaRatio)}
                />
                <DeltaRow
                  label="Paid orders"
                  value={String(periodComparison.paidOrders.current)}
                  delta={formatDelta(periodComparison.paidOrders.deltaRatio)}
                  deltaToneClassName={getDeltaToneClassName(periodComparison.paidOrders.deltaRatio)}
                />
                <DeltaRow
                  label="AOV"
                  value={formatPrice(periodComparison.aov.current, periodComparison.currency)}
                  delta={formatDelta(periodComparison.aov.deltaRatio)}
                  deltaToneClassName={getDeltaToneClassName(periodComparison.aov.deltaRatio)}
                />
                <DeltaRow
                  label="Refund rate"
                  value={percent(periodComparison.refundRate.current)}
                  delta={formatDelta(periodComparison.refundRate.deltaRatio)}
                  deltaToneClassName={getDeltaToneClassName(
                    periodComparison.refundRate.deltaRatio,
                    true,
                  )}
                />
              </div>
            </Panel>

            <Panel
              eyebrow="Delta"
              title="Funnel delta snapshot"
              description="How key funnel steps moved versus the previous 30-day period."
            >
              <div className="space-y-3">
                <DeltaRow
                  label="Sessions"
                  value={String(funnelComparison.sessions.current)}
                  delta={formatDelta(funnelComparison.sessions.deltaRatio)}
                  deltaToneClassName={getDeltaToneClassName(funnelComparison.sessions.deltaRatio)}
                />
                <DeltaRow
                  label="Checkout starts"
                  value={String(funnelComparison.beginCheckout.current)}
                  delta={formatDelta(funnelComparison.beginCheckout.deltaRatio)}
                  deltaToneClassName={getDeltaToneClassName(funnelComparison.beginCheckout.deltaRatio)}
                />
                <DeltaRow
                  label="Purchase sessions"
                  value={String(funnelComparison.purchaseSessions.current)}
                  delta={formatDelta(funnelComparison.purchaseSessions.deltaRatio)}
                  deltaToneClassName={getDeltaToneClassName(
                    funnelComparison.purchaseSessions.deltaRatio,
                  )}
                />
                <DeltaRow
                  label="Cart abandon"
                  value={percent(funnel.cartAbandonmentRate)}
                  delta={formatDelta(funnelComparison.cartAbandonmentRate.deltaRatio)}
                  deltaToneClassName={getDeltaToneClassName(
                    funnelComparison.cartAbandonmentRate.deltaRatio,
                    true,
                  )}
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel
              eyebrow="Finance"
              title="Net revenue and contribution"
              description="Gross-to-net view based on paid orders, refunds, item cost snapshots and captured payment fees."
            >
              <div className="space-y-3">
                <DeltaRow
                  label="Gross revenue"
                  value={formatPrice(finance.grossRevenueCents, finance.currency)}
                  delta={formatDelta(
                    getRatioDelta(finance.grossRevenueCents, previousFinance.grossRevenueCents),
                  )}
                  deltaToneClassName={getDeltaToneClassName(
                    getRatioDelta(finance.grossRevenueCents, previousFinance.grossRevenueCents),
                  )}
                />
                <DeltaRow
                  label="Refunded gross"
                  value={formatPrice(finance.refundedGrossCents, finance.currency)}
                  delta={formatDelta(
                    getRatioDelta(finance.refundedGrossCents, previousFinance.refundedGrossCents),
                  )}
                  deltaToneClassName={getDeltaToneClassName(
                    getRatioDelta(finance.refundedGrossCents, previousFinance.refundedGrossCents),
                    true,
                  )}
                />
                <DeltaRow
                  label="Net revenue"
                  value={formatPrice(finance.netRevenueCents, finance.currency)}
                  delta={formatDelta(netRevenueDelta)}
                  deltaToneClassName={getDeltaToneClassName(netRevenueDelta)}
                />
                <DeltaRow
                  label="COGS"
                  value={formatPrice(finance.cogsCents, finance.currency)}
                  delta={formatDelta(getRatioDelta(finance.cogsCents, previousFinance.cogsCents))}
                  deltaToneClassName={getDeltaToneClassName(
                    getRatioDelta(finance.cogsCents, previousFinance.cogsCents),
                    true,
                  )}
                />
                <DeltaRow
                  label="Payment fees"
                  value={formatPrice(finance.paymentFeesCents, finance.currency)}
                  delta={formatDelta(
                    getRatioDelta(finance.paymentFeesCents, previousFinance.paymentFeesCents),
                  )}
                  deltaToneClassName={getDeltaToneClassName(
                    getRatioDelta(finance.paymentFeesCents, previousFinance.paymentFeesCents),
                    true,
                  )}
                />
                <DeltaRow
                  label="Contribution margin"
                  value={formatPrice(finance.contributionMarginCents, finance.currency)}
                  delta={formatDelta(contributionMarginDelta)}
                  deltaToneClassName={getDeltaToneClassName(contributionMarginDelta)}
                />
              </div>
            </Panel>

            <Panel
              eyebrow="VAT"
              title="VAT monitoring"
              description="Cash-based VAT estimate from paid orders with deductible input VAT sourced from recorded admin expenses."
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${vatStatusToneClassName}`}>
                  {vat.status === "ready_for_handover"
                    ? "Ready for handover"
                    : vat.status === "review_required"
                      ? "Review required"
                      : "Estimated"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {vat.accountingModeLabel}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Output VAT"
                  value={formatPrice(vat.outputVatCents, finance.currency)}
                  footnote={vat.monthLabel || "current period"}
                />
                <MetricCard
                  label="Input VAT"
                  value={formatPrice(vat.inputVatCents, finance.currency)}
                  footnote={vat.inputVatCents > 0 ? "deductible expense source captured" : "no deductible expense VAT in current window"}
                />
                <MetricCard
                  label="VAT liability"
                  value={formatPrice(vat.estimatedLiabilityCents, finance.currency)}
                  footnote="estimated Zahllast"
                  tone="amber"
                />
                <MetricCard
                  label="Sales tax coverage"
                  value={percent(vat.taxCoverageRate)}
                  footnote={`${vat.ordersMissingTaxCount} order(s) missing VAT data`}
                />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Blockers
                  </div>
                  <div className="mt-3 space-y-2">
                    {vat.blockers.length === 0 ? (
                      <EmptyState copy="No VAT blockers in the current window." />
                    ) : (
                      vat.blockers.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                        >
                          {item}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Notes
                  </div>
                  <div className="mt-3 space-y-2">
                    {vat.notes.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
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
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <HorizontalBarsChart
                  data={paymentBars}
                  valueFormatter={(value) => formatPrice(value)}
                  colorClassName="bg-violet-400"
                />
                <DonutChart
                  data={paymentMixDonut}
                  totalLabel="Methods"
                  totalValue={String(paymentAnalysis.length)}
                />
              </div>
            </Panel>

            <Panel
              eyebrow="Discounts"
              title="Discount code impact"
              description="Revenue generated and discount volume over the last 30 days."
            >
              <div className="space-y-4">
                <HorizontalBarsChart
                  data={discountBars}
                  valueFormatter={(value) => formatPrice(value)}
                  colorClassName="bg-amber-400"
                />
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
    <section className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_28%)] opacity-80 transition group-hover:opacity-100" />
      <div className="relative mb-4">
        <p className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  footnote,
  detailBadgeClassName = "orders-kpi-badge-slate",
  tone = "slate",
}: {
  label: string;
  value: string;
  detail?: string;
  footnote?: string;
  detailBadgeClassName?: string;
  tone?: "slate" | "emerald" | "violet" | "amber";
}) {
  const toneClassName =
    tone === "emerald"
      ? "orders-kpi-card-emerald"
      : tone === "violet"
        ? "orders-kpi-card-violet"
        : tone === "amber"
        ? "orders-kpi-card-amber"
        : "orders-kpi-card-slate";
  const toneSurfaceClassName = getToneSurfaceClassName(tone);
  const toneGlowClassName = getToneGlowClassName(tone);
  const toneValueClassName = getToneValueClassName(tone);
  return (
    <div
      className={`orders-kpi-card group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_38px_rgba(0,0,0,0.18)] ${toneClassName}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneSurfaceClassName}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className={`pointer-events-none absolute -right-6 top-4 h-16 w-16 rounded-full blur-2xl ${toneGlowClassName}`} />
      <div className="relative flex items-start justify-between gap-3">
        <p className="inline-flex rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {label}
        </p>
        {detail ? (
          <span className={`orders-kpi-badge rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${detailBadgeClassName}`}>
            {detail}
          </span>
        ) : null}
      </div>
      <p className={`relative mt-7 text-[clamp(2rem,2.2vw,2.7rem)] font-semibold leading-none tracking-tight ${toneValueClassName}`}>
        {value}
      </p>
      {footnote ? (
        <div className="relative mt-5 border-t border-white/10 pt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="orders-summary-tile relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] p-3">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_45%)]" />
      <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="relative mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function DeltaRow({
  label,
  value,
  delta,
  deltaToneClassName = "text-cyan-300",
}: {
  label: string;
  value: string;
  delta: string;
  deltaToneClassName?: string;
}) {
  return (
    <div className="orders-summary-tile relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_35%)]" />
      <div className="relative flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">vs previous 30-day period</div>
      </div>
        <div className="text-right">
        <div className="text-sm font-semibold text-white">{value}</div>
        <div className={`text-xs ${deltaToneClassName}`}>{delta}</div>
      </div>
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
          className="orders-summary-tile relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.02] px-4 py-3"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_38%)]" />
          <div className="relative flex items-start justify-between gap-3">
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
    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
      {copy}
    </div>
  );
}
