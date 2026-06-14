"use client";

import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  DonutChart,
  HorizontalBarsChart,
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
  AdminCompactMetric,
  AdminDeltaRow,
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
import type {
  AdminAnalyticsOverviewPayload,
  AdminAnalyticsSecondaryPayload,
} from "@/lib/adminAnalyticsPageData";
import {
  ADMIN_TIME_RANGE_OPTIONS,
  type AdminTimeRangeDays,
} from "@/lib/adminTimeRange";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  type AdminStorefrontScope,
} from "@/lib/storefronts";

type ExecutiveMetric = NonNullable<AdminAnalyticsOverviewPayload["executive"]>["metrics"][number];
type RevenueConversionData = NonNullable<AdminAnalyticsOverviewPayload["revenueConversion"]>;
type ActionCenterData = NonNullable<AdminAnalyticsOverviewPayload["actionCenter"]>;
type ActionItem = ActionCenterData["items"][number];
type ActionIssueType = ActionItem["type"];
type LiveSnapshot = NonNullable<
  NonNullable<AdminAnalyticsOverviewPayload["acquisition"]>["live"]
>;
type TrafficSource = NonNullable<
  NonNullable<AdminAnalyticsSecondaryPayload["acquisition"]>["trafficSources"]
>[number];
type OperationsData = NonNullable<AdminAnalyticsSecondaryPayload["operations"]>;

type DetailPanelModel = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
  links: Array<{ label: string; href: string; tone?: "default" | "accent" }>;
};

type OperationRow = {
  id: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryValue: string;
  primarySort: number;
  secondaryLabel?: string;
  secondaryValue?: string;
  secondarySort?: number;
  chartValue: number;
  chartSecondaryValue?: number;
  detail: DetailPanelModel;
};

type OperationsTabId =
  | "products"
  | "inventory"
  | "payments"
  | "discounts"
  | "customers"
  | "system";

type ProductBoard = "leaders" | "leaks";
type ActionIssueFilter = "all" | ActionIssueType;

const emptyExecutive = {
  updatedAt: "",
  metrics: [] as ExecutiveMetric[],
};

const emptyActionCenter = {
  items: [] as ActionItem[],
  counts: {
    critical: 0,
    warning: 0,
    info: 0,
  },
} satisfies ActionCenterData;

const emptyRevenueConversion = {
  revenue: {
    totalCents: 0,
    last30DaysCents: 0,
    newRevenueCents: 0,
    returningRevenueCents: 0,
  },
  funnel: {
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
  },
  funnelComparison: {
    sessions: { current: 0, previous: 0, deltaRatio: 0 },
    beginCheckout: { current: 0, previous: 0, deltaRatio: 0 },
    paidOrders: { current: 0, previous: 0, deltaRatio: 0 },
    purchaseSessions: { current: 0, previous: 0, deltaRatio: 0 },
    sessionToOrderRate: { current: 0, previous: 0, deltaRatio: 0 },
    checkoutAbandonmentRate: { current: 0, previous: 0, deltaRatio: 0 },
    cartAbandonmentRate: { current: 0, previous: 0, deltaRatio: 0 },
  },
  trend: [] as RevenueConversionData["trend"],
  periodComparison: {
    currency: "EUR",
    revenue: { current: 0, previous: 0, deltaRatio: 0 },
    paidOrders: { current: 0, previous: 0, deltaRatio: 0 },
    aov: { current: 0, previous: 0, deltaRatio: 0 },
    refundRate: { current: 0, previous: 0, deltaRatio: 0 },
  },
  finance: {
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
  },
  previousFinance: {
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
  },
  vat: {
    monthLabel: "",
    accountingModeLabel: "Cash-based VAT",
    taxationModeLabel: "Regular VAT",
    outputVatCents: 0,
    refundedVatEstimateCents: 0,
    inputVatCents: 0,
    estimatedLiabilityCents: 0,
    taxCoverageRate: 1,
    ordersMissingTaxCount: 0,
    status: "estimated",
    blockers: [],
    notes: [],
  },
  expenseMigrationRequired: false,
  orderVelocity: {
    today: 0,
    last7Days: 0,
    last30Days: 0,
  },
} satisfies RevenueConversionData;

const emptyLiveSnapshot = {
  activeVisitorCount: 0,
  topPages: [],
  trafficSources: [],
} satisfies LiveSnapshot;

const emptyOperations = {
  merchandising: {
    leaders: [],
    leaks: [],
  },
  inventory: {
    summary: {
      stockoutCount: 0,
      lowStockCount: 0,
      trackedVariants: 0,
    },
    stockouts: [],
    risk: {
      summary: {
        criticalCount: 0,
        warningCount: 0,
        trackedRiskCount: 0,
        revenueAtRiskCents: 0,
      },
      rows: [],
    },
  },
  customers: {
    summary: {
      registeredCount: 0,
      guestCount: 0,
      repeatRegisteredCount: 0,
      repeatGuestCount: 0,
      highValueRegisteredCount: 0,
      newCustomerCount: 0,
      returningCustomerCount: 0,
      repeatRate: 0,
    },
    retention: {
      repeatCustomerRate: 0,
      newRevenueCents: 0,
      returningRevenueCents: 0,
    },
  },
  commerceMix: {
    payments: [],
    discounts: [],
    discountEfficiency: [],
  },
  system: {
    aiQuality: {
      totalAnalyses: 0,
      fallbackRate: 0,
      lowConfidenceRate: 0,
      feedbackTotal: 0,
      feedbackCorrectRate: 0,
      topIssueLabels: [],
    },
    checkoutRecovery: {
      sessions: 0,
      consentGrantedSessions: 0,
      completedSessions: 0,
      suppressedSessions: 0,
      recoveredOrders: 0,
      recoveredRevenueCents: 0,
      failedAttempts: 0,
      dueAttempts: 0,
      consentRate: 0,
      recoveryRate: 0,
      suppressionRate: 0,
    },
    returns: {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      pendingRate: 0,
    },
  },
} satisfies OperationsData;

const emptySecondaryPayload = {
  scope: {
    days: 30,
    storefront: null,
    currentStart: new Date(0),
    currentEnd: new Date(0),
  },
  trust: {
    eventStorage: "event_backed",
    sourceQualitySource: "analytics_events",
    moneyAuthority: "server",
    refreshedAt: "",
  },
  actionCenter: emptyActionCenter,
  inventoryRisk: {
    summary: {
      criticalCount: 0,
      warningCount: 0,
      trackedRiskCount: 0,
      revenueAtRiskCents: 0,
    },
    rows: [],
  },
  topProducts: [],
  underperformingProducts: [],
  stockouts: [],
  inventory: emptyOperations.inventory.summary,
  customers: emptyOperations.customers.summary,
  trafficSources: [],
  sourceQuality: {
    eventStorage: "event_backed",
    sources: [],
    weakSources: [],
  },
  discountAnalysis: [],
  discountEfficiency: [],
  paymentAnalysis: [],
  checkoutRecovery: {
    sessions: 0,
    consentGrantedSessions: 0,
    completedSessions: 0,
    suppressedSessions: 0,
    recoveredOrders: 0,
    recoveredRevenueCents: 0,
    failedAttempts: 0,
    dueAttempts: 0,
    consentRate: 0,
    recoveryRate: 0,
    suppressionRate: 0,
  },
  returns: {
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    pendingRate: 0,
  },
  retention: emptyOperations.customers.retention,
  aiQuality: emptyOperations.system.aiQuality,
  acquisition: {
    trafficSources: [] as TrafficSource[],
    sourceQuality: {
      eventStorage: "event_backed",
      sources: [],
      weakSources: [],
    },
  },
  operations: emptyOperations,
} satisfies AdminAnalyticsSecondaryPayload;

const toneBadgeClassName = {
  slate: "border-white/10 bg-white/[0.06] text-slate-100",
  emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  violet: "border-violet-400/20 bg-violet-400/10 text-violet-100",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
};

const windowCopy: Record<
  AdminTimeRangeDays,
  { label: string; adjective: string; horizon: string }
