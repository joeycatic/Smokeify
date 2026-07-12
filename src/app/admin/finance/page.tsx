import Link from "next/link";
import { notFound } from "next/navigation";
import { getFinancePageData } from "@/lib/adminAddonData";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  formatAdminMoney as formatMoney,
  formatAdminPercent as formatPercent,
} from "@/lib/adminFormatting";
import { formatExpenseCategoryLabel, type ExpenseCategory } from "@/lib/adminExpenses";
import { getAdminTimeRangeOption, parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  parseAdminStorefrontScope,
  storefrontScopeToStorefront,
} from "@/lib/storefronts";
import {
  AdminTimeRangeTabs,
  AdminCompactMetric,
  AdminDeltaRow,
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { AdminKpiStrip, AdminPage, AdminPageHeader } from "@/components/admin/ui";
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
  if (!(await requireAdminScope("finance.read"))) notFound();
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
    scopeCoverage,
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
    <AdminPage layout="dashboard">
      <AdminPageHeader
        eyebrow="Control Layer / Finanzen"
        title="Umsatzqualität, Kostendruck und Deckungsbeitrag"
        description={`Operativer Finanzbereich für ${ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope]} mit Brutto-/Netto-Transparenz und Periodenvergleich.`}
        actions={<AdminTimeRangeTabs pathname="/admin/finance" activeDays={days} />}
      />
      <section className="hidden">
        <div className="absolute inset-0 bg-[var(--adm-surface)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--adm-success)]/70">
              Control Layer / Finanzen
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--adm-text)]">
              Umsatzqualität, Kostendruck und Deckungsbeitrag
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-[var(--adm-text-muted)]">
              Operativer Finanzbereich für Brutto-/Netto-Transparenz, variable Kosten und
              Periodenvergleich ohne Umbau der restlichen Admin-Abläufe.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text)]">
              {ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope]}
            </div>
          </div>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <AdminTimeRangeTabs pathname="/admin/finance" activeDays={days} />
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link
                href="/admin/orders"
                className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
              >
                Bestellungen
              </Link>
              <Link
                href="/admin/vat"
                className="rounded-full border border-[var(--adm-success)] bg-[var(--adm-primary-soft)] px-3 py-2 text-[var(--adm-success)] transition hover:border-[var(--adm-success)] hover:bg-emerald-400/15"
              >
                USt-Monitor
              </Link>
              <Link
                href="/admin/expenses"
                className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
              >
                Ausgaben
              </Link>
            </div>
          </div>
        </div>
      </section>

      {currentFinance.paidOrderCount === 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          No recognized paid orders were found between {formatDate(currentStart)} and{" "}
          {formatDate(currentEnd)}.
          {latestRecognizedOrderAt
            ? ` Latest recognized paid order: ${formatDate(latestRecognizedOrderAt)}.`
            : " No recognized paid orders exist yet in the database."}
        </div>
      ) : null}

      {storefront ? (
        <div className="rounded-xl border border-cyan-500/20 bg-[var(--adm-primary-soft)] px-4 py-3 text-sm text-[var(--adm-primary)]">
          Finanzen sind aktuell auf {ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope]} begrenzt.
          Nur explizit zugeordnete Ausgaben und Vorsteuer-Anteile fließen in diese Ansicht ein.
          {scopeCoverage.unallocatedExpenseCount > 0
            ? ` ${scopeCoverage.unallocatedExpenseCount} expense record(s) are still unallocated and excluded until they are assigned in Expenses.`
            : " Allocation coverage is currently complete for recorded expenses in the selected window."}
        </div>
      ) : null}

      {expenseMigrationRequired ? (
        <div className="rounded-xl border border-amber-500/20 bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          Ausgaben sind in der aktuellen Datenbank noch nicht vollständig verfügbar. Vorsteuer und
          Kostenebene bleiben bis zur ausstehenden Prisma-Migration deaktiviert.
        </div>
      ) : null}

      <AdminKpiStrip>
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
      </AdminKpiStrip>

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
              deltaToneClassName="text-[var(--adm-success)]"
            />
            <AdminDeltaRow
              label="Refunded gross"
              value={formatMoney(currentFinance.refundedGrossCents, currency)}
              delta={formatDelta(
                currentFinance.refundedGrossCents,
                previousFinance.refundedGrossCents,
              )}
              deltaToneClassName="text-[#81560e]"
            />
            <AdminDeltaRow
              label="COGS"
              value={formatMoney(currentFinance.cogsCents, currency)}
              delta={formatDelta(currentFinance.cogsCents, previousFinance.cogsCents)}
              deltaToneClassName="text-[var(--adm-text-muted)]"
            />
            <AdminDeltaRow
              label="Payment fees"
              value={formatMoney(currentFinance.paymentFeesCents, currency)}
              delta={formatDelta(
                currentFinance.paymentFeesCents,
                previousFinance.paymentFeesCents,
              )}
              deltaToneClassName="text-[var(--adm-text-muted)]"
            />
            <AdminDeltaRow
              label="Contribution margin"
              value={formatMoney(currentFinance.contributionMarginCents, currency)}
              delta={formatDelta(
                currentFinance.contributionMarginCents,
                previousFinance.contributionMarginCents,
              )}
              deltaToneClassName="text-[var(--adm-primary)]"
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
              label="Unallocated expenses"
              value={String(scopeCoverage.unallocatedExpenseCount)}
            />
            <AdminCompactMetric
              label="Refunded orders"
              value={String(currentFinance.refundedOrderCount)}
            />
            <AdminCompactMetric
              label="Missing expense VAT"
              value={String(scopeCoverage.allocatedExpensesMissingVatCount)}
            />
            <AdminCompactMetric
              label="Scoped completeness"
              value={scopeCoverage.isComplete ? "Complete" : "Blocked"}
            />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm text-[var(--adm-text-muted)]">
              {expenseMigrationRequired
                ? "Expense storage is not available yet, so input VAT and non-order operating costs are excluded until the migration is applied."
                : storefront
                  ? scopeCoverage.isComplete
                    ? "This storefront view is allocation-complete for recorded expenses in the selected window."
                    : `${scopeCoverage.unallocatedExpenseCount} expense record(s) remain outside this storefront rollup because they are missing complete allocations.`
                  : "Global finance now includes recorded expense completeness checks, but allocated-profit distribution still lives in Profitability."}
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-sm text-[var(--adm-text-muted)]">
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
          description="These costs feed VAT completeness and scoped expense coverage. Storefront-filtered views include only explicitly allocated shares."
        >
          <div className="space-y-3">
            <AdminDeltaRow
              label="Expense gross"
              value={formatMoney(currentExpenseSummary.totalGrossCents, currency)}
              delta={formatDelta(
                currentExpenseSummary.totalGrossCents,
                previousExpenseSummary.totalGrossCents,
              )}
              deltaToneClassName="text-[#81560e]"
            />
            <AdminDeltaRow
              label="Expense net"
              value={formatMoney(currentExpenseSummary.totalNetCents, currency)}
              delta={formatDelta(
                currentExpenseSummary.totalNetCents,
                previousExpenseSummary.totalNetCents,
              )}
              deltaToneClassName="text-[var(--adm-text-muted)]"
            />
            <AdminDeltaRow
              label="Input VAT"
              value={formatMoney(currentExpenseSummary.deductibleInputVatCents, currency)}
              delta={formatDelta(
                currentExpenseSummary.deductibleInputVatCents,
                previousExpenseSummary.deductibleInputVatCents,
              )}
              deltaToneClassName="text-[var(--adm-success)]"
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
                  className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--adm-text)]">
                        {formatExpenseCategoryLabel(row.category as ExpenseCategory)}
                      </div>
                      <div className="text-xs text-[var(--adm-text-faint)]">{row.count} expense record(s)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[var(--adm-primary)]">
                        {formatMoney(row.grossAmount, currency)}
                      </div>
                      <div className="text-xs text-[var(--adm-text-faint)]">
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
                className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                  {bucket.label}
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 text-[var(--adm-text-muted)]">
                    <span>Gross</span>
                    <span className="font-semibold text-[var(--adm-text)]">
                      {formatMoney(bucket.grossRevenueCents, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[var(--adm-text-muted)]">
                    <span>Net</span>
                    <span className="font-semibold text-[var(--adm-text)]">
                      {formatMoney(bucket.netRevenueCents, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[var(--adm-text-muted)]">
                    <span>Contribution</span>
                    <span className="font-semibold text-[var(--adm-primary)]">
                      {formatMoney(bucket.contributionMarginCents, currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>
    </AdminPage>
  );
}
