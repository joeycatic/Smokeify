"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  type AdminChartPoint,
  DonutChart,
  FunnelChart,
  HorizontalBarsChart,
  MultiSeriesTrendChart,
  SparklineChart,
} from "@/components/admin/AdminCharts";
import {
  AdminDetailPanel,
  AdminRankingTable,
  type AdminRankingTableColumn,
  AdminScopeChip,
  AdminStickyToolbar,
} from "@/components/admin/AdminAnalyticsPrimitives";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { fetchAdminJson } from "@/lib/adminClientFetch";
import {
  buildAdminAnalyticsApiHref,
  buildAdminAnalyticsHref,
} from "@/lib/adminAnalyticsUrl";
import { formatAdminMoney, formatAdminPercent } from "@/lib/adminFormatting";
import {
  ADMIN_TIME_RANGE_OPTIONS,
  type AdminTimeRangeDays,
} from "@/lib/adminTimeRange";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  type AdminStorefrontScope,
} from "@/lib/storefronts";

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

type InventorySummary = {
  stockoutCount: number;
  lowStockCount: number;
  trackedVariants: number;
};

type AdminAnalyticsOverviewPayload = {
  scope?: {
    days: number;
    storefront: "MAIN" | "GROW" | null;
    currentStart: string | Date;
    currentEnd: string | Date;
  };
  live?: LiveSnapshot;
  funnel?: Funnel;
  funnelComparison?: FunnelComparison;
  funnelTrend?: FunnelTrendPoint[];
  revenue?: Revenue;
  trends?: Trends;
  periodComparison?: PeriodComparison;
  finance?: FinanceSummary;
  previousFinance?: FinanceSummary;
  vat?: VatSummary;
  expenseMigrationRequired?: boolean;
};

type AdminAnalyticsSecondaryPayload = {
  scope?: {
    days: number;
    storefront: "MAIN" | "GROW" | null;
  };
  topProducts?: ProductPerformance[];
  underperformingProducts?: ProductPerformance[];
  stockouts?: Stockout[];
  inventory?: InventorySummary;
  customers?: CustomerSummary;
  trafficSources?: TrafficSource[];
  discountAnalysis?: DiscountInsight[];
  paymentAnalysis?: PaymentInsight[];
  retention?: Retention;
  aiQuality?: AiQuality;
};

type MerchRow =
  | (ProductPerformance & { id: string; kind: "leader" | "leak" })
  | (Stockout & { id: string; kind: "stockout" });

type MixRow =
  | (PaymentInsight & { id: string; kind: "payment" })
  | (DiscountInsight & { id: string; kind: "discount" });

type DetailPanelModel = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
  links: Array<{ label: string; href: string; tone?: "default" | "accent" }>;
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
  accountingModeLabel: "Cash-based VAT",
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

const initialInventory: InventorySummary = {
  stockoutCount: 0,
  lowStockCount: 0,
  trackedVariants: 0,
};

const windowCopy: Record<
  AdminTimeRangeDays,
  { label: string; adjective: string; horizon: string }
> = {
  30: { label: "30 days", adjective: "30-day", horizon: "current 30-day window" },
  90: { label: "3 months", adjective: "3-month", horizon: "current 3-month window" },
  365: { label: "1 year", adjective: "1-year", horizon: "current yearly window" },
};

const formatPrice = (amount: number, currency = "EUR") =>
  formatAdminMoney(amount, "de-DE", currency);

const percent = (value: number) => formatAdminPercent(value);

const formatDelta = (value: number | null, percentMode = true) => {
  if (value === null) return "No baseline";
  const numeric = percentMode ? value * 100 : value;
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${Math.round(numeric)}${percentMode ? "%" : ""}`;
};

const getRatioDelta = (current: number, previous: number) =>
  previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0;

const formatVatStatus = (value: VatSummary["status"]) => {
  if (value === "ready_for_handover") return "Ready";
  if (value === "review_required") return "Review";
  return "Estimated";
};

const toneChipClassName = {
  slate: "border-white/10 bg-white/[0.05] text-slate-100",
  emerald: "border-emerald-400/20 bg-emerald-400/12 text-emerald-100",
  violet: "border-violet-400/20 bg-violet-400/12 text-violet-100",
  amber: "border-amber-400/20 bg-amber-400/12 text-amber-100",
};

function ExecutiveMetricCard({
  label,
  value,
  detail,
  footnote,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail?: string;
  footnote?: string;
  tone?: "slate" | "emerald" | "violet" | "amber";
}) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#09111d]/92 p-4 shadow-[0_20px_48px_rgba(0,0,0,0.22)]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_45%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {label}
          </p>
          {detail ? (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneChipClassName[tone]}`}>
              {detail}
            </span>
          ) : null}
        </div>
        <div className="mt-5 text-[clamp(1.8rem,2.4vw,2.6rem)] font-semibold leading-none tracking-tight text-white">
          {value}
        </div>
        {footnote ? <p className="mt-3 text-sm text-slate-400">{footnote}</p> : null}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function SegmentButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
            option.value === value
              ? "border-cyan-300/25 bg-cyan-300/12 text-cyan-100"
              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function resolveSelectedRow<T extends { id: string }>(rows: T[], selectedId: string | null) {
  return rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
}