> = {
  30: { label: "30 days", adjective: "30-day", horizon: "current 30-day window" },
  90: { label: "3 months", adjective: "3-month", horizon: "current 3-month window" },
  365: { label: "1 year", adjective: "1-year", horizon: "current yearly window" },
};

const chartPalette = ["#22d3ee", "#818cf8", "#34d399", "#f59e0b", "#fb7185", "#c084fc"];

const formatPrice = (amount: number, currency = "EUR") =>
  formatAdminMoney(amount, "de-DE", currency);

const formatCount = (value: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);

const percent = (value: number) => formatAdminPercent(value);

const formatDelta = (value: number | null) => {
  if (value === null) return "Live";
  const rounded = Math.round(value * 100);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
};

const formatVatStatus = (value: string) => {
  if (value === "ready_for_handover") return "Ready";
  if (value === "review_required") return "Review";
  return "Estimated";
};

const formatUpdatedAt = (value: string) => {
  if (!value) return "Awaiting refresh";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Awaiting refresh";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatWindowDate = (value: string | Date | undefined) => {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

const issueTypeLabel: Record<ActionIssueType, string> = {
  revenue: "Revenue",
  conversion: "Conversion",
  inventory: "Inventory",
  tax: "Tax",
  returns: "Returns",
  recovery: "Recovery",
  products: "Products",
  discounts: "Discounts",
  acquisition: "Acquisition",
};

const severityClassName: Record<ActionItem["severity"], string> = {
  critical: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  info: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
};

const formatActionMetric = (
  value: number | string | null | undefined,
  kind: "currency" | "percent" | "count" | "text",
  currency = "EUR",
) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "-";
  if (kind === "currency") return formatPrice(value, currency);
  if (kind === "percent") return percent(value);
  if (kind === "count") return formatCount(value);
  return String(value);
};

function resolveSelectedRow<T extends { id: string }>(rows: T[], selectedId: string | null) {
  return rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
}

function WorkspaceHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
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
              ? "border-cyan-300/30 bg-cyan-300/14 text-cyan-100"
              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OperationsTabs({
  activeTab,
  onChange,
}: {
  activeTab: OperationsTabId;
  onChange: (tab: OperationsTabId) => void;
}) {
  const tabs: Array<{ id: OperationsTabId; label: string }> = [
    { id: "products", label: "Products" },
    { id: "inventory", label: "Inventory" },
    { id: "payments", label: "Payments" },
    { id: "discounts", label: "Discounts" },
    { id: "customers", label: "Customers" },
    { id: "system", label: "System" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
            tab.id === activeTab
              ? "border-cyan-300/30 bg-cyan-300/14 text-cyan-100"
              : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function CommandDeck({
  metrics,
  currency,
  storefrontLabel,
  rangeLabel,
  updatedAt,
}: {
  metrics: ExecutiveMetric[];
  currency: string;
  storefrontLabel: string;
  rangeLabel: string;
  updatedAt: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,20,0.98),rgba(4,8,14,0.98))] px-4 py-5 shadow-[0_40px_100px_rgba(0,0,0,0.28)] sm:px-6 sm:py-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.14),transparent_28%)]" />
      <div className="relative">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              All-store Admin
            </p>
            <h1 className="mt-3 text-[clamp(2rem,3vw,3rem)] font-semibold tracking-tight text-white">
              Analytics
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Finance-safe revenue truth first, acquisition quality second, and compact
              operational context without forcing the page into a dashboard mosaic.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                {storefrontLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                {rangeLabel}
              </span>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Refreshed {formatUpdatedAt(updatedAt)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.id} metric={metric} currency={currency} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionCenter({
  items,
  selectedIssueType,
  onSelectIssueType,
  selectedActionId,
  onSelectActionId,
  currency,
  overviewTrust,
  secondaryTrust,
  marginTrend,
  currentStart,
  currentEnd,
}: {
  items: ActionItem[];
  selectedIssueType: ActionIssueFilter;
  onSelectIssueType: (value: ActionIssueFilter) => void;
  selectedActionId: string | null;
  onSelectActionId: (value: string | null) => void;
  currency: string;
  overviewTrust?: AdminAnalyticsOverviewPayload["trust"];
  secondaryTrust?: AdminAnalyticsSecondaryPayload["trust"];
  marginTrend?: AdminAnalyticsOverviewPayload["marginTrend"];
  currentStart?: Date;
  currentEnd?: Date;
}) {
  const issueOptions = useMemo(() => {
    const presentTypes = Array.from(new Set(items.map((item) => item.type)));
    return [
      { value: "all" as const, label: "All" },
      ...presentTypes.map((type) => ({ value: type, label: issueTypeLabel[type] })),
    ];
  }, [items]);
  const filteredItems =
    selectedIssueType === "all"
      ? items
      : items.filter((item) => item.type === selectedIssueType);
  const selectedAction =
    filteredItems.find((item) => item.id === selectedActionId) ?? filteredItems[0] ?? null;
  const criticalCount = items.filter((item) => item.severity === "critical").length;
  const warningCount = items.filter((item) => item.severity === "warning").length;
  const infoCount = items.filter((item) => item.severity === "info").length;

  useEffect(() => {
    if (filteredItems.length === 0) {
      onSelectActionId(null);
      return;
    }
    if (!selectedActionId || !filteredItems.some((item) => item.id === selectedActionId)) {
      onSelectActionId(filteredItems[0].id);
    }
  }, [filteredItems, onSelectActionId, selectedActionId]);

  return (
    <section className="space-y-4">
      <WorkspaceHeader
        eyebrow="Action center"
        title="Priority issues and next admin moves"
        description="Server-ranked issues combine finance, conversion, inventory, returns, recovery, discounts, and acquisition signals."
        actions={
          <div className="flex flex-wrap gap-2">
            {issueOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelectIssueType(option.value)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  option.value === selectedIssueType
                    ? "border-cyan-300/30 bg-cyan-300/14 text-cyan-100"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <AdminPanel
          title="Ranked actions"
          description="Critical issues sort first. Select a row to see the exact metrics and the next admin destination."
          className="xl:col-span-8"
          actions={
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">
                {criticalCount} critical
              </span>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                {warningCount} warning
              </span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {infoCount} info
              </span>
            </div>
          }
        >
          {filteredItems.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
              No action items match this issue type for the selected scope.
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredItems.map((item) => {
                const active = selectedAction?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectActionId(item.id)}
                    className={`rounded-[24px] border p-4 text-left transition ${
                      active
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${severityClassName[item.severity]}`}
                          >
                            {item.severity}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                            {issueTypeLabel[item.type]}
                          </span>
                        </div>
                        <div className="mt-3 text-base font-semibold text-white">
                          {item.title}
                        </div>
                        <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                          {item.summary}
                        </div>
                      </div>
                      <div className="grid min-w-[14rem] grid-cols-2 gap-3">
                        <AdminCompactMetric
                          label={item.primaryMetricLabel}
                          value={formatActionMetric(
                            item.primaryMetricValue,
                            item.primaryMetricKind,
                            currency,
                          )}
                        />
                        <AdminCompactMetric
                          label={item.secondaryMetricLabel ?? "Priority"}
                          value={
                            item.secondaryMetricKind
                              ? formatActionMetric(
                                  item.secondaryMetricValue,
                                  item.secondaryMetricKind,
                                  currency,
                                )
                              : formatCount(item.priority)
                          }
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </AdminPanel>

        <div className="space-y-4 xl:col-span-4">
          <AdminDetailPanel
            eyebrow={selectedAction ? issueTypeLabel[selectedAction.type] : "Action detail"}
            title={selectedAction?.title ?? "No action selected"}
            description={
              selectedAction?.summary ??
              "Choose an issue from the action list to inspect the server-computed metrics."
            }
            metrics={
              selectedAction?.detailMetrics.map((metric) => ({
                label: metric.label,
                value: formatActionMetric(metric.value, metric.kind, currency),
              })) ?? []
            }
            links={selectedAction?.links ?? []}
          />

          <AdminDetailPanel
            eyebrow="Trust state"
            title={`${formatWindowDate(currentStart)}-${formatWindowDate(currentEnd)}`}
            description="Money, tax, and order state are server-computed. Event-backed acquisition labels are shown when analytics storage is available."
            metrics={[
              {
                label: "Money source",
                value: overviewTrust?.moneyAuthority ?? "server",
              },
              {
                label: "Revenue source",
                value: overviewTrust?.revenueSource ?? "orders_and_finance",
              },
              {
                label: "Events",
                value: secondaryTrust?.eventStorage ?? "event_backed",
              },
              {
                label: "Refreshed",
                value: formatUpdatedAt(overviewTrust?.refreshedAt ?? ""),
              },
            ]}
            links={[
              { label: "Open reports", href: "/admin/reports", tone: "accent" },
              { label: "Open finance", href: "/admin/finance" },
            ]}
          />

          {marginTrend ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminCompactMetric
                label="Current margin"
                value={formatPrice(
                  marginTrend.currentContributionMarginCents,
                  marginTrend.currency,
                )}
              />
              <AdminCompactMetric
                label="Margin delta"
                value={formatDelta(marginTrend.contributionMarginDeltaRatio)}
              />
              <AdminCompactMetric
                label="Current margin rate"
                value={percent(marginTrend.currentContributionMarginRatio)}
              />
              <AdminCompactMetric
                label="Rate delta"
                value={formatDelta(marginTrend.marginRatioDelta)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MetricTile({
  metric,
  currency,
}: {
  metric: ExecutiveMetric;
  currency: string;
}) {
  const metricValue = metric.value as number | string;
  let displayValue: string;
  switch (metric.kind) {
    case "currency":
      displayValue =
        typeof metricValue === "number"
          ? formatPrice(metricValue, currency)
          : String(metricValue);
      break;
    case "percent":
      displayValue =
        typeof metricValue === "number" ? percent(metricValue) : String(metricValue);
      break;
    case "status":
      displayValue = formatVatStatus(String(metricValue));
      break;
    case "count":
    default:
      displayValue =
        typeof metricValue === "number" ? formatCount(metricValue) : String(metricValue);
      break;
  }

  const badgeLabel =
    metric.kind === "status" && typeof metric.contextValue === "number"
      ? formatPrice(metric.contextValue, currency)
      : formatDelta(metric.deltaRatio);

  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_40%)] opacity-70" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[14ch] text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {metric.label}
          </p>
          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneBadgeClassName[metric.tone]}`}
          >
            {badgeLabel}
          </span>
        </div>
        <div className="mt-4 text-xl font-semibold text-white sm:text-2xl">{displayValue}</div>
        <div className="mt-2 text-xs leading-5 text-slate-400">{metric.footnote}</div>
      </div>
    </div>
  );
}

function TrendComposer({
  trend,
  currency,
  summary,
}: {
  trend: RevenueConversionData["trend"];
  currency: string;
  summary: RevenueConversionData["periodComparison"];
}) {
  const [activeIndex, setActiveIndex] = useState(Math.max(trend.length - 1, 0));

  useEffect(() => {
    setActiveIndex(Math.max(trend.length - 1, 0));
  }, [trend.length]);

  if (trend.length === 0) {
    return (
      <div className="flex min-h-[22rem] items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] text-sm text-slate-500">
        No revenue trend is available for this scope.
      </div>
    );
  }

  const width = 760;
  const height = 280;
  const paddingLeft = 24;
  const paddingRight = 24;
  const paddingTop = 18;
  const paddingBottom = 34;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const step = trend.length === 1 ? 0 : chartWidth / (trend.length - 1);
  const revenueMax = Math.max(...trend.map((point) => point.revenueCents), 1);
  const ordersMax = Math.max(...trend.map((point) => point.paidOrders), 1);

  const points = trend.map((point, index) => {
    const x = paddingLeft + step * index;
    const y =
      paddingTop +
      chartHeight -
      (Math.max(point.revenueCents, 0) / revenueMax) * chartHeight;
    const barHeight = (Math.max(point.paidOrders, 0) / ordersMax) * (chartHeight * 0.32);

    return {
      ...point,
      x,
      y,
      barHeight,
      barTop: paddingTop + chartHeight - barHeight,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? width - paddingRight} ${
    paddingTop + chartHeight
  } L ${points[0]?.x ?? paddingLeft} ${paddingTop + chartHeight} Z`;
  const activePoint = points[Math.min(Math.max(activeIndex, 0), points.length - 1)];

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,12,18,0.98),rgba(5,9,14,0.96))]">
      <div className="grid gap-4 border-b border-white/10 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Recognized revenue pulse
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Revenue</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {formatPrice(summary.revenue.current, currency)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Paid orders</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {formatCount(summary.paidOrders.current)}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {activePoint.label}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
            <span>{formatPrice(activePoint.revenueCents, currency)}</span>
            <span>{formatCount(activePoint.paidOrders)} paid</span>
            <span>{percent(activePoint.sessionConversionRate)} CVR</span>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[18rem] w-full">
          <defs>
            <linearGradient id="analytics-revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(34,211,238,0.34)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3].map((line) => {
            const y = paddingTop + (chartHeight / 3) * line;
            return (
              <line
                key={line}
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.14)"
                strokeDasharray="4 6"
              />
            );
          })}

          {points.map((point, index) => (
            <rect
              key={`${point.label}-bar`}
              x={point.x - 10}
              y={point.barTop}
              width="20"
              height={point.barHeight}
              rx="10"
              fill={index === activeIndex ? "rgba(129,140,248,0.72)" : "rgba(129,140,248,0.28)"}
              style={{ transition: "all 220ms ease" }}
            />
          ))}

          <path d={areaPath} fill="url(#analytics-revenue-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />

          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={paddingTop}
            y2={paddingTop + chartHeight}
            stroke="rgba(148,163,184,0.26)"
            strokeDasharray="4 5"
          />

          {points.map((point, index) => (
            <g key={point.label}>
              <circle
                cx={point.x}
                cy={point.y}
                r={index === activeIndex ? "6" : "4"}
                fill={index === activeIndex ? "#22d3ee" : "#0f172a"}
                stroke="#22d3ee"
                strokeWidth="2"
              />
              <rect
                x={point.x - 20}
                y={paddingTop}
                width="40"
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
              />
            </g>
          ))}
        </svg>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>Revenue line</span>
          <span>Paid order bars</span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:grid-cols-8">
          {points.slice(-8).map((point) => (
            <span key={point.label} className="truncate">
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FunnelRail({
  data,
  selectedLabel,
  onSelect,
}: {
  data: RevenueConversionData["funnel"];
  selectedLabel: string;
  onSelect: (value: string) => void;
}) {
  const stages = [
    {
      label: "Sessions",
      value: data.sessions,
      helper: "Entry volume",
      ratio: data.sessionToOrderRate,
      color: "#22d3ee",
    },
    {
      label: "Product views",
      value: data.productViews,
      helper: percent(data.sessions > 0 ? data.productViews / data.sessions : 0),
      ratio: data.sessions > 0 ? data.productViews / data.sessions : 0,
      color: "#60a5fa",
    },
    {
      label: "Add to cart",
      value: data.addToCart,
      helper: percent(data.viewToCartRate),
      ratio: data.viewToCartRate,
      color: "#f59e0b",
    },
    {
      label: "Begin checkout",
      value: data.beginCheckout,
      helper: percent(data.cartToCheckoutRate),
      ratio: data.cartToCheckoutRate,
      color: "#c084fc",
    },
    {
      label: "Paid orders",
      value: data.paidOrders,
      helper: percent(data.checkoutToPaidRate),
      ratio: data.checkoutToPaidRate,
      color: "#34d399",
    },
  ];

  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {stages.map((stage) => {
        const active = stage.label === selectedLabel;
        return (
          <button
            key={stage.label}
            type="button"
            onClick={() => onSelect(stage.label)}
            className={`rounded-[24px] border p-4 text-left transition duration-200 ${
              active
                ? "border-cyan-300/28 bg-cyan-300/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {stage.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {formatCount(stage.value)}
                </div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                {stage.helper}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max(8, Math.round((stage.value / maxValue) * 100))}%`,
                  backgroundColor: stage.color,
                }}
              />
            </div>
            <div className="mt-3 text-xs text-slate-400">
              {stage.label === "Sessions"
                ? `${percent(stage.ratio)} session to paid conversion`
                : `${percent(stage.ratio)} from prior step`}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MobileOperationCards({
  rows,
  selectedId,
  onSelect,
}: {
  rows: OperationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => {
        const active = row.id === selectedId;
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className={`block w-full rounded-2xl border p-3 text-left transition ${
              active
                ? "border-cyan-400/25 bg-cyan-400/8"
                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">{row.title}</div>
                <div className="mt-1 text-xs text-slate-500">{row.subtitle}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-white">{row.primaryValue}</div>
                {row.secondaryValue ? (
                  <div className="text-xs text-slate-400">{row.secondaryValue}</div>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RevenueWorkspace({
  data,
  days,
  storefrontScope,
  selectedStage,
  onSelectStage,
}: {
  data: RevenueConversionData;
  days: AdminTimeRangeDays;
  storefrontScope: AdminStorefrontScope;
  selectedStage: string;
  onSelectStage: (value: string) => void;
}) {
  const currency = data.periodComparison.currency || data.finance.currency;
  const query =
    storefrontScope === "ALL" ? `days=${days}` : `days=${days}&storefront=${storefrontScope}`;

  const stageDetail: DetailPanelModel = (() => {
    switch (selectedStage) {
      case "Product views":
        return {
          eyebrow: "Selected funnel step",
          title: "Product views",
          description:
            "Traffic is reaching product detail pages. The next question is whether that traffic is converting into cart intent.",
          metrics: [
            { label: "Product views", value: formatCount(data.funnel.productViews) },
            { label: "View to cart", value: percent(data.funnel.viewToCartRate) },
            { label: "Sessions", value: formatCount(data.funnel.sessions) },
            { label: "Paid orders", value: formatCount(data.funnel.paidOrders) },
          ],
          links: [
            { label: "Open reports", href: `/admin/reports?${query}`, tone: "accent" },
            { label: "Open catalog", href: "/admin/catalog" },
          ],
        };
      case "Add to cart":
        return {
          eyebrow: "Selected funnel step",
          title: "Add to cart",
          description:
            "Cart intent is visible, but it only matters if checkout starts stay close and abandonment stays under control.",
          metrics: [
            { label: "Add to cart", value: formatCount(data.funnel.addToCart) },
            { label: "Cart to checkout", value: percent(data.funnel.cartToCheckoutRate) },
            { label: "Cart abandonment", value: percent(data.funnel.cartAbandonmentRate) },
            { label: "Paid orders", value: formatCount(data.funnel.paidOrders) },
          ],
          links: [
            { label: "Open orders", href: "/admin/orders", tone: "accent" },
            { label: "Open reports", href: `/admin/reports?${query}` },
          ],
        };
      case "Begin checkout":
        return {
          eyebrow: "Selected funnel step",
          title: "Begin checkout",
          description:
            "Checkout friction is the fastest operational read. This is where demand and purchase completion should stay close together.",
          metrics: [
            { label: "Checkout starts", value: formatCount(data.funnel.beginCheckout) },
            { label: "Checkout to paid", value: percent(data.funnel.checkoutToPaidRate) },
            { label: "Checkout abandonment", value: percent(data.funnel.checkoutAbandonmentRate) },
            { label: "Refund rate", value: percent(data.periodComparison.refundRate.current) },
          ],
          links: [
            { label: "Open finance", href: `/admin/finance?${query}`, tone: "accent" },
            { label: "Open reports", href: `/admin/reports?${query}` },
          ],
        };
      case "Paid orders":
        return {
          eyebrow: "Selected funnel step",
          title: "Paid orders",
          description:
            "This is the conversion anchor for the entire page. Compare it against revenue, AOV, and refund pressure before interpreting traffic changes.",
          metrics: [
            { label: "Paid orders", value: formatCount(data.periodComparison.paidOrders.current) },
            { label: "Revenue", value: formatPrice(data.periodComparison.revenue.current, currency) },
            { label: "AOV", value: formatPrice(data.periodComparison.aov.current, currency) },
            { label: "Refund rate", value: percent(data.periodComparison.refundRate.current) },
          ],
          links: [
            { label: "Open finance", href: `/admin/finance?${query}`, tone: "accent" },
            { label: "Open VAT", href: "/admin/vat" },
          ],
        };
      default:
        return {
          eyebrow: "Selected funnel step",
          title: "Sessions",
          description:
            "Demand volume frames the rest of the workspace. Read sessions together with paid orders and revenue before assuming a conversion issue.",
          metrics: [
            { label: "Sessions", value: formatCount(data.funnel.sessions) },
            { label: "Session CVR", value: percent(data.funnel.sessionToOrderRate) },
            { label: "Checkout starts", value: formatCount(data.funnel.beginCheckout) },
            { label: "Paid orders", value: formatCount(data.funnel.paidOrders) },
          ],
          links: [
            { label: "Open reports", href: `/admin/reports?${query}`, tone: "accent" },
            { label: "Open analytics", href: `/admin/analytics?${query}` },
          ],
        };
    }
  })();

  const comparisonRows = [
    {
      label: "Revenue",
      value: formatPrice(data.periodComparison.revenue.current, currency),
      delta: formatDelta(data.periodComparison.revenue.deltaRatio),
    },
    {
      label: "Paid orders",
      value: formatCount(data.periodComparison.paidOrders.current),
      delta: formatDelta(data.periodComparison.paidOrders.deltaRatio),
    },
    {
      label: "AOV",
      value: formatPrice(data.periodComparison.aov.current, currency),
      delta: formatDelta(data.periodComparison.aov.deltaRatio),
    },
    {
      label: "Refund rate",
      value: percent(data.periodComparison.refundRate.current),
      delta: formatDelta(data.periodComparison.refundRate.deltaRatio),
    },
  ];

  return (
    <section className="space-y-4">
      <WorkspaceHeader
        eyebrow="Revenue & conversion"
        title="Recognized revenue, paid-order pace, and checkout loss"
        description="One serious trend surface, one compact funnel rail, and a finance-backed decision rail instead of repeated mini-panels."
      />

      {data.expenseMigrationRequired ? (
        <AdminNotice tone="warning">
          Expense-backed VAT and margin support are partially unavailable until expense
          migration coverage is complete for this environment.
        </AdminNotice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <AdminPanel
          title="Revenue pulse"
          description="Start with the recognized revenue line, then compare paid-order density and the current funnel loss profile."
          className="xl:col-span-8"
        >
          <div className="space-y-5">
            <TrendComposer
              trend={data.trend}
              currency={currency}
              summary={data.periodComparison}
            />

            <div className="grid gap-3 lg:grid-cols-4">
              {comparisonRows.map((row) => (
                <AdminDeltaRow key={row.label} label={row.label} value={row.value} delta={row.delta} />
              ))}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Funnel rail
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    Each stage stays readable without turning the page into five large cards.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    Session CVR {percent(data.funnel.sessionToOrderRate)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    Checkout abandonment {percent(data.funnel.checkoutAbandonmentRate)}
                  </span>
                </div>
              </div>
              <FunnelRail data={data.funnel} selectedLabel={selectedStage} onSelect={onSelectStage} />
            </div>
          </div>
        </AdminPanel>

        <div className="space-y-4 xl:col-span-4">
          <AdminDetailPanel
            eyebrow={stageDetail.eyebrow}
            title={stageDetail.title}
            description={stageDetail.description}
            metrics={stageDetail.metrics}
            links={stageDetail.links}
          />
          <AdminDetailPanel
            eyebrow="Finance truth"
            title={`${windowCopy[days].adjective} accounting read`}
            description="Server-side finance and VAT remain the authority for recognized revenue, contribution, and tax readiness."
            metrics={[
              { label: "Net revenue", value: formatPrice(data.finance.netRevenueCents, currency) },
              {
                label: "Contribution",
                value: formatPrice(data.finance.contributionMarginCents, currency),
              },
              { label: "VAT state", value: formatVatStatus(data.vat.status) },
              { label: "Tax coverage", value: percent(data.vat.taxCoverageRate) },
            ]}
            links={[
              { label: "Open finance", href: `/admin/finance?${query}`, tone: "accent" },
              { label: "Open VAT", href: "/admin/vat" },
              { label: "Open reports", href: `/admin/reports?${query}` },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminCompactMetric label="Orders today" value={formatCount(data.orderVelocity.today)} />
            <AdminCompactMetric
              label="Last 7 days"
              value={formatCount(data.orderVelocity.last7Days)}
            />
            <AdminCompactMetric
              label="Last 30 days"
              value={formatCount(data.orderVelocity.last30Days)}
            />
            <AdminCompactMetric
              label="VAT liability"
              value={formatPrice(data.vat.estimatedLiabilityCents, currency)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function AcquisitionWorkspace({
  live,
  trafficSources,
  days,
  storefrontScope,
  selectedSourceLabel,
  onSelectSourceLabel,
}: {
  live: LiveSnapshot;
  trafficSources: TrafficSource[];
  days: AdminTimeRangeDays;
  storefrontScope: AdminStorefrontScope;
  selectedSourceLabel: string | null;
  onSelectSourceLabel: (value: string | null) => void;
}) {
  const query =
    storefrontScope === "ALL" ? `days=${days}` : `days=${days}&storefront=${storefrontScope}`;
  const selectedSource =
    trafficSources.find((item) => item.label === selectedSourceLabel) ?? trafficSources[0] ?? null;

  const sourceBars = useMemo(
    () =>
      trafficSources.map((source) => ({
        label: source.label,
        value: source.sessions,
        secondaryValue: source.beginCheckout,
      })),
    [trafficSources],
  );

  const sourceMix = useMemo(
    () =>
      trafficSources.map((source, index) => ({
        label: source.label,
        value: source.sessions,
        colorClassName: chartPalette[index % chartPalette.length],
      })),
    [trafficSources],
  );

  const livePageRows = useMemo(
    () =>
      live.topPages.map((page) => ({
        id: page.path,
        path: page.path,
        pageType: page.pageType,
        count: page.count,
        shareOfVisitors: page.shareOfVisitors ?? 0,
      })),
    [live.topPages],
  );

  const livePageColumns = useMemo<
    AdminRankingTableColumn<(typeof livePageRows)[number]>[]
  >(
    () => [
      {
        key: "page",
        label: "Page",
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-100">{row.path}</div>
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{row.pageType}</div>
          </div>
        ),
      },
      {
        key: "count",
        label: "Live",
        align: "right",
        render: (row) => formatCount(row.count),
        sortValue: (row) => row.count,
      },
      {
        key: "share",
        label: "Share",
        align: "right",
        render: (row) => percent(row.shareOfVisitors),
        sortValue: (row) => row.shareOfVisitors,
      },
    ],
    [],
  );

  const leadPage = livePageRows[0] ?? null;

  return (
    <section className="space-y-4">
      <WorkspaceHeader
        eyebrow="Acquisition"
        title="Source quality with live page concentration"
        description="Demand scale, checkout intent, and current live attention stay in one workspace so acquisition can be read in one pass."
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <AdminPanel
          title="Sources and live demand"
          description="The ranked source board handles acquisition quality, while live pages stay compact and secondary instead of competing for equal weight."
          className="xl:col-span-8"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
            <div className="space-y-4">
              <HorizontalBarsChart
                data={sourceBars}
                valueFormatter={(value) => `${formatCount(value)} sessions`}
                secondaryValueFormatter={(value) => `${formatCount(value)} checkout starts`}
                colorClassName="bg-cyan-400"
                selectedLabel={selectedSource?.label}
                onSelect={onSelectSourceLabel}
              />
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Live pages
                </div>
                <div className="md:hidden">
                  <MobileOperationCards
                    rows={livePageRows.map((row) => ({
                      id: row.id,
                      title: row.path,
                      subtitle: row.pageType,
                      primaryLabel: "Live visitors",
                      primaryValue: formatCount(row.count),
                      primarySort: row.count,
                      secondaryLabel: "Share",
                      secondaryValue: percent(row.shareOfVisitors),
                      secondarySort: row.shareOfVisitors,
                      chartValue: row.count,
                      detail: {
                        eyebrow: "Live page",
                        title: row.path,
                        description: "Current live page concentration in the rolling active-session window.",
                        metrics: [],
                        links: [],
                      },
                    }))}
                    selectedId={leadPage?.id ?? null}
                    onSelect={() => undefined}
                  />
                </div>
                <div className="hidden md:block">
                  <AdminRankingTable
                    rows={livePageRows}
                    columns={livePageColumns}
                    emptyCopy="No active storefront sessions are currently visible."
                    initialSortKey="count"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <DonutChart
                data={sourceMix}
                totalLabel="Sessions"
                totalValue={formatCount(
                  trafficSources.reduce((sum, source) => sum + source.sessions, 0),
                )}
                valueFormatter={formatCount}
                selectedLabel={selectedSource?.label}
                onSelect={onSelectSourceLabel}
              />
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <AdminCompactMetric
                  label="Live visitors"
                  value={formatCount(live.activeVisitorCount)}
                />
                <AdminCompactMetric
                  label="Source sessions"
                  value={selectedSource ? formatCount(selectedSource.sessions) : "0"}
                />
                <AdminCompactMetric
                  label="Checkout rate"
                  value={selectedSource ? percent(selectedSource.checkoutRate ?? 0) : percent(0)}
                />
              </div>
            </div>
          </div>
        </AdminPanel>

        <div className="space-y-4 xl:col-span-4">
          <AdminDetailPanel
            eyebrow="Selected source"
            title={selectedSource?.label ?? "No source selected"}
            description={
              selectedSource
                ? "Use this rail to separate pure session scale from downstream buying intent without leaving the acquisition workspace."
                : "No scoped source data is available for this window."
            }
            metrics={
              selectedSource
                ? [
                    { label: "Sessions", value: formatCount(selectedSource.sessions) },
                    {
                      label: "Checkout starts",
                      value: formatCount(selectedSource.beginCheckout),
                    },
                    {
                      label: "Checkout rate",
                      value: percent(selectedSource.checkoutRate ?? 0),
                    },
                    { label: "Live visitors", value: formatCount(live.activeVisitorCount) },
                  ]
                : []
            }
            links={[
              { label: "Open reports", href: `/admin/reports?${query}`, tone: "accent" },
              { label: "Open orders", href: "/admin/orders" },
            ]}
          />
          <AdminDetailPanel
            eyebrow="Live pulse"
            title={leadPage?.path ?? "No live page"}
            description={
              leadPage
                ? "This is the current highest-concentration live page in the rolling active-session snapshot."
                : "No active page concentration is available right now."
            }
            metrics={
              leadPage
                ? [
                    { label: "Page type", value: leadPage.pageType },
                    { label: "Live visitors", value: formatCount(leadPage.count) },
                    { label: "Visitor share", value: percent(leadPage.shareOfVisitors) },
                    { label: "Live total", value: formatCount(live.activeVisitorCount) },
                  ]
                : []
            }
            links={[
              { label: "Open reports", href: `/admin/reports?${query}`, tone: "accent" },
              { label: "Open catalog", href: "/admin/catalog" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function OperationsWorkspace({
  data,
  currency,
  days,
  storefrontScope,
  activeTab,
  onChangeTab,
  productBoard,
  onChangeProductBoard,
  productQuery,
  onChangeProductQuery,
  selectedRowId,
  onSelectRowId,
}: {
  data: OperationsData;
  currency: string;
  days: AdminTimeRangeDays;
  storefrontScope: AdminStorefrontScope;
  activeTab: OperationsTabId;
  onChangeTab: (tab: OperationsTabId) => void;
  productBoard: ProductBoard;
  onChangeProductBoard: (value: ProductBoard) => void;
  productQuery: string;
  onChangeProductQuery: (value: string) => void;
  selectedRowId: string | null;
  onSelectRowId: (value: string | null) => void;
}) {
  const deferredProductQuery = useDeferredValue(productQuery);
  const query =
    storefrontScope === "ALL" ? `days=${days}` : `days=${days}&storefront=${storefrontScope}`;

  const rows = useMemo<OperationRow[]>(() => {
    switch (activeTab) {
      case "inventory":
        return data.inventory.stockouts.map((item) => ({
          id: item.variantId,
          title: item.productTitle,
          subtitle: `${item.variantTitle}${item.sku ? ` • ${item.sku}` : ""}`,
          primaryLabel: "Available",
          primaryValue: formatCount(item.available),
          primarySort: item.available,
          secondaryLabel: "Reserved",
          secondaryValue: formatCount(item.reserved),
          secondarySort: item.reserved,
          chartValue: Math.max(item.quantityOnHand, 0),
          chartSecondaryValue: item.reserved,
          detail: {
            eyebrow: "Inventory",
            title: item.productTitle,
            description:
              "These rows need direct stock intervention because available quantity is already at or below zero.",
            metrics: [
              { label: "Variant", value: item.variantTitle },
              { label: "On hand", value: formatCount(item.quantityOnHand) },
              { label: "Reserved", value: formatCount(item.reserved) },
              { label: "Available", value: formatCount(item.available) },
            ],
            links: [
              { label: "Open inventory", href: "/admin/inventory-adjustments", tone: "accent" },
              { label: "Open catalog", href: "/admin/catalog" },
            ],
          },
        }));
      case "payments":
        return data.commerceMix.payments.map((item) => ({
          id: item.method,
          title: item.method,
          subtitle: "recognized payment mix",
          primaryLabel: "Revenue",
          primaryValue: formatPrice(item.revenueCents, currency),
          primarySort: item.revenueCents,
          secondaryLabel: "Refunded",
          secondaryValue: formatPrice(item.refundedCents, currency),
          secondarySort: item.refundedCents,
          chartValue: item.revenueCents,
          chartSecondaryValue: item.orders,
          detail: {
            eyebrow: "Payments",
            title: item.method,
            description:
              "Keep payment behavior tied to recognized revenue quality and refund pressure, not in its own oversized board.",
            metrics: [
              { label: "Orders", value: formatCount(item.orders) },
              { label: "Revenue", value: formatPrice(item.revenueCents, currency) },
              { label: "Refunded", value: formatPrice(item.refundedCents, currency) },
              {
                label: "Refund share",
                value: percent(item.revenueCents > 0 ? item.refundedCents / item.revenueCents : 0),
              },
            ],
            links: [
              { label: "Open orders", href: "/admin/orders", tone: "accent" },
              { label: "Open reports", href: `/admin/reports?${query}` },
            ],
          },
        }));
      case "discounts":
        return data.commerceMix.discounts.map((item) => ({
          id: item.code,
          title: item.code,
          subtitle: "promo dependence",
          primaryLabel: "Revenue",
          primaryValue: formatPrice(item.revenueCents, currency),
          primarySort: item.revenueCents,
          secondaryLabel: "Discount",
          secondaryValue: formatPrice(item.discountCents, currency),
          secondarySort: item.discountCents,
          chartValue: item.revenueCents,
          chartSecondaryValue: item.orders,
          detail: {
            eyebrow: "Discounts",
            title: item.code,
            description:
              "Promotion impact matters, but it should stay in service of understanding revenue quality rather than dominating the page.",
            metrics: [
              { label: "Orders", value: formatCount(item.orders) },
              { label: "Revenue", value: formatPrice(item.revenueCents, currency) },
              { label: "Discount", value: formatPrice(item.discountCents, currency) },
              {
                label: "Discount share",
                value: percent(item.revenueCents > 0 ? item.discountCents / item.revenueCents : 0),
              },
            ],
            links: [
              { label: "Open discounts", href: "/admin/discounts", tone: "accent" },
              { label: "Open reports", href: `/admin/reports?${query}` },
            ],
          },
        }));
      case "customers":
        return [
          {
            id: "registered",
            title: "Registered customers",
            subtitle: "identified accounts",
            primaryLabel: "Count",
            primaryValue: formatCount(data.customers.summary.registeredCount),
            primarySort: data.customers.summary.registeredCount,
            secondaryLabel: "Repeat",
            secondaryValue: formatCount(data.customers.summary.repeatRegisteredCount),
            secondarySort: data.customers.summary.repeatRegisteredCount,
            chartValue: data.customers.summary.registeredCount,
            chartSecondaryValue: data.customers.summary.repeatRegisteredCount,
            detail: {
              eyebrow: "Customers",
              title: "Registered customers",
              description:
                "Known customer depth is the cleanest signal that current growth is compounding rather than resetting every period.",
              metrics: [
                {
                  label: "Registered",
                  value: formatCount(data.customers.summary.registeredCount),
                },
                {
                  label: "Repeat",
                  value: formatCount(data.customers.summary.repeatRegisteredCount),
                },
                {
                  label: "High-value",
                  value: formatCount(data.customers.summary.highValueRegisteredCount),
                },
                {
                  label: "Repeat rate",
                  value: percent(data.customers.retention.repeatCustomerRate),
                },
              ],
              links: [
                { label: "Open customers", href: "/admin/customers", tone: "accent" },
                { label: "Open reports", href: `/admin/reports?${query}` },
              ],
            },
          },
          {
            id: "guest",
            title: "Guest customers",
            subtitle: "unregistered buyers",
            primaryLabel: "Count",
            primaryValue: formatCount(data.customers.summary.guestCount),
            primarySort: data.customers.summary.guestCount,
            secondaryLabel: "Repeat",
            secondaryValue: formatCount(data.customers.summary.repeatGuestCount),
            secondarySort: data.customers.summary.repeatGuestCount,
            chartValue: data.customers.summary.guestCount,
            chartSecondaryValue: data.customers.summary.repeatGuestCount,
            detail: {
              eyebrow: "Customers",
              title: "Guest customers",
              description:
                "Guest concentration only matters when you compare it against repeat depth and the returning-revenue share.",
              metrics: [
                { label: "Guests", value: formatCount(data.customers.summary.guestCount) },
                {
                  label: "Repeat guests",
                  value: formatCount(data.customers.summary.repeatGuestCount),
                },
                {
                  label: "New customers",
                  value: formatCount(data.customers.summary.newCustomerCount),
                },
                {
                  label: "Returning customers",
                  value: formatCount(data.customers.summary.returningCustomerCount),
                },
              ],
              links: [
                { label: "Open customers", href: "/admin/customers", tone: "accent" },
                { label: "Open support", href: "/admin/support" },
              ],
            },
          },
          {
            id: "revenueMix",
            title: "Returning revenue",
            subtitle: "repeat customer contribution",
            primaryLabel: "Revenue",
            primaryValue: formatPrice(data.customers.retention.returningRevenueCents, currency),
            primarySort: data.customers.retention.returningRevenueCents,
            secondaryLabel: "New revenue",
            secondaryValue: formatPrice(data.customers.retention.newRevenueCents, currency),
            secondarySort: data.customers.retention.newRevenueCents,
            chartValue: data.customers.retention.returningRevenueCents,
            chartSecondaryValue: data.customers.retention.newRevenueCents,
            detail: {
              eyebrow: "Customers",
              title: "Revenue mix",
              description:
                "Returning revenue changes how aggressively acquisition can spend, so it belongs in the operating surface.",
              metrics: [
                {
                  label: "Returning revenue",
                  value: formatPrice(data.customers.retention.returningRevenueCents, currency),
                },
                {
                  label: "New revenue",
                  value: formatPrice(data.customers.retention.newRevenueCents, currency),
                },
                {
                  label: "Repeat rate",
                  value: percent(data.customers.retention.repeatCustomerRate),
                },
                {
                  label: "High-value users",
                  value: formatCount(data.customers.summary.highValueRegisteredCount),
                },
              ],
              links: [
                { label: "Open customers", href: "/admin/customers", tone: "accent" },
                { label: "Open reports", href: `/admin/reports?${query}` },
              ],
            },
          },
        ];
      case "system":
        return data.system.aiQuality.topIssueLabels.map((item) => ({
          id: item.label,
          title: item.label,
          subtitle: "issue concentration",
          primaryLabel: "Count",
          primaryValue: formatCount(item.count),
          primarySort: item.count,
          chartValue: item.count,
          detail: {
            eyebrow: "System",
            title: item.label,
            description:
              "System trust stays visible as an operations concern rather than competing with revenue and acquisition for first attention.",
            metrics: [
              { label: "Issue count", value: formatCount(item.count) },
              { label: "Fallback rate", value: percent(data.system.aiQuality.fallbackRate) },
              {
                label: "Low confidence",
                value: percent(data.system.aiQuality.lowConfidenceRate),
              },
              {
                label: "Correct feedback",
                value: percent(data.system.aiQuality.feedbackCorrectRate),
              },
            ],
            links: [
              { label: "Open analyzer", href: "/admin/analyzer", tone: "accent" },
              { label: "Open scripts", href: "/admin/scripts" },
            ],
          },
        }));
      case "products":
      default: {
        const source =
          productBoard === "leaders" ? data.merchandising.leaders : data.merchandising.leaks;
        const queryText = deferredProductQuery.trim().toLowerCase();
        return source
          .filter((item) =>
            queryText ? item.productTitle.toLowerCase().includes(queryText) : true,
          )
          .map((item) => ({
            id: item.productId,
            title: item.productTitle,
            subtitle: item.priorityReason ?? "Product performance",
            primaryLabel: "Revenue",
            primaryValue: formatPrice(item.revenueCents, currency),
            primarySort: item.revenueCents,
            secondaryLabel: "CVR",
            secondaryValue: percent(item.conversionRate),
            secondarySort: item.conversionRate,
            chartValue: item.revenueCents,
            chartSecondaryValue: item.views,
            detail: {
              eyebrow: "Products",
              title: item.productTitle,
              description:
                productBoard === "leaders"
                  ? "This row earns its place because it is carrying recognized revenue inside the current scope."
                  : "This row needs attention because it is attracting visibility without enough downstream conversion.",
              metrics: [
                { label: "Views", value: formatCount(item.views) },
                { label: "Add to cart", value: formatCount(item.addToCart) },
                { label: "Purchases", value: formatCount(item.purchases) },
                { label: "Revenue", value: formatPrice(item.revenueCents, currency) },
              ],
              links: [
                { label: "Open catalog", href: "/admin/catalog", tone: "accent" },
                { label: "Open orders", href: "/admin/orders" },
              ],
            },
          }));
      }
    }
  }, [activeTab, currency, data, deferredProductQuery, productBoard, query]);

  const selectedRow = resolveSelectedRow(rows, selectedRowId);
  const columns = useMemo<AdminRankingTableColumn<OperationRow>[]>(
    () => [
      {
        key: "item",
        label: "Item",
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-100">{row.title}</div>
            <div className="text-xs text-slate-500">{row.subtitle}</div>
          </div>
        ),
      },
      {
        key: "primary",
        label: "Primary",
        align: "right",
        render: (row) => (
          <div>
            <div className="font-medium text-slate-100">{row.primaryValue}</div>
            <div className="text-xs text-slate-500">{row.primaryLabel}</div>
          </div>
        ),
        sortValue: (row) => row.primarySort,
      },
      {
        key: "secondary",
        label: "Secondary",
        align: "right",
        render: (row) =>
          row.secondaryValue ? (
            <div>
              <div className="font-medium text-slate-100">{row.secondaryValue}</div>
              <div className="text-xs text-slate-500">{row.secondaryLabel}</div>
            </div>
          ) : (
            <span className="text-slate-500">-</span>
          ),
        sortValue: (row) => row.secondarySort ?? 0,
      },
    ],
    [],
  );

  const showDonut = activeTab === "payments" || activeTab === "discounts" || activeTab === "customers";
  const donutData = rows.slice(0, 6).map((row, index) => ({
    label: row.title,
    value: Math.max(row.chartValue, 0),
    colorClassName: chartPalette[index % chartPalette.length],
  }));
  const chartRows = rows.slice(0, 6).map((row) => ({
    label: row.title,
    value: row.chartValue,
    secondaryValue: row.chartSecondaryValue,
  }));

  return (
    <section className="space-y-4">
      <WorkspaceHeader
        eyebrow="Operations"
        title="Compact operating board"
        description="Products, inventory, payments, discounts, customers, and system trust stay in one denser tabbed workspace."
        actions={<OperationsTabs activeTab={activeTab} onChange={onChangeTab} />}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <AdminPanel
          title="Operational board"
          description="The selected tab keeps one dense ranking surface and one small chart so you can act without scanning another wall of cards."
          className="xl:col-span-8"
          actions={
            activeTab === "products" ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <SegmentButtons
                  value={productBoard}
                  options={[
                    { value: "leaders", label: "Revenue leaders" },
                    { value: "leaks", label: "Conversion leaks" },
                  ]}
                  onChange={onChangeProductBoard}
                />
                <div className="w-full sm:w-64">
                  <AdminInput
                    value={productQuery}
                    onChange={(event) => onChangeProductQuery(event.target.value)}
                    placeholder="Search product"
                  />
                </div>
              </div>
            ) : null
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
            <div>
              <MobileOperationCards
                rows={rows}
                selectedId={selectedRow?.id ?? null}
                onSelect={onSelectRowId}
              />
              <div className="hidden md:block">
                <AdminRankingTable
                  rows={rows}
                  columns={columns}
                  emptyCopy="No rows are available for this tab and scope."
                  selectedRowId={selectedRow?.id ?? null}
                  onSelectRow={(row) => onSelectRowId(row.id)}
                  initialSortKey="primary"
                />
              </div>
            </div>

            <div className="space-y-4">
              {showDonut ? (
                <DonutChart
                  data={donutData}
                  totalLabel={
                    activeTab === "customers"
                      ? "Profiles"
                      : activeTab === "discounts"
                        ? "Discounted revenue"
                        : "Recognized revenue"
                  }
                  totalValue={
                    activeTab === "customers"
                      ? formatCount(rows.reduce((sum, row) => sum + Math.max(row.chartValue, 0), 0))
                      : formatPrice(
                          rows.reduce((sum, row) => sum + Math.max(row.chartValue, 0), 0),
                          currency,
                        )
                  }
                  valueFormatter={
                    activeTab === "customers"
                      ? formatCount
                      : (value) => formatPrice(value, currency)
                  }
                  selectedLabel={selectedRow?.title}
                  onSelect={(label) => {
                    const next = rows.find((row) => row.title === label);
                    onSelectRowId(next?.id ?? null);
                  }}
                />
              ) : (
                <HorizontalBarsChart
                  data={chartRows}
                  valueFormatter={(value) =>
                    activeTab === "inventory" || activeTab === "system"
                      ? formatCount(value)
                      : formatPrice(value, currency)
                  }
                  secondaryValueFormatter={(value) => formatCount(value)}
                  colorClassName={
                    activeTab === "inventory"
                      ? "bg-amber-400"
                      : activeTab === "products" && productBoard === "leaks"
                        ? "bg-amber-400"
                        : "bg-cyan-400"
                  }
                  selectedLabel={selectedRow?.title}
                  onSelect={(label) => {
                    const next = rows.find((row) => row.title === label);
                    onSelectRowId(next?.id ?? null);
                  }}
                />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminCompactMetric
                  label="Tracked variants"
                  value={formatCount(data.inventory.summary.trackedVariants)}
                />
                <AdminCompactMetric
                  label="Low stock"
                  value={formatCount(data.inventory.summary.lowStockCount)}
                />
                <AdminCompactMetric
                  label="Repeat rate"
                  value={percent(data.customers.retention.repeatCustomerRate)}
                />
                <AdminCompactMetric
                  label="Fallback rate"
                  value={percent(data.system.aiQuality.fallbackRate)}
                />
              </div>
            </div>
          </div>
        </AdminPanel>

        <div className="space-y-4 xl:col-span-4">
          <AdminDetailPanel
            eyebrow={selectedRow?.detail.eyebrow ?? "Operations"}
            title={selectedRow?.detail.title ?? "No row selected"}
            description={
              selectedRow?.detail.description ??
              "Select a row from the current tab to inspect its metrics and next actions."
            }
            metrics={selectedRow?.detail.metrics ?? []}
            links={selectedRow?.detail.links ?? []}
          />
          <AdminDetailPanel
            eyebrow="Workspace summary"
            title="Cross-tab guardrails"
            description="These counters keep operational drift visible while you stay focused on one tab."
            metrics={[
              {
                label: "Stockouts",
                value: formatCount(data.inventory.summary.stockoutCount),
              },
              {
                label: "High-value users",
                value: formatCount(data.customers.summary.highValueRegisteredCount),
              },
              {
                label: "Feedback records",
                value: formatCount(data.system.aiQuality.feedbackTotal),
              },
              {
                label: "Correct feedback",
                value: percent(data.system.aiQuality.feedbackCorrectRate),
              },
            ]}
            links={[
              { label: "Open inventory", href: "/admin/inventory-adjustments", tone: "accent" },
              { label: "Open customers", href: "/admin/customers" },
            ]}
          />
        </div>
      </div>
    </section>
  );
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

  const [overview, setOverview] = useState(initialOverview);
  const [secondary, setSecondary] = useState<AdminAnalyticsSecondaryPayload>(emptySecondaryPayload);
  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [secondaryError, setSecondaryError] = useState("");

  const [selectedStage, setSelectedStage] = useState("Sessions");
  const [selectedSourceLabel, setSelectedSourceLabel] = useState<string | null>(null);
  const [activeOperationsTab, setActiveOperationsTab] = useState<OperationsTabId>("products");
  const [productBoard, setProductBoard] = useState<ProductBoard>("leaders");
  const [productQuery, setProductQuery] = useState("");
  const [selectedOperationRowId, setSelectedOperationRowId] = useState<string | null>(null);
  const [selectedIssueType, setSelectedIssueType] = useState<ActionIssueFilter>("all");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  useEffect(() => {
    setOverview(initialOverview);
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
        failureDetail: "The primary decision surface may be stale until the next successful refresh.",
      },
    );
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load analytics overview.");
    }
    setOverview(data);
  }, [location]);

  const loadSecondary = useCallback(async () => {
    const { response, data } = await fetchAdminJson<AdminAnalyticsSecondaryPayload & { error?: string }>(
      buildAdminAnalyticsApiHref(location, "secondary"),
      {
        method: "GET",
        cache: "no-store",
        slowThresholdMs: 5_500,
        slowMessage: "Supporting workspaces are still loading.",
        slowDetail: "Products, acquisition, and operational boards are taking longer than usual to resolve.",
        failureMessage: "Secondary analytics refresh failed.",
        failureDetail: "The acquisition and operations workspaces may be stale until the next successful refresh.",
      },
    );
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load secondary analytics.");
    }
    setSecondary(data);
  }, [location]);

  useEffect(() => {
    setSecondaryLoading(true);
    setSecondaryError("");
    void loadSecondary()
      .catch((loadError) => {
        setSecondaryError(
          loadError instanceof Error ? loadError.message : "Failed to load secondary analytics.",
        );
      })
      .finally(() => {
        setSecondaryLoading(false);
      });
  }, [loadSecondary]);

  const refreshAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    setSecondaryError("");
    setSecondaryLoading(true);
    try {
      await loadOverview();
      await loadSecondary();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh analytics.");
    } finally {
      setSecondaryLoading(false);
      setLoading(false);
    }
  }, [loadOverview, loadSecondary]);

  const executive = overview.executive ?? emptyExecutive;
  const revenueConversion = overview.revenueConversion ?? emptyRevenueConversion;
  const liveSnapshot = overview.acquisition?.live ?? emptyLiveSnapshot;
  const trafficSources = useMemo(
    () => secondary.acquisition?.trafficSources ?? secondary.trafficSources ?? [],
    [secondary],
  );
  const operations = secondary.operations ?? emptyOperations;
  const actionItems = useMemo(
    () =>
      [
        ...(overview.actionCenter?.items ?? []),
        ...(secondary.actionCenter?.items ?? []),
      ].sort((left, right) => {
        if (right.priority !== left.priority) return right.priority - left.priority;
        return left.title.localeCompare(right.title);
      }),
    [overview.actionCenter?.items, secondary.actionCenter?.items],
  );

  const currency = revenueConversion.periodComparison.currency || revenueConversion.finance.currency;
  const selectedStorefrontLabel = ADMIN_STOREFRONT_SCOPE_LABELS[initialStorefrontScope];
  const rangeCopy = windowCopy[initialDays];

  useEffect(() => {
    setSelectedSourceLabel(trafficSources[0]?.label ?? null);
  }, [initialStorefrontScope, trafficSources]);

  useEffect(() => {
    setSelectedOperationRowId(null);
  }, [activeOperationsTab, productBoard, initialStorefrontScope]);

  useEffect(() => {
    setSelectedActionId(null);
    setSelectedIssueType("all");
  }, [initialDays, initialStorefrontScope]);

  return (
    <div className="space-y-5 pb-10">
      <CommandDeck
        metrics={executive.metrics}
        currency={currency}
        storefrontLabel={selectedStorefrontLabel}
        rangeLabel={rangeCopy.label}
        updatedAt={executive.updatedAt}
      />

      <AdminStickyToolbar>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
              {rangeCopy.horizon}
            </span>
            <AdminButton type="button" onClick={() => void refreshAnalytics()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </AdminButton>
          </div>
        </div>
      </AdminStickyToolbar>

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {secondaryError ? <AdminNotice tone="warning">{secondaryError}</AdminNotice> : null}
      {secondaryLoading ? (
        <AdminNotice tone="info">
          Supporting workspaces are still loading. Revenue and conversion truth are already available while acquisition and operations continue to resolve.
        </AdminNotice>
      ) : null}
      {initialStorefrontScope !== "ALL" ? (
        <AdminNotice tone="info">
          This workspace is scoped to {selectedStorefrontLabel}. Orders, analytics events, and finance rollups are filtered to explicit storefront attribution only.
        </AdminNotice>
      ) : null}

      <ActionCenter
        items={actionItems}
        selectedIssueType={selectedIssueType}
        onSelectIssueType={setSelectedIssueType}
        selectedActionId={selectedActionId}
        onSelectActionId={setSelectedActionId}
        currency={currency}
        overviewTrust={overview.trust}
        secondaryTrust={secondary.trust}
        marginTrend={overview.marginTrend}
        currentStart={overview.scope?.currentStart}
        currentEnd={overview.scope?.currentEnd}
      />

      <RevenueWorkspace
        data={revenueConversion}
        days={initialDays}
        storefrontScope={initialStorefrontScope}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
      />

      <AcquisitionWorkspace
        live={liveSnapshot}
        trafficSources={trafficSources}
        days={initialDays}
        storefrontScope={initialStorefrontScope}
        selectedSourceLabel={selectedSourceLabel}
        onSelectSourceLabel={setSelectedSourceLabel}
      />

      <OperationsWorkspace
        data={operations}
        currency={currency}
        days={initialDays}
        storefrontScope={initialStorefrontScope}
        activeTab={activeOperationsTab}
        onChangeTab={setActiveOperationsTab}
        productBoard={productBoard}
        onChangeProductBoard={setProductBoard}
        productQuery={productQuery}
        onChangeProductQuery={setProductQuery}
        selectedRowId={selectedOperationRowId}
        onSelectRowId={setSelectedOperationRowId}
      />
    </div>
  );
}
