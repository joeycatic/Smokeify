import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  AdminTimeRangeTabs,
  AdminCompactMetric,
  AdminDeltaRow,
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminInsightPrimitives";
import { authOptions } from "@/lib/auth";
import { getFinancePageData } from "@/lib/adminAddonData";
import { formatExpenseCategoryLabel, type ExpenseCategory } from "@/lib/adminExpenses";
import { getAdminTimeRangeOption, parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  parseAdminStorefrontScope,
  storefrontScopeToStorefront,
} from "@/lib/storefronts";

const formatMoney = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);

const formatDelta = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? "+100%" : "0%";
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta > 0 ? "+" : ""}${delta}%`;
};

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") notFound();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const days = parseAdminTimeRangeDays(resolvedSearchParams?.days);
  const storefrontScope = parseAdminStorefrontScope(resolvedSearchParams?.storefront);
  const storefront = storefrontScopeToStorefront(storefrontScope);
  const selectedRange = getAdminTimeRangeOption(days);

  const {
    currentFinance,
    previousFinance,
    currentExpenseSummary,
    previousExpenseSummary,
    vatSummary,
    trend,
    expenseByCategory,
    expenseMigrationRequired,
    currentStart,
    currentEnd,
    latestRecognizedOrderAt,
  } = await getFinancePageData(days, storefront);
  const currency = currentFinance.currency;
  const trendTitle =
    days === 30 ? "Rolling 3-day trend" : days === 90 ? "Weekly trend" : "Monthly trend";
  const trendDescription =
    days === 30
      ? "Short-window monitoring in rolling 3-day buckets across the selected range."
      : days === 90
        ? "Weekly monitoring across the selected quarter-style range."
        : "Monthly monitoring across the selected yearly range.";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#08101a] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),linear-gradient(135deg,_rgba(8,16,26,0.98),_rgba(10,18,28,0.94))]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/70">
              Control Layer / Finance
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Revenue quality, cost pressure and contribution margin
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Add-on finance workspace for gross-to-net clarity, variable cost rollups and
              period-over-period control without changing the main admin workflows.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100">
              {ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope]}
            </div>
          </div>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <AdminTimeRangeTabs pathname="/admin/finance" activeDays={days} />
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link
                href="/admin/orders"
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                Order breakdowns
              </Link>
              <Link
                href="/admin/vat"
                className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-200 transition hover:border-emerald-300/30 hover:bg-emerald-400/15"
              >
                VAT monitor
              </Link>
              <Link
                href="/admin/expenses"
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                Expense capture
              </Link>
            </div>
          </div>
        </div>
      </section>

      {currentFinance.paidOrderCount === 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          No recognized paid orders were found between {formatDate(currentStart)} and{" "}
          {formatDate(currentEnd)}.
          {latestRecognizedOrderAt
            ? ` Latest recognized paid order: ${formatDate(latestRecognizedOrderAt)}.`
            : " No recognized paid orders exist yet in the database."}
        </div>
      ) : null}

      {storefront ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Finance is currently scoped to {ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope]}. Shared
          expense and input-VAT allocations are excluded until expenses are tagged per storefront.
        </div>
      ) : null}

      {expenseMigrationRequired ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Expense storage is not available in the current database yet. Input VAT and expense
          layers are shown as unavailable until the pending Prisma migration is applied.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Gross Revenue"
          value={formatMoney(currentFinance.grossRevenueCents, currency)}
          detail={formatDelta(
            currentFinance.grossRevenueCents,
            previousFinance.grossRevenueCents,
          )}
          detailBadgeClassName="orders-kpi-badge-emerald"
          footnote={`${currentFinance.paidOrderCount} recognized paid orders`}
          tone="emerald"
        />
        <AdminMetricCard
          label="Net Revenue"
          value={formatMoney(currentFinance.netRevenueCents, currency)}
          detail={formatDelta(currentFinance.netRevenueCents, previousFinance.netRevenueCents)}
          detailBadgeClassName="orders-kpi-badge-emerald"
          footnote="gross less VAT and refunds"
          tone="emerald"
        />
        <AdminMetricCard
          label="Contribution"
          value={formatMoney(currentFinance.contributionMarginCents, currency)}
          detail={formatDelta(
            currentFinance.contributionMarginCents,
            previousFinance.contributionMarginCents,
          )}
          detailBadgeClassName="orders-kpi-badge-violet"
          footnote={`${formatPercent(currentFinance.contributionMarginRatio)} contribution margin`}
          tone="violet"
        />
        <AdminMetricCard
          label="Estimated Profit"
          value={formatMoney(currentFinance.estimatedProfitCents, currency)}
          detail={vatSummary.status === "review_required" ? "review required" : "estimated"}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote="direct costs and captured fees only"
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          eyebrow="Period Comparison"
          title={`Current ${selectedRange.adjectiveLabel} finance rollup`}
          description="Paid-order rollup using order snapshots, refunds, captured VAT and item cost fields already present in the custom commerce system."
        >
          <div className="space-y-3">
            <AdminDeltaRow
              label="Gross revenue"
              value={formatMoney(currentFinance.grossRevenueCents, currency)}
              delta={formatDelta(currentFinance.grossRevenueCents, previousFinance.grossRevenueCents)}
              deltaToneClassName="text-emerald-300"
            />
            <AdminDeltaRow
              label="Refunded gross"
              value={formatMoney(currentFinance.refundedGrossCents, currency)}
              delta={formatDelta(
                currentFinance.refundedGrossCents,
                previousFinance.refundedGrossCents,
              )}
              deltaToneClassName="text-amber-300"
            />
            <AdminDeltaRow
              label="COGS"
              value={formatMoney(currentFinance.cogsCents, currency)}
              delta={formatDelta(currentFinance.cogsCents, previousFinance.cogsCents)}
              deltaToneClassName="text-slate-300"
            />
            <AdminDeltaRow
              label="Payment fees"
              value={formatMoney(currentFinance.paymentFeesCents, currency)}
              delta={formatDelta(
                currentFinance.paymentFeesCents,
                previousFinance.paymentFeesCents,
              )}
              deltaToneClassName="text-slate-300"
            />
            <AdminDeltaRow
              label="Contribution margin"
              value={formatMoney(currentFinance.contributionMarginCents, currency)}
              delta={formatDelta(
                currentFinance.contributionMarginCents,
                previousFinance.contributionMarginCents,
              )}
              deltaToneClassName="text-cyan-300"
            />
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Scope"
          title="Current calculation boundaries"
          description="This layer is intentionally management-facing. It improves transparency without pretending to be accounting truth."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminCompactMetric
              label="Tax coverage"
              value={formatPercent(currentFinance.taxCoverageRate)}
            />
            <AdminCompactMetric
              label="VAT liability"
              value={formatMoney(vatSummary.estimatedLiabilityCents, currency)}
            />
            <AdminCompactMetric
              label="Missing VAT orders"
              value={String(currentFinance.ordersMissingTaxCount)}
            />
            <AdminCompactMetric
              label="Refunded orders"
              value={String(currentFinance.refundedOrderCount)}
            />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
              {expenseMigrationRequired
                ? "Expense storage is not available yet, so input VAT and non-order operating costs are excluded until the migration is applied."
                : "Shipping costs, marketing spend and tool overhead are still not allocated into estimated profit yet."}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
              Order-level numbers remain traceable because all rollups come from existing order and
              order-item snapshots.
            </div>
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel
          eyebrow="Expense Layer"
          title="Recorded expense impact"
          description="These costs now feed VAT completeness and input-tax visibility. They are still shown separately from order contribution until broader allocation rules are added."
        >
          <div className="space-y-3">
            <AdminDeltaRow
              label="Expense gross"
              value={formatMoney(currentExpenseSummary.totalGrossCents, currency)}
              delta={formatDelta(
                currentExpenseSummary.totalGrossCents,
                previousExpenseSummary.totalGrossCents,
              )}
              deltaToneClassName="text-amber-300"
            />
            <AdminDeltaRow
              label="Expense net"
              value={formatMoney(currentExpenseSummary.totalNetCents, currency)}
              delta={formatDelta(
                currentExpenseSummary.totalNetCents,
                previousExpenseSummary.totalNetCents,
              )}
              deltaToneClassName="text-slate-300"
            />
            <AdminDeltaRow
              label="Input VAT"
              value={formatMoney(currentExpenseSummary.deductibleInputVatCents, currency)}
              delta={formatDelta(
                currentExpenseSummary.deductibleInputVatCents,
                previousExpenseSummary.deductibleInputVatCents,
              )}
              deltaToneClassName="text-emerald-300"
            />
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Expense Mix"
          title={`Current ${selectedRange.adjectiveLabel} categories`}
          description="This is the first operating-cost layer on top of the commerce data. Category-level allocation can expand from here."
        >
          {expenseByCategory.length === 0 ? (
            <AdminEmptyState copy="No current-period expense records are available yet." />
          ) : (
            <div className="space-y-3">
              {expenseByCategory.slice(0, 6).map((row) => (
                <div
                  key={row.category}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {formatExpenseCategoryLabel(row.category as ExpenseCategory)}
                      </div>
                      <div className="text-xs text-slate-500">{row.count} expense record(s)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-cyan-300">
                        {formatMoney(row.grossAmount, currency)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatMoney(row.vatAmount, currency)} VAT
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </section>

      <AdminPanel
        eyebrow="Trend"
        title={trendTitle}
        description={trendDescription}
      >
        {trend.length === 0 ? (
          <AdminEmptyState copy="No finance activity found for the selected trend window." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {trend.map((bucket) => (
              <div
                key={bucket.key}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {bucket.label}
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 text-slate-300">
                    <span>Gross</span>
                    <span className="font-semibold text-white">
                      {formatMoney(bucket.grossRevenueCents, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-300">
                    <span>Net</span>
                    <span className="font-semibold text-white">
                      {formatMoney(bucket.netRevenueCents, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-300">
                    <span>Contribution</span>
                    <span className="font-semibold text-cyan-300">
                      {formatMoney(bucket.contributionMarginCents, currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