export default function AdminAnalyticsClient({
  initialOverview,
  initialDays,
  initialStorefrontScope,
}: {
  initialOverview: AdminAnalyticsOverviewPayload;
  initialDays: AdminTimeRangeDays;
  initialStorefrontScope: AdminStorefrontScope;
}) {
  const location = useMemo(
    () => ({
      days: initialDays,
      storefront: initialStorefrontScope,
    }),
    [initialDays, initialStorefrontScope],
  );

  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [secondaryError, setSecondaryError] = useState("");

  const [live, setLive] = useState<LiveSnapshot>(initialOverview.live ?? initialLive);
  const [funnel, setFunnel] = useState<Funnel>(initialOverview.funnel ?? initialFunnel);
  const [revenue, setRevenue] = useState<Revenue>(initialOverview.revenue ?? initialRevenue);
  const [trends, setTrends] = useState<Trends>(initialOverview.trends ?? emptyTrends);
  const [funnelTrend, setFunnelTrend] = useState<FunnelTrendPoint[]>(
    initialOverview.funnelTrend ?? [],
  );
  const [funnelComparison, setFunnelComparison] = useState<FunnelComparison>(
    initialOverview.funnelComparison ?? initialFunnelComparison,
  );
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison>(
    initialOverview.periodComparison ?? initialPeriodComparison,
  );
  const [finance, setFinance] = useState<FinanceSummary>(
    initialOverview.finance ?? initialFinanceSummary,
  );
  const [previousFinance, setPreviousFinance] = useState<FinanceSummary>(
    initialOverview.previousFinance ?? initialFinanceSummary,
  );
  const [vat, setVat] = useState<VatSummary>(initialOverview.vat ?? initialVatSummary);
  const [expenseMigrationRequired, setExpenseMigrationRequired] = useState(
    initialOverview.expenseMigrationRequired ?? false,
  );

  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [underperformingProducts, setUnderperformingProducts] = useState<ProductPerformance[]>([]);
  const [stockouts, setStockouts] = useState<Stockout[]>([]);
  const [inventory, setInventory] = useState<InventorySummary>(initialInventory);
  const [customers, setCustomers] = useState<CustomerSummary>(initialCustomers);
  const [aiQuality, setAiQuality] = useState<AiQuality>(initialAiQuality);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [discountAnalysis, setDiscountAnalysis] = useState<DiscountInsight[]>([]);
  const [paymentAnalysis, setPaymentAnalysis] = useState<PaymentInsight[]>([]);
  const [retention, setRetention] = useState<Retention>(initialRetention);

  const [selectedFunnelStage, setSelectedFunnelStage] = useState("Sessions");
  const [selectedLivePageId, setSelectedLivePageId] = useState<string | null>(null);
  const [selectedTrafficSourceLabel, setSelectedTrafficSourceLabel] = useState<string | null>(null);
  const [merchBoard, setMerchBoard] = useState<"leaders" | "leaks" | "stock">("leaders");
  const [mixBoard, setMixBoard] = useState<"payments" | "discounts">("payments");
  const [selectedMerchRowId, setSelectedMerchRowId] = useState<string | null>(null);
  const [selectedMixRowId, setSelectedMixRowId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const deferredProductQuery = useDeferredValue(productQuery);

  const applyOverviewData = (data: Partial<AdminAnalyticsOverviewPayload>) => {
    setLive(data.live ?? initialLive);
    setFunnel(data.funnel ?? initialFunnel);
    setRevenue(data.revenue ?? initialRevenue);
    setTrends(data.trends ?? emptyTrends);
    setFunnelTrend(data.funnelTrend ?? []);
    setFunnelComparison(data.funnelComparison ?? initialFunnelComparison);
    setPeriodComparison(data.periodComparison ?? initialPeriodComparison);
    setFinance(data.finance ?? initialFinanceSummary);
    setPreviousFinance(data.previousFinance ?? initialFinanceSummary);
    setVat(data.vat ?? initialVatSummary);
    setExpenseMigrationRequired(data.expenseMigrationRequired ?? false);
  };

  const applySecondaryData = (data: Partial<AdminAnalyticsSecondaryPayload>) => {
    setTopProducts(data.topProducts ?? []);
    setUnderperformingProducts(data.underperformingProducts ?? []);
    setStockouts(data.stockouts ?? []);
    setInventory(data.inventory ?? initialInventory);
    setCustomers(data.customers ?? initialCustomers);
    setTrafficSources(data.trafficSources ?? []);
    setDiscountAnalysis(data.discountAnalysis ?? []);
    setPaymentAnalysis(data.paymentAnalysis ?? []);
    setRetention(data.retention ?? initialRetention);
    setAiQuality(data.aiQuality ?? initialAiQuality);
  };

  useEffect(() => {
    applyOverviewData(initialOverview);
  }, [initialOverview]);

  const loadOverview = useCallback(async () => {
    const { response, data } = await fetchAdminJson<AdminAnalyticsOverviewPayload & { error?: string }>(
      buildAdminAnalyticsApiHref(location, "overview"),
      {
        method: "GET",
        cache: "no-store",
        slowThresholdMs: 4_500,
        slowMessage: "Analytics overview is still refreshing.",
        slowDetail: "Core finance and funnel metrics are taking longer than usual to recalculate.",
        failureMessage: "Analytics overview refresh failed.",
        failureDetail: "The primary scorecards may be stale until the next successful refresh.",
      },
    );
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load analytics overview.");
    }
    applyOverviewData(data);
  }, [location]);

  const loadSecondary = useCallback(async () => {
    const { response, data } = await fetchAdminJson<AdminAnalyticsSecondaryPayload & { error?: string }>(
      buildAdminAnalyticsApiHref(location, "secondary"),
      {
        method: "GET",
        cache: "no-store",
        slowThresholdMs: 5_500,
        slowMessage: "Secondary analytics are still loading.",
        slowDetail: "Product, acquisition, payment, and quality layers are still being assembled.",
        failureMessage: "Secondary analytics failed to load.",
        failureDetail: "The control room will keep the top-line view while slower sections retry.",
      },
    );
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load secondary analytics.");
    }
    applySecondaryData(data);
  }, [location]);

  useEffect(() => {
    let cancelled = false;
    setSecondaryLoading(true);
    setSecondaryError("");
    void loadSecondary()
      .catch((secondaryLoadError) => {
        if (cancelled) return;
        setSecondaryError(
          secondaryLoadError instanceof Error
            ? secondaryLoadError.message
            : "Failed to load secondary analytics.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setSecondaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSecondary]);

  const refreshAnalytics = async () => {
    setLoading(true);
    setError("");
    setSecondaryError("");
    try {
      await Promise.all([loadOverview(), loadSecondary()]);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : "Failed to load analytics.",
      );
    } finally {
      setLoading(false);
      setSecondaryLoading(false);
    }
  };

  const selectedRange = windowCopy[initialDays];
  const selectedStorefrontLabel = ADMIN_STOREFRONT_SCOPE_LABELS[initialStorefrontScope];
  const activeScopeStorefront = initialStorefrontScope === "ALL" ? null : initialStorefrontScope;
  const currentCurrency = finance.currency || periodComparison.currency;

  const topPagesRows = useMemo(
    () =>
      live.topPages.map((page) => ({
        id: `${page.pageType}:${page.path}`,
        ...page,
      })),
    [live.topPages],
  );
  const selectedTopPage =
    resolveSelectedRow(topPagesRows, selectedLivePageId) ?? null;

  const selectedTrafficSource =
    trafficSources.find((source) => source.label === selectedTrafficSourceLabel) ??
    trafficSources[0] ??
    null;

  const merchRows = useMemo<MerchRow[]>(() => {
    const query = deferredProductQuery.trim().toLowerCase();
    const baseRows =
      merchBoard === "leaders"
        ? topProducts.map((row) => ({ ...row, id: row.productId, kind: "leader" as const }))
        : merchBoard === "leaks"
          ? underperformingProducts.map((row) => ({
              ...row,
              id: row.productId,
              kind: "leak" as const,
            }))
          : stockouts.map((row) => ({
              ...row,
              id: row.variantId,
              kind: "stockout" as const,
            }));

    if (!query) return baseRows;
    return baseRows.filter((row) =>
      row.kind === "stockout"
        ? `${row.productTitle} ${row.variantTitle} ${row.sku ?? ""}`.toLowerCase().includes(query)
        : row.productTitle.toLowerCase().includes(query),
    );
  }, [deferredProductQuery, merchBoard, stockouts, topProducts, underperformingProducts]);
  const selectedMerchRow = resolveSelectedRow(merchRows, selectedMerchRowId);

  const mixRows = useMemo<MixRow[]>(
    () =>
      mixBoard === "payments"
        ? paymentAnalysis.map((row) => ({ ...row, id: row.method, kind: "payment" as const }))
        : discountAnalysis.map((row) => ({ ...row, id: row.code, kind: "discount" as const })),
    [discountAnalysis, mixBoard, paymentAnalysis],
  );
  const selectedMixRow = resolveSelectedRow(mixRows, selectedMixRowId);

  const topProductsColumns = useMemo<AdminRankingTableColumn<MerchRow>[]>(() => {
    if (merchBoard === "stock") {
      return [
        {
          key: "product",
          label: "Variant",
          render: (row) =>
            row.kind === "stockout" ? (
              <div>
                <div className="font-semibold text-slate-100">{row.productTitle}</div>
                <div className="mt-1 text-xs text-slate-500">{row.variantTitle}</div>
              </div>
            ) : null,
          sortValue: (row) => row.productTitle,
        },
        {
          key: "sku",
          label: "SKU",
          render: (row) => (row.kind === "stockout" ? row.sku ?? "No SKU" : "—"),
          sortValue: (row) => (row.kind === "stockout" ? row.sku ?? "" : ""),
        },
        {
          key: "available",
          label: "Available",
          align: "right",
          render: (row) => (row.kind === "stockout" ? String(row.available) : "—"),
          sortValue: (row) => (row.kind === "stockout" ? row.available : 0),
        },
      ];
    }

    return [
        {
          key: "product",
          label: merchBoard === "leaders" ? "Leader" : "Leak",
        render: (row) =>
          row.kind !== "stockout" ? (
            <div>
              <div className="font-semibold text-slate-100">{row.productTitle}</div>
              <div className="mt-1 text-xs text-slate-500">
                {row.views} views · {row.purchases} purchases
              </div>
            </div>
          ) : null,
          sortValue: (row) =>
            row.kind === "stockout" ? row.productTitle : row.productTitle,
        },
      {
        key: "revenue",
        label: merchBoard === "leaders" ? "Revenue" : "Margin",
        align: "right",
        render: (row) =>
          row.kind !== "stockout"
            ? formatPrice(
                merchBoard === "leaders" ? row.revenueCents : row.marginCents,
                currentCurrency,
              )
            : "—",
        sortValue: (row) =>
          row.kind !== "stockout"
            ? merchBoard === "leaders"
              ? row.revenueCents
              : row.marginCents
            : 0,
      },
      {
        key: "rate",
        label: merchBoard === "leaders" ? "Conversion" : "Drop-off signal",
        align: "right",
        render: (row) =>
          row.kind !== "stockout"
            ? merchBoard === "leaders"
              ? percent(row.conversionRate)
              : percent(1 - row.conversionRate)
            : "—",
        sortValue: (row) =>
          row.kind !== "stockout"
            ? merchBoard === "leaders"
              ? row.conversionRate
              : 1 - row.conversionRate
            : 0,
      },
    ];
  }, [currentCurrency, merchBoard]);

  const mixColumns = useMemo<AdminRankingTableColumn<MixRow>[]>(() => {
    if (mixBoard === "payments") {
      return [
        {
          key: "method",
          label: "Method",
          render: (row) =>
            row.kind === "payment" ? (
              <div>
                <div className="font-semibold text-slate-100">{row.method}</div>
                <div className="mt-1 text-xs text-slate-500">{row.orders} recognized orders</div>
              </div>
            ) : null,
          sortValue: (row) => (row.kind === "payment" ? row.method : ""),
        },
        {
          key: "revenue",
          label: "Revenue",
          align: "right",
          render: (row) =>
            row.kind === "payment" ? formatPrice(row.revenueCents, currentCurrency) : "—",
          sortValue: (row) => (row.kind === "payment" ? row.revenueCents : 0),
        },
        {
          key: "refunds",
          label: "Refunded",
          align: "right",
          render: (row) =>
            row.kind === "payment" ? formatPrice(row.refundedCents, currentCurrency) : "—",
          sortValue: (row) => (row.kind === "payment" ? row.refundedCents : 0),
        },
      ];
    }

    return [
      {
        key: "code",
        label: "Code",
        render: (row) =>
          row.kind === "discount" ? (
            <div>
              <div className="font-semibold text-slate-100">{row.code}</div>
              <div className="mt-1 text-xs text-slate-500">{row.orders} paid orders</div>
            </div>
          ) : null,
        sortValue: (row) => (row.kind === "discount" ? row.code : ""),
      },
      {
        key: "revenue",
        label: "Revenue",
        align: "right",
        render: (row) =>
          row.kind === "discount" ? formatPrice(row.revenueCents, currentCurrency) : "—",
        sortValue: (row) => (row.kind === "discount" ? row.revenueCents : 0),
      },
      {
        key: "discount",
        label: "Discount cost",
        align: "right",
        render: (row) =>
          row.kind === "discount" ? formatPrice(row.discountCents, currentCurrency) : "—",
        sortValue: (row) => (row.kind === "discount" ? row.discountCents : 0),
      },
    ];
  }, [currentCurrency, mixBoard]);

  const livePageColumns = useMemo<
    AdminRankingTableColumn<(typeof topPagesRows)[number]>[]
  >(
    () => [
      {
        key: "page",
        label: "Page",
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-100">{row.path}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
              {row.pageType}
            </div>
          </div>
        ),
        sortValue: (row) => row.path,
      },
      {
        key: "active",
        label: "Active now",
        align: "right",
        render: (row) => String(row.count),
        sortValue: (row) => row.count,
      },
    ],
    [],
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
  const trafficSourceMixDonut = useMemo(
    () =>
      trafficSources.slice(0, 5).map((source, index) => ({
        label: source.label,
        value: source.sessions,
        colorClassName: ["#22d3ee", "#818cf8", "#34d399", "#f59e0b", "#f87171"][index % 5],
      })),
    [trafficSources],
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
        label: "Checkout starts",
        color: "#a78bfa",
        values: funnelTrend.map((point) => point.beginCheckout),
      },
      {
        label: "Paid purchases",
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
          point.productViews > 0 ? (point.addToCart / point.productViews) * 100 : 0,
        ),
      },
      {
        label: "Cart to checkout",
        color: "#a78bfa",
        values: funnelTrend.map((point) =>
          point.addToCart > 0 ? (point.beginCheckout / point.addToCart) * 100 : 0,
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
        helper: "Traffic entering the storefront",
        color: "#22d3ee",
      },
      {
        label: "Product views",
        value: funnel.productViews,
        helper: percent(funnel.sessions > 0 ? funnel.productViews / funnel.sessions : 0),
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
  const paymentMixDonut = useMemo(
    () =>
      paymentAnalysis.map((item, index) => ({
        label: item.method,
        value: item.revenueCents,
        colorClassName: ["#a78bfa", "#22d3ee", "#34d399", "#f59e0b", "#fb7185"][index % 5],
      })),
    [paymentAnalysis],
  );
  const discountMixDonut = useMemo(
    () =>
      discountAnalysis.map((item, index) => ({
        label: item.code,
        value: item.discountCents > 0 ? item.discountCents : item.revenueCents,
        colorClassName: ["#f59e0b", "#fb7185", "#22d3ee", "#818cf8", "#34d399"][index % 5],
      })),
    [discountAnalysis],
  );
  const issueBars = useMemo<AdminChartPoint[]>(
    () =>
      aiQuality.topIssueLabels.map((item) => ({
        label: item.label,
        value: item.count,
      })),
    [aiQuality.topIssueLabels],
  );

  const funnelDetail = useMemo<DetailPanelModel>(() => {
    const completed = funnel.purchaseSessions > 0 ? funnel.purchaseSessions : funnel.paidOrders;
    switch (selectedFunnelStage) {
      case "Product views":
        return {
          eyebrow: "Selected funnel stage",
          title: "Product views",
          description:
            "This stage shows how much top-of-funnel traffic reaches actual product intent pages.",
          metrics: [
            { label: "View sessions", value: String(funnel.productViews) },
            { label: "View to cart", value: percent(funnel.viewToCartRate) },
            { label: "Traffic share", value: percent(funnel.sessions > 0 ? funnel.productViews / funnel.sessions : 0) },
          ],
          links: [
            { label: "Open catalog", href: "/admin/catalog" },
            { label: "Open reports", href: "/admin/reports" },
          ],
        };
      case "Add to cart":
        return {
          eyebrow: "Selected funnel stage",
          title: "Cart intent",
          description:
            "Cart activity shows how effectively viewed products convert into tangible buying intent.",
          metrics: [
            { label: "Add to cart", value: String(funnel.addToCart) },
            { label: "View to cart", value: percent(funnel.viewToCartRate) },
            { label: "Cart drop", value: percent(funnel.cartAbandonmentRate) },
          ],
          links: [
            { label: "Open catalog", href: "/admin/catalog" },
            { label: "Open orders", href: "/admin/orders" },
          ],
        };
      case "Begin checkout":
        return {
          eyebrow: "Selected funnel stage",
          title: "Checkout pressure",
          description:
            "Checkout starts reveal whether the cart is strong enough to turn into a payment attempt.",
          metrics: [
            { label: "Checkout starts", value: String(funnel.beginCheckout) },
            { label: "Cart to checkout", value: percent(funnel.cartToCheckoutRate) },
            {
              label: "Checkout delta",
              value: formatDelta(funnelComparison.beginCheckout.deltaRatio),
            },
          ],
          links: [
            { label: "Open orders", href: "/admin/orders", tone: "accent" },
            { label: "Open reports", href: "/admin/reports" },
          ],
        };
      case "Purchases":
        return {
          eyebrow: "Selected funnel stage",
          title: "Completed purchases",
          description:
            "Completed purchase sessions anchor the revenue side of the funnel and should track closely with paid-order truth.",
          metrics: [
            { label: "Purchase sessions", value: String(completed) },
            { label: "Session CVR", value: percent(funnel.sessionToOrderRate) },
            { label: "Paid orders", value: String(funnel.paidOrders) },
          ],
          links: [
            { label: "Open orders", href: "/admin/orders", tone: "accent" },
            { label: "Open finance", href: "/admin/finance" },
          ],
        };
      default:
        return {
          eyebrow: "Selected funnel stage",
          title: "Sessions",
          description:
            "Session volume is the operating entry point for the current window and frames the rest of the funnel.",
          metrics: [
            { label: "Sessions", value: String(funnel.sessions) },
            {
              label: "Session delta",
              value: formatDelta(funnelComparison.sessions.deltaRatio),
            },
            { label: "Checkout starts", value: String(funnel.beginCheckout) },
          ],
          links: [
            { label: "Open reports", href: "/admin/reports", tone: "accent" },
            { label: "Open analytics", href: buildAdminAnalyticsHref(location) },
          ],
        };
    }
  }, [funnel, funnelComparison, location, selectedFunnelStage]);

  const merchDetail = useMemo<DetailPanelModel>(() => {
    if (!selectedMerchRow) {
      return {
        eyebrow: "Merch detail",
        title: "No product selected",
        description: "Choose a row to inspect revenue, conversion, or stock pressure in detail.",
        metrics: [],
        links: [{ label: "Open catalog", href: "/admin/catalog" }],
      };
    }

    if (selectedMerchRow.kind === "stockout") {
      return {
        eyebrow: "Inventory detail",
        title: `${selectedMerchRow.productTitle} / ${selectedMerchRow.variantTitle}`,
        description:
          "This variant is currently unavailable. Use catalog or procurement next depending on whether the issue is merchandising or replenishment.",
        metrics: [
          { label: "Available", value: String(selectedMerchRow.available) },
          { label: "On hand", value: String(selectedMerchRow.quantityOnHand) },
          { label: "Reserved", value: String(selectedMerchRow.reserved) },
        ],
        links: [
          {
            label: "Open product",
            href: selectedMerchRow.productId
              ? `/admin/catalog/${selectedMerchRow.productId}`
              : "/admin/catalog",
            tone: "accent",
          },
          { label: "Open procurement", href: "/admin/procurement" },
        ],
      };
    }

    return {
      eyebrow: selectedMerchRow.kind === "leader" ? "Revenue leader" : "Conversion leak",
      title: selectedMerchRow.productTitle,
      description:
        selectedMerchRow.kind === "leader"
          ? "This product is leading the current revenue window and is a candidate for deeper margin, traffic-source, and stock checks."
          : "This product attracts traffic but under-converts, so it should be checked for price, PDP quality, stock, or checkout friction.",
      metrics: [
        { label: "Revenue", value: formatPrice(selectedMerchRow.revenueCents, currentCurrency) },
        { label: "Margin", value: formatPrice(selectedMerchRow.marginCents, currentCurrency) },
        { label: "Conversion", value: percent(selectedMerchRow.conversionRate) },
      ],
      links: [
        { label: "Open product", href: `/admin/catalog/${selectedMerchRow.productId}`, tone: "accent" },
        { label: "Open orders", href: "/admin/orders" },
        { label: "Open reports", href: "/admin/reports" },
      ],
    };
  }, [currentCurrency, selectedMerchRow]);

  const mixDetail = useMemo<DetailPanelModel>(() => {
    if (!selectedMixRow) {
      return {
        eyebrow: "Mix detail",
        title: "No mix row selected",
        description: "Select a payment method or discount code to inspect how it is shaping revenue quality.",
        metrics: [],
        links: [{ label: "Open finance", href: "/admin/finance" }],
      };
    }

    if (selectedMixRow.kind === "payment") {
      return {
        eyebrow: "Payment mix",
        title: selectedMixRow.method,
        description:
          "Payment mix affects charge behavior, refunds, and the quality of recognized revenue.",
        metrics: [
          { label: "Revenue", value: formatPrice(selectedMixRow.revenueCents, currentCurrency) },
          { label: "Orders", value: String(selectedMixRow.orders) },
          { label: "Refunded", value: formatPrice(selectedMixRow.refundedCents, currentCurrency) },
        ],
        links: [
          { label: "Open finance", href: "/admin/finance", tone: "accent" },
          { label: "Open orders", href: "/admin/orders" },
        ],
      };
    }

    return {
      eyebrow: "Discount mix",
      title: selectedMixRow.code,
      description:
        "Discount concentration helps determine whether revenue growth is quality-led or being bought through promotion pressure.",
      metrics: [
        { label: "Revenue", value: formatPrice(selectedMixRow.revenueCents, currentCurrency) },
        { label: "Orders", value: String(selectedMixRow.orders) },
        { label: "Discount cost", value: formatPrice(selectedMixRow.discountCents, currentCurrency) },
      ],
      links: [
        { label: "Open reports", href: "/admin/reports", tone: "accent" },
        { label: "Open discounts", href: "/admin/discounts" },
      ],
    };
  }, [currentCurrency, selectedMixRow]);

  const topRevenueDelta = getRatioDelta(finance.netRevenueCents, previousFinance.netRevenueCents);
  const contributionDelta = getRatioDelta(
    finance.contributionMarginCents,
    previousFinance.contributionMarginCents,
  );
  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#060b14] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),radial-gradient(circle_at_78%_16%,_rgba(250,204,21,0.12),_transparent_18%),radial-gradient(circle_at_72%_78%,_rgba(129,140,248,0.18),_transparent_24%),linear-gradient(135deg,_rgba(6,11,20,0.98),_rgba(10,18,35,0.96)_46%,_rgba(12,17,31,0.96))]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-200/65">
              Admin / Business Details
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-[3rem]">
              Executive control room for traffic quality, commerce pressure, and recognized revenue
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              First-party analytics workspace for live demand, conversion efficiency, margin quality,
              tax readiness, customer mix, merchandising pressure, and payment or discount dependence.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                {selectedRange.adjective} window
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-100">
                {selectedStorefrontLabel}
              </span>
              <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-violet-100">
                {live.activeVisitorCount} live visitors
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                {formatPrice(finance.contributionMarginCents, currentCurrency)} contribution
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.2)]">
            <SectionHeader
              eyebrow="Signal board"
              title="Current operating read"
              description="Fast interpretation layer for the current scope before drilling into the denser tables below."
            />
            <div className="grid gap-3">
              <ExecutiveMetricCard
                label="Net revenue"
                value={formatPrice(finance.netRevenueCents, currentCurrency)}
                detail={formatDelta(topRevenueDelta)}
                footnote="recognized top-line after VAT and refunds"
                tone="emerald"
              />
              <ExecutiveMetricCard
                label="Session CVR"
                value={percent(funnel.sessionToOrderRate)}
                detail={formatDelta(funnelComparison.sessionToOrderRate.deltaRatio)}
                footnote="session to paid purchase"
                tone="violet"
              />
              <ExecutiveMetricCard
                label="VAT state"
                value={formatVatStatus(vat.status)}
                detail={formatPrice(vat.estimatedLiabilityCents, currentCurrency)}
                footnote={vat.ordersMissingTaxCount > 0 ? `${vat.ordersMissingTaxCount} orders need tax review` : "tax coverage looks complete"}
                tone="amber"
              />
            </div>
          </div>
        </div>
      </section>

      <AdminStickyToolbar>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Window
              </div>
              <div className="flex flex-wrap gap-2">
                {ADMIN_TIME_RANGE_OPTIONS.map((option) => (
                  <AdminScopeChip
                    key={option.value}
                    href={buildAdminAnalyticsHref({
                      days: option.value,
                      storefront: initialStorefrontScope,
                    })}
                    active={option.value === initialDays}
                  >
                    {option.label}
                  </AdminScopeChip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Storefront
              </div>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "MAIN", "GROW"] as const).map((scope) => (
                  <AdminScopeChip
                    key={scope}
                    href={buildAdminAnalyticsHref({
                      days: initialDays,
                      storefront: scope,
                    })}
                    active={scope === initialStorefrontScope}
                  >
                    {ADMIN_STOREFRONT_SCOPE_LABELS[scope]}
                  </AdminScopeChip>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
              {selectedRange.horizon}
            </span>
            <AdminButton
              type="button"
              onClick={() => void refreshAnalytics()}
              className="rounded-full"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </AdminButton>
          </div>
        </div>
      </AdminStickyToolbar>

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {secondaryError ? <AdminNotice tone="warning">{secondaryError}</AdminNotice> : null}
      {secondaryLoading ? (
        <AdminNotice tone="info">
          Secondary analytics are still loading. Top-line funnel, finance, and VAT sections are already available while product, acquisition, and mix tables continue to resolve.
        </AdminNotice>
      ) : null}
      {expenseMigrationRequired ? (
        <AdminNotice tone="warning">
          Expense-backed VAT and margin support are partially unavailable until the expense migration coverage is complete for this environment.
        </AdminNotice>
      ) : null}
      {activeScopeStorefront ? (
        <AdminNotice tone="info">
          This workspace is scoped to {selectedStorefrontLabel}. Orders, events, and finance rollups are filtered to explicit storefront attribution only.
        </AdminNotice>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetricCard
          label="Gross revenue"
          value={formatPrice(periodComparison.revenue.current, currentCurrency)}
          detail={formatDelta(periodComparison.revenue.deltaRatio)}
          footnote={`${selectedRange.label} paid-order top-line`}
          tone="emerald"
        />
        <ExecutiveMetricCard
          label="Contribution"
          value={formatPrice(finance.contributionMarginCents, currentCurrency)}
          detail={formatDelta(contributionDelta)}
          footnote={`${percent(finance.contributionMarginRatio)} after COGS and fees`}
          tone="violet"
        />
        <ExecutiveMetricCard
          label="Checkout abandonment"
          value={percent(funnel.checkoutAbandonmentRate)}
          detail={formatDelta(funnelComparison.checkoutAbandonmentRate.deltaRatio)}
          footnote="drop-off after checkout start"
          tone="amber"
        />
        <ExecutiveMetricCard
          label="AOV"
          value={formatPrice(periodComparison.aov.current, currentCurrency)}
          detail={formatDelta(periodComparison.aov.deltaRatio)}
          footnote="recognized paid-order average"
          tone="slate"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <AdminPanel
          title="Funnel command layer"
          description="Track how traffic is translating into cart intent, checkout starts, and completed paid sessions across the current scope."
        >
          <SectionHeader
            eyebrow="Funnel"
            title="Stage flow and efficiency"
            description="Use the funnel, trend lines, and delta rows together to see whether demand, product intent, or checkout completion is moving."
          />
          <div className="space-y-4">
            <FunnelChart
              stages={funnelStages}
              selectedLabel={selectedFunnelStage}
              onSelect={setSelectedFunnelStage}
            />
            <MultiSeriesTrendChart
              labels={funnelLabels}
              series={funnelSeries}
              valueFormatter={(value) => `${Math.round(value)} sessions`}
            />
            <MultiSeriesTrendChart
              labels={funnelLabels}
              series={conversionRateSeries}
              valueFormatter={(value) => `${Math.round(value)}%`}
            />
          </div>
        </AdminPanel>

        <AdminDetailPanel
          eyebrow={funnelDetail.eyebrow}
          title={funnelDetail.title}
          description={funnelDetail.description}
          metrics={funnelDetail.metrics}
          links={funnelDetail.links}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminPanel
          title="Revenue quality"
          description="Recognized revenue, order flow, and margin quality aligned to the selected window rather than a fixed monthly snapshot."
        >
          <SectionHeader
            eyebrow="Performance"
            title="Revenue pace and finance truth"
            description="The sparkline tracks current-window pacing while the finance side keeps money and VAT anchored to server-side order and expense truth."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Revenue trend
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {selectedRange.horizon}
                  </div>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                  {formatPrice(periodComparison.revenue.current, currentCurrency)}
                </span>
              </div>
              <SparklineChart
                data={revenueTrend}
                valueFormatter={(value) => formatPrice(value, currentCurrency)}
              />
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Order pace
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    recognized order volume
                  </div>
                </div>
                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
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
        </AdminPanel>

        <AdminDetailPanel
          eyebrow="Finance detail"
          title={`${selectedRange.adjective} finance truth`}
          description="Margin, refunds, VAT, and tax coverage stay server-derived. Use this panel as the bridge between trend perception and accounting-safe truth."
          metrics={[
            { label: "Net revenue", value: formatPrice(finance.netRevenueCents, currentCurrency) },
            { label: "Contribution", value: formatPrice(finance.contributionMarginCents, currentCurrency) },
            { label: "VAT liability", value: formatPrice(vat.estimatedLiabilityCents, currentCurrency) },
            { label: "Tax coverage", value: percent(vat.taxCoverageRate) },
          ]}
          links={[
            { label: "Open finance", href: activeScopeStorefront ? `/admin/finance?days=${initialDays}&storefront=${activeScopeStorefront}` : `/admin/finance?days=${initialDays}`, tone: "accent" },
            { label: "Open VAT", href: "/admin/vat" },
            { label: "Open reports", href: activeScopeStorefront ? `/admin/reports?days=${initialDays}&storefront=${activeScopeStorefront}` : `/admin/reports?days=${initialDays}` },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          title="Live demand and acquisition"
          description="Combine current active pages with scoped traffic-source quality to understand what is happening now and where it came from."
        >
          <SectionHeader
            eyebrow="Live pulse"
            title="Active storefront pages"
            description="Select a live page to interpret current demand concentration, then compare it to broader source quality on the right."
          />
          <AdminRankingTable
            rows={topPagesRows}
            columns={livePageColumns}
            emptyCopy="No active storefront sessions in the current window."
            selectedRowId={selectedTopPage?.id ?? null}
            onSelectRow={(row) => setSelectedLivePageId(row.id)}
            initialSortKey="active"
          />
        </AdminPanel>

        <AdminDetailPanel
          eyebrow="Live detail"
          title={selectedTopPage?.path ?? "No live page selected"}
          description={
            selectedTopPage
              ? "Use the selected page as the fastest read on where live attention is clustering right now."
              : "No active storefront page is currently available in the rolling live window."
          }
          metrics={
            selectedTopPage
              ? [
                  { label: "Page type", value: selectedTopPage.pageType },
                  { label: "Active visitors", value: String(selectedTopPage.count) },
                  { label: "Live total", value: String(live.activeVisitorCount) },
                ]
              : []
          }
          links={[
            { label: "Open reports", href: activeScopeStorefront ? `/admin/reports?days=${initialDays}&storefront=${activeScopeStorefront}` : `/admin/reports?days=${initialDays}`, tone: "accent" },
            { label: "Open orders", href: "/admin/orders" },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <AdminPanel
          title="Traffic-source quality"
          description="Pair session volume with checkout starts so source growth can be separated from source quality."
        >
          <SectionHeader
            eyebrow="Acquisition"
            title="Sessions versus checkout starts"
            description="The bar chart shows session scale while the donut keeps the acquisition mix legible in one glance."
          />
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <HorizontalBarsChart
              data={sourceBars}
              valueFormatter={(value) => `${value} sessions`}
              colorClassName="bg-cyan-400"
              selectedLabel={selectedTrafficSource?.label}
              onSelect={setSelectedTrafficSourceLabel}
            />
            <DonutChart
              data={trafficSourceMixDonut}
              totalLabel="Sources"
              totalValue={String(trafficSources.length)}
              selectedLabel={selectedTrafficSource?.label}
              onSelect={setSelectedTrafficSourceLabel}
            />
          </div>
        </AdminPanel>

        <AdminDetailPanel
          eyebrow="Source detail"
          title={selectedTrafficSource?.label ?? "No source selected"}
          description={
            selectedTrafficSource
              ? "This source row helps distinguish between top-of-funnel scale and downstream buying intent."
              : "No source data is available for the current scope."
          }
          metrics={
            selectedTrafficSource
              ? [
                  { label: "Sessions", value: String(selectedTrafficSource.sessions) },
                  { label: "Checkout starts", value: String(selectedTrafficSource.beginCheckout) },
                  {
                    label: "Checkout rate",
                    value: percent(
                      selectedTrafficSource.sessions > 0
                        ? selectedTrafficSource.beginCheckout / selectedTrafficSource.sessions
                        : 0,
                    ),
                  },
                ]
              : []
          }
          links={[
            { label: "Open reports", href: activeScopeStorefront ? `/admin/reports?days=${initialDays}&storefront=${activeScopeStorefront}` : `/admin/reports?days=${initialDays}`, tone: "accent" },
            { label: "Open orders", href: "/admin/orders" },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          title="Merchandising pressure"
          description="Switch between revenue leaders, conversion leaks, and stockouts without leaving the analytics workspace."
        >
          <SectionHeader
            eyebrow="Merchandising"
            title="Product detail board"
            description="Search, rank, and inspect products or variants that deserve the next operational decision."
            actions={
              <SegmentButtons
                value={merchBoard}
                options={[
                  { value: "leaders", label: "Revenue leaders" },
                  { value: "leaks", label: "Conversion leaks" },
                  { value: "stock", label: "Stockouts" },
                ]}
                onChange={(value) => {
                  setMerchBoard(value);
                  setSelectedMerchRowId(null);
                }}
              />
            }
          />
          <div className="mb-4">
            <AdminInput
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Search product or SKU"
            />
          </div>
          <AdminRankingTable
            rows={merchRows}
            columns={topProductsColumns}
            emptyCopy="No merchandising rows are available for this scope."
            selectedRowId={selectedMerchRow?.id ?? null}
            onSelectRow={(row) => setSelectedMerchRowId(row.id)}
            initialSortKey={merchBoard === "stock" ? "available" : "revenue"}
          />
        </AdminPanel>

        <AdminDetailPanel
          eyebrow={merchDetail.eyebrow}
          title={merchDetail.title}
          description={merchDetail.description}
          metrics={merchDetail.metrics}
          links={merchDetail.links}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <AdminPanel
          title="Commerce mix and quality"
          description="Track whether recognized revenue depends on specific payment behaviors or promotional pressure."
        >
          <SectionHeader
            eyebrow="Mix"
            title="Payment and discount board"
            description="Switch boards to inspect how revenue quality is being shaped by payment preference or discount dependence."
            actions={
              <SegmentButtons
                value={mixBoard}
                options={[
                  { value: "payments", label: "Payments" },
                  { value: "discounts", label: "Discounts" },
                ]}
                onChange={(value) => {
                  setMixBoard(value);
                  setSelectedMixRowId(null);
                }}
              />
            }
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <AdminRankingTable
              rows={mixRows}
              columns={mixColumns}
              emptyCopy="No payment or discount data is available for this scope."
              selectedRowId={selectedMixRow?.id ?? null}
              onSelectRow={(row) => setSelectedMixRowId(row.id)}
              initialSortKey="revenue"
            />
            <DonutChart
              data={mixBoard === "payments" ? paymentMixDonut : discountMixDonut}
              totalLabel={mixBoard === "payments" ? "Payment mix" : "Promo pressure"}
              totalValue={String(mixRows.length)}
            />
          </div>
        </AdminPanel>

        <AdminDetailPanel
          eyebrow={mixDetail.eyebrow}
          title={mixDetail.title}
          description={mixDetail.description}
          metrics={mixDetail.metrics}
          links={mixDetail.links}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          title="Customer quality"
          description="Repeat rate and revenue mix indicate whether the current growth is healthy or increasingly dependent on one-off acquisition."
        >
          <SectionHeader
            eyebrow="Customers"
            title="Customer and retention mix"
            description="Read customer composition and revenue quality together to understand whether the current window is compounding."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <DonutChart
              data={customerMixDonut}
              totalLabel="Customers"
              totalValue={String(customers.registeredCount + customers.guestCount)}
            />
            <DonutChart
              data={revenueMixDonut}
              totalLabel="Revenue"
              totalValue={formatPrice(retention.newRevenueCents + retention.returningRevenueCents, currentCurrency)}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ExecutiveMetricCard
              label="Repeat rate"
              value={percent(retention.repeatCustomerRate)}
              footnote={`${customers.returningCustomerCount} returning customers`}
              tone="emerald"
            />
            <ExecutiveMetricCard
              label="High-value users"
              value={String(customers.highValueRegisteredCount)}
              footnote="registered customers above revenue threshold"
              tone="violet"
            />
          </div>
        </AdminPanel>

        <AdminPanel
          title="System quality"
          description="This stays visible in the analytics workspace so operator trust in the data and recommendations can be checked without context switching."
        >
          <SectionHeader
            eyebrow="Analyzer"
            title="Model quality and exception pressure"
            description="Fallback, low-confidence, and issue concentration help judge whether recommendation quality is a current operational risk."
          />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <ExecutiveMetricCard
              label="Analyses"
              value={String(aiQuality.totalAnalyses)}
              footnote="lifetime shared system volume"
              tone="slate"
            />
            <ExecutiveMetricCard
              label="Fallback rate"
              value={percent(aiQuality.fallbackRate)}
              footnote={`${aiQuality.feedbackTotal} feedback records`}
              tone="amber"
            />
            <ExecutiveMetricCard
              label="Correct feedback"
              value={percent(aiQuality.feedbackCorrectRate)}
              footnote={`${percent(aiQuality.lowConfidenceRate)} low-confidence share`}
              tone="emerald"
            />
          </div>
          <HorizontalBarsChart data={issueBars} colorClassName="bg-amber-400" />
          <div className="mt-4">
            <AdminDetailPanel
              eyebrow="Control actions"
              title="Next operator paths"
              description="When model quality moves, the next action usually belongs in the analyzer workflow rather than the storefront workflow."
              metrics={[
                { label: "Tracked variants", value: String(inventory.trackedVariants) },
                { label: "Low stock", value: String(inventory.lowStockCount) },
                { label: "Stockouts", value: String(inventory.stockoutCount) },
              ]}
              links={[
                { label: "Open analyzer", href: "/admin/analyzer", tone: "accent" },
                { label: "Open inventory", href: "/admin/inventory-adjustments" },
                { label: "Open customers", href: "/admin/customers" },
              ]}
            />
          </div>
        </AdminPanel>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetricCard
          label="Paid orders"
          value={String(periodComparison.paidOrders.current)}
          detail={formatDelta(periodComparison.paidOrders.deltaRatio)}
          footnote="recognized paid volume"
          tone="slate"
        />
        <ExecutiveMetricCard
          label="Refund rate"
          value={percent(periodComparison.refundRate.current)}
          detail={formatDelta(periodComparison.refundRate.deltaRatio)}
          footnote="current window refund pressure"
          tone="amber"
        />
        <ExecutiveMetricCard
          label="Tax coverage"
          value={percent(vat.taxCoverageRate)}
          detail={vat.ordersMissingTaxCount > 0 ? `${vat.ordersMissingTaxCount} missing` : "Complete"}
          footnote="orders with VAT coverage"
          tone="amber"
        />
        <ExecutiveMetricCard
          label="Recognized revenue mix"
          value={formatPrice(revenue.totalCents, currentCurrency)}
          detail={formatPrice(revenue.last30DaysCents, currentCurrency)}
          footnote="lifetime versus current scope window"
          tone="emerald"
        />
      </section>

      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <Link
          href="/admin/orders"
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          Orders
        </Link>
        <Link
          href="/admin/catalog"
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          Catalog
        </Link>
        <Link
          href={activeScopeStorefront ? `/admin/finance?days=${initialDays}&storefront=${activeScopeStorefront}` : `/admin/finance?days=${initialDays}`}
          className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/15"
        >
          Finance
        </Link>
        <Link
          href={activeScopeStorefront ? `/admin/reports?days=${initialDays}&storefront=${activeScopeStorefront}` : `/admin/reports?days=${initialDays}`}
          className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-300/15"
        >
          Reports
        </Link>
        <Link
          href="/admin/customers"
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          Customers
        </Link>
      </div>
    </div>
  );
}
