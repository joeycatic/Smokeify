import Link from "next/link";
import {
  FunnelChart,
  HorizontalBarsChart,
  MultiSeriesTrendChart,
} from "@/components/admin/AdminCharts";
import {
  AdminCompactMetric,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageIntro,
  AdminPanel,
  AdminTimeRangeTabs,
} from "@/components/admin/AdminWorkspace";
import {
  AdminActionBar,
  AdminKpiStrip,
  AdminPage,
  AdminPrimaryGrid,
} from "@/components/admin/ui";
import { formatAdminMoney, formatAdminPercent } from "@/lib/adminFormatting";
import { getAdminTimeRangeOption } from "@/lib/adminTimeRange";
import type { AdminStorefrontDashboardData } from "@/lib/adminStorefrontDashboard";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

function ProductList({
  rows,
  storefrontLabel,
  storefrontHref,
  emptyCopy,
}: {
  rows: AdminStorefrontDashboardData["insights"]["topProducts"];
  storefrontLabel: string;
  storefrontHref: string;
  emptyCopy: string;
}) {
  if (rows.length === 0) {
    return <AdminEmptyState copy={emptyCopy} />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Link
          key={row.productId}
          href={`/admin/catalog/${row.productId}?storefront=${storefrontHref}`}
          className="block rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--adm-text)]">
                {row.productTitle}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--adm-text-muted)]">
                <span>{row.addToCart} carts</span>
                <span>{row.beginCheckout} checkouts</span>
                <span>{row.paymentStarted} payments</span>
                <span>{row.purchases} purchases</span>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-[var(--adm-text-muted)]">
              <div>{formatAdminPercent(row.cartToPurchaseRate)} cart to purchase</div>
              <div className="mt-1">
                {formatAdminMoney(row.revenueCents)} {storefrontLabel}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function AdminStorefrontDashboard({
  data,
  pathname,
}: {
  data: AdminStorefrontDashboardData;
  pathname: string;
}) {
  const selectedRange = getAdminTimeRangeOption(data.days);
  const currency = data.finance.currentFinance.currency;
  const funnelStages = [
    {
      label: "Cart",
      value: data.insights.funnel.addToCart,
      helper: "Base",
      color: "#1f5f3f",
    },
    {
      label: "Checkout",
      value: data.insights.funnel.beginCheckout,
      helper: formatAdminPercent(data.insights.funnel.cartToCheckoutRate),
      color: "#bd5b2b",
    },
    {
      label: "Shipping",
      value: data.insights.funnel.shippingSubmitted,
      helper: formatAdminPercent(data.insights.funnel.checkoutToShippingRate),
      color: "#e2a136",
    },
    {
      label: "Payment",
      value: data.insights.funnel.paymentStarted,
      helper: formatAdminPercent(data.insights.funnel.shippingToPaymentRate),
      color: "#2f6690",
    },
    {
      label: "Paid",
      value: data.insights.funnel.paidOrders,
      helper: formatAdminPercent(data.insights.funnel.paymentToPaidRate),
      color: "#5f8b72",
    },
  ];

  const trendLabels = data.insights.trend.map((point) => point.label);
  const trendSeries = [
    {
      label: "Cart",
      color: "#1f5f3f",
      values: data.insights.trend.map((point) => point.addToCart),
    },
    {
      label: "Checkout",
      color: "#bd5b2b",
      values: data.insights.trend.map((point) => point.beginCheckout),
    },
    {
      label: "Shipping",
      color: "#e2a136",
      values: data.insights.trend.map((point) => point.shippingSubmitted),
    },
    {
      label: "Payment",
      color: "#2f6690",
      values: data.insights.trend.map((point) => point.paymentStarted),
    },
    {
      label: "Paid",
      color: "#5f8b72",
      values: data.insights.trend.map((point) => point.paidOrders),
    },
  ];

  return (
    <AdminPage layout="dashboard">
      <AdminPageIntro
        eyebrow={`${data.storefrontLabel} / Storefront`}
        title={`${data.storefrontLabel} control dashboard`}
        description={`${data.storefrontLabel}-scoped command surface for revenue, catalog health, landing-page state, funnel activity, and explicit storefront-attributed orders in the ${selectedRange.longLabel} window.`}
        actions={<AdminTimeRangeTabs pathname={pathname} activeDays={data.days} />}
        metrics={
          <AdminKpiStrip>
            <AdminMetricCard
              label="Paid orders"
              value={String(data.orders.paidOrderCount)}
              detail={`${data.orders.totalOrderCount} total`}
              footnote="sourceStorefront scoped"
              tone="emerald"
            />
            <AdminMetricCard
              label="Gross revenue"
              value={formatAdminMoney(
                data.finance.currentFinance.grossRevenueCents,
                "de-DE",
                currency,
              )}
              detail={formatAdminPercent(data.finance.currentFinance.contributionMarginRatio)}
              footnote="recognized paid order rollup"
              tone="slate"
            />
            <AdminMetricCard
              label="Contribution"
              value={formatAdminMoney(
                data.finance.currentFinance.contributionMarginCents,
                "de-DE",
                currency,
              )}
              footnote="net revenue less variable costs"
              tone="violet"
            />
            <AdminMetricCard
              label="Active catalog"
              value={String(data.catalog.activeProductCount)}
              detail={`${data.catalog.exclusiveProductCount} exclusive`}
              footnote={`${data.catalog.totalProductCount} assigned products`}
              tone="amber"
            />
            <AdminMetricCard
              label="Landing slots"
              value={String(data.landingPage.sectionCount)}
              detail={`${data.landingPage.scheduledSectionCount} scheduled`}
              footnote={`${data.landingPage.draftManualSectionCount} manual drafts`}
              tone="slate"
            />
          </AdminKpiStrip>
        }
      />

      <AdminActionBar className="grid grid-cols-2 md:grid-cols-4">
        <Link
          href={data.links.orders}
          className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-primary)] hover:bg-[var(--adm-primary-soft)] hover:text-[var(--adm-primary)]"
        >
          Scoped orders
        </Link>
        <Link
          href={data.links.catalog}
          className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-primary)] hover:bg-[var(--adm-primary-soft)] hover:text-[var(--adm-primary)]"
        >
          Scoped catalog
        </Link>
        <Link
          href={data.links.landingPage}
          className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-primary)] hover:bg-[var(--adm-primary-soft)] hover:text-[var(--adm-primary)]"
        >
          Landing page
        </Link>
        <Link
          href={data.links.finance}
          className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-primary)] hover:bg-[var(--adm-primary-soft)] hover:text-[var(--adm-primary)]"
        >
          Finance rollup
        </Link>
      </AdminActionBar>

      {!data.insights.storefrontAnalyticsAvailable ? (
        <div className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          Analytics storefront columns are unavailable. Funnel and live-session stages remain
          empty, but paid orders still use explicit `sourceStorefront = {data.storefront}`.
        </div>
      ) : null}

      {data.insights.storefrontAnalyticsAvailable && !data.insights.firstTaggedEventAt ? (
        <div className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          No storefront-tagged analytics events exist for {data.storefrontLabel} yet. Order
          counts already use `sourceStorefront = {data.storefront}`.
        </div>
      ) : null}

      {data.insights.warningStartsAt ? (
        <div className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          The {data.storefrontLabel} funnel is only fully storefront-tagged from{" "}
          {formatDate(data.insights.warningStartsAt)} onward. Historical order counts remain
          visible, but earlier funnel stages are incomplete.
        </div>
      ) : null}

      <AdminPrimaryGrid rail="balanced">
        <AdminPanel
          eyebrow="Funnel"
          title="Session funnel and stage loss"
          description={`Storefront-tagged ${data.storefrontLabel} sessions with paid-order fallback for completed purchases.`}
        >
          <FunnelChart stages={funnelStages} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminCompactMetric
              label="Cart dropoff"
              value={formatAdminPercent(data.insights.funnel.cartDropoffRate)}
            />
            <AdminCompactMetric
              label="Checkout dropoff"
              value={formatAdminPercent(data.insights.funnel.checkoutDropoffRate)}
            />
            <AdminCompactMetric
              label="Shipping dropoff"
              value={formatAdminPercent(data.insights.funnel.shippingDropoffRate)}
            />
            <AdminCompactMetric
              label="Payment dropoff"
              value={formatAdminPercent(data.insights.funnel.paymentDropoffRate)}
            />
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Live Ops"
          title={`Active ${data.storefrontLabel} sessions`}
          description={`Rolling ${data.insights.activeWindowMinutes}-minute window from storefront-tagged analytics sessions.`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminCompactMetric
              label="Live visitors"
              value={String(data.insights.live.activeVisitorCount)}
            />
            <AdminCompactMetric
              label="Top sources"
              value={String(data.insights.live.trafficSources.length)}
            />
            <AdminCompactMetric
              label="Top pages"
              value={String(data.insights.live.topPages.length)}
            />
          </div>
          <div className="mt-4 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-3">
              {data.insights.live.topPages.length === 0 ? (
                <AdminEmptyState
                  copy={`No active ${data.storefrontLabel} sessions in the current window.`}
                />
              ) : (
                data.insights.live.topPages.map((page) => (
                  <div
                    key={`${page.pageType}:${page.path}`}
                    className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3"
                  >
                    <div className="truncate text-sm font-semibold text-[var(--adm-text)]">
                      {page.path}
                    </div>
                    <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
                      {page.pageType} · {page.count} active
                    </div>
                  </div>
                ))
              )}
            </div>
            <HorizontalBarsChart
              data={data.insights.live.trafficSources.map((source) => ({
                label: source.label,
                value: source.count,
              }))}
            />
          </div>
        </AdminPanel>
      </AdminPrimaryGrid>

      <AdminPanel
        eyebrow="Trend"
        title={`${data.storefrontLabel} funnel trend`}
        description={`Condensed ${selectedRange.longLabel} trend for cart, checkout, shipping, payment, and paid outcomes.`}
      >
        <MultiSeriesTrendChart labels={trendLabels} series={trendSeries} />
      </AdminPanel>

      <AdminPrimaryGrid rail="balanced">
        <AdminPanel
          eyebrow="Products"
          title="Strong closers"
          description={`Products with the most ${data.storefrontLabel} purchases in the selected window.`}
        >
          <ProductList
            rows={data.insights.topProducts}
            storefrontHref={data.storefront}
            storefrontLabel={data.storefrontLabel}
            emptyCopy={`No ${data.storefrontLabel} purchase data in the selected window.`}
          />
        </AdminPanel>

        <AdminPanel
          eyebrow="Products"
          title="High cart, weak close"
          description="Products with cart pressure but weak conversion into paid purchases."
        >
          <ProductList
            rows={data.insights.underperformingProducts}
            storefrontHref={data.storefront}
            storefrontLabel={data.storefrontLabel}
            emptyCopy={`No ${data.storefrontLabel} dropoff candidates in the selected window.`}
          />
        </AdminPanel>
      </AdminPrimaryGrid>

      <AdminPrimaryGrid rail="balanced">
        <AdminPanel
          eyebrow="Catalog"
          title={`${data.storefrontLabel} catalog state`}
          description="Assigned product and taxonomy counts. Shared products remain deliberately visible in both storefront dashboards."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminCompactMetric
              label="Assigned products"
              value={String(data.catalog.totalProductCount)}
            />
            <AdminCompactMetric
              label="Active products"
              value={String(data.catalog.activeProductCount)}
            />
            <AdminCompactMetric
              label="Draft products"
              value={String(data.catalog.draftProductCount)}
            />
            <AdminCompactMetric
              label="Categories"
              value={String(data.catalog.categoryCount)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={data.links.catalog}
              className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-xs font-semibold text-[var(--adm-text)] hover:bg-[var(--adm-surface-2)]"
            >
              Open catalog
            </Link>
            <Link
              href={data.links.catalogHygiene}
              className="rounded-full border border-[#e2a136] bg-[#fff4dd] px-3 py-2 text-xs font-semibold text-[#81560e] hover:bg-amber-400/15"
            >
              Open hygiene
            </Link>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Content"
          title={`${data.storefrontLabel} landing-page control`}
          description="Draft, published, and scheduled section state for the storefront homepage."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminCompactMetric
              label="Sections"
              value={String(data.landingPage.sectionCount)}
            />
            <AdminCompactMetric
              label="Manual live"
              value={String(data.landingPage.manualSectionCount)}
            />
            <AdminCompactMetric
              label="Manual drafts"
              value={String(data.landingPage.draftManualSectionCount)}
            />
            <AdminCompactMetric
              label="Scheduled"
              value={String(data.landingPage.scheduledSectionCount)}
            />
          </div>
          <p className="mt-4 text-sm text-[var(--adm-text-muted)]">
            Last published:{" "}
            {data.landingPage.lastPublishedAt
              ? formatDate(data.landingPage.lastPublishedAt)
              : "No published section timestamp recorded"}
          </p>
          <div className="mt-4">
            <Link
              href={data.links.landingPage}
              className="rounded-full border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--adm-primary)] hover:bg-[var(--adm-primary)]/15"
            >
              Open landing page editor
            </Link>
          </div>
        </AdminPanel>
      </AdminPrimaryGrid>
    </AdminPage>
  );
}
