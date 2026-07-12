import Link from "next/link";
import { type Storefront } from "@prisma/client";
import { notFound } from "next/navigation";
import { getProfitabilityPageData } from "@/lib/adminAddonData";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  formatAdminMoney as formatMoney,
  formatAdminPercent as formatPercent,
} from "@/lib/adminFormatting";
import {
  AdminTimeRangeTabs,
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";
import {
  buildAdminSearchHref,
  getAdminTimeRangeOption,
  parseAdminTimeRangeDays,
} from "@/lib/adminTimeRange";
import { STOREFRONT_LABELS } from "@/lib/storefronts";

type ProfitabilityPageData = Awaited<ReturnType<typeof getProfitabilityPageData>>;
type ProfitabilityRow = ProfitabilityPageData["rows"][number];
type StorefrontSummary = ProfitabilityPageData["storefronts"][number];

const getStorefrontBadgeClassName = (storefront: Storefront) =>
  storefront === "GROW"
    ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
    : "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]";

function StorefrontBadge({ storefront }: { storefront: Storefront }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStorefrontBadgeClassName(
        storefront,
      )}`}
    >
      {STOREFRONT_LABELS[storefront]}
    </span>
  );
}

function StorefrontSummaryCard({
  item,
  currency,
  lens,
}: {
  item: StorefrontSummary;
  currency: string;
  lens: "contribution" | "allocated";
}) {
  const primaryValue =
    lens === "allocated" ? item.allocatedProfitCents : item.contributionMarginCents;
  const primaryRatio =
    lens === "allocated" ? item.allocatedProfitRatio : item.contributionMarginRatio;
  return (
    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
            Storefront
          </div>
          <div className="mt-2 text-lg font-semibold text-[var(--adm-text)]">{item.label}</div>
        </div>
        <StorefrontBadge storefront={item.storefront} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
            {lens === "allocated" ? "Allocated Profit" : "Contribution"}
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--adm-text)]">
            {formatMoney(primaryValue, currency)}
          </div>
          <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
            {formatPercent(primaryRatio)}{" "}
            {lens === "allocated" ? "after allocated overhead" : "after COGS and fees"}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
            Net Revenue
          </div>
          <div className="mt-2 text-xl font-semibold text-[var(--adm-text)]">
            {formatMoney(item.netRevenueCents, currency)}
          </div>
          <div className="mt-1 text-xs text-[var(--adm-text-muted)]">{item.paidOrderCount} paid orders</div>
        </div>
        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
            Order Quality
          </div>
          <div className="mt-2 text-base font-semibold text-[var(--adm-text)]">
            {formatMoney(item.averageOrderValueCents, currency)} AOV
          </div>
          <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
            {formatMoney(item.contributionPerOrderCents, currency)} contribution per order
          </div>
        </div>
        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
            Catalog Fit
          </div>
          <div className="mt-2 text-base font-semibold text-[var(--adm-text)]">
            {item.activeProductCount} active SKUs
          </div>
          <div className="mt-1 text-xs text-[var(--adm-text-muted)]">
            {item.exclusiveProductCount} exclusive · {formatPercent(item.refundRate)} refunded
          </div>
        </div>
      </div>
    </div>
  );
}

function OpportunityList({
  rows,
  emptyCopy,
  metricLabel,
  metricValue,
  submetricLabel,
  submetricValue,
}: {
  rows: ProfitabilityRow[];
  emptyCopy: string;
  metricLabel: string;
  metricValue: (row: ProfitabilityRow) => string;
  submetricLabel: string;
  submetricValue: (row: ProfitabilityRow) => string;
}) {
  if (rows.length === 0) {
    return <AdminEmptyState copy={emptyCopy} />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Link
          key={row.productId}
          href={`/admin/catalog/${row.productId}`}
          className="block rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 transition hover:border-[var(--adm-primary)] hover:bg-[var(--adm-primary)]/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {row.storefronts.map((storefront) => (
                  <StorefrontBadge key={`${row.productId}-${storefront}`} storefront={storefront} />
                ))}
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-[var(--adm-text)]">
                {row.productTitle}
              </div>
              <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                {row.categoryName} · {row.supplierName}
              </div>
              <div className="mt-2 text-xs text-[var(--adm-text-muted)]">
                {row.views} views · {row.purchases} purchases · {formatPercent(row.conversionRate)} CVR
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-[var(--adm-text)]">{metricValue(row)}</div>
              <div className="mt-1 text-xs text-[var(--adm-text-faint)]">{metricLabel}</div>
              <div className="mt-2 text-xs text-[var(--adm-text-muted)]">
                {submetricValue(row)} {submetricLabel}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function AdminProfitabilityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("finance.read"))) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const days = parseAdminTimeRangeDays(resolvedSearchParams?.days);
  const selectedLens =
    (Array.isArray(resolvedSearchParams?.lens)
      ? resolvedSearchParams?.lens[0]
      : resolvedSearchParams?.lens) === "allocated"
      ? "allocated"
      : "contribution";
  const selectedRange = getAdminTimeRangeOption(days);

  const {
    rows,
    storefronts,
    opportunities,
    coverage,
  } = await getProfitabilityPageData(days);

  const bestProfit =
    [...rows].sort((left, right) =>
      selectedLens === "allocated"
        ? right.allocatedProfitCents - left.allocatedProfitCents
        : right.marginCents - left.marginCents,
    )[0] ?? null;
  const worstProfit =
    [...rows].sort((left, right) =>
      selectedLens === "allocated"
        ? left.allocatedProfitCents - right.allocatedProfitCents
        : left.marginCents - right.marginCents,
    )[0] ?? null;
  const bestMargin =
    [...rows].sort((left, right) =>
      selectedLens === "allocated"
        ? right.allocatedProfitRate - left.allocatedProfitRate
        : right.marginRate - left.marginRate,
    )[0] ?? null;
  const leadingStorefront =
    [...storefronts].sort((left, right) =>
      selectedLens === "allocated"
        ? right.allocatedProfitCents - left.allocatedProfitCents
        : right.contributionMarginCents - left.contributionMarginCents,
    )[0] ?? null;
  const displayRows = [...rows].sort((left, right) =>
    selectedLens === "allocated"
      ? right.allocatedProfitCents - left.allocatedProfitCents
      : right.marginCents - left.marginCents,
  );
  const currency = coverage.currency;

  return (
    <AdminPage layout="dashboard">
      <AdminPageHeader
        eyebrow="Control Layer / Profitability"
        title="Margin and profit opportunities"
        description={selectedLens === "allocated" ? "Allocated overhead and contribution performance across Smokeify and GrowVault." : "Contribution margin, price, assortment, and traffic opportunities across both storefronts."}
        actions={<AdminTimeRangeTabs pathname="/admin/profitability" activeDays={days} />}
      />
      <section className="hidden">
        <div className="absolute inset-0 bg-[var(--adm-surface)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-violet-200/70">
              Control Layer / Profitability
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--adm-text)]">
              Margin and profit opportunities across Smokeify and GrowVault
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-[var(--adm-text-muted)]">
              {selectedLens === "allocated"
                ? "This report adds explicit storefront overhead allocation on top of contribution data so the team can inspect a fuller profit view without losing the direct-margin baseline."
                : "This report is contribution-focused. It uses tracked net revenue, product cost and payment fees to show where price, assortment, storefront allocation and traffic can improve commercial performance."}
            </p>
            <div className="mt-4 inline-flex rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text)]">
              {selectedRange.adjectiveLabel} control window
            </div>
          </div>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <AdminTimeRangeTabs pathname="/admin/profitability" activeDays={days} />
            <div className="inline-flex rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-1 text-xs font-semibold">
              <Link
                href={buildAdminSearchHref("/admin/profitability", {
                  days: String(days),
                  lens: "contribution",
                })}
                className={`rounded-full px-3 py-1.5 ${selectedLens === "contribution" ? "bg-cyan-300 text-white" : "text-[var(--adm-text)]"}`}
              >
                Contribution
              </Link>
              <Link
                href={buildAdminSearchHref("/admin/profitability", {
                  days: String(days),
                  lens: "allocated",
                })}
                className={`rounded-full px-3 py-1.5 ${selectedLens === "allocated" ? "bg-cyan-300 text-white" : "text-[var(--adm-text)]"}`}
              >
                Allocated Profit
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link
                href="/admin/catalog"
                className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
              >
                Catalog workspace
              </Link>
              <Link
                href="/admin/finance"
                className="rounded-full border border-[var(--adm-success)] bg-[var(--adm-primary-soft)] px-3 py-2 text-[var(--adm-success)] transition hover:border-[var(--adm-success)] hover:bg-emerald-400/15"
              >
                Finance control
              </Link>
              <Link
                href="/admin/orders"
                className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-violet-200 transition hover:border-violet-300/30 hover:bg-violet-400/15"
              >
                Order margins
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-cyan-500/20 bg-[var(--adm-primary-soft)] px-4 py-3 text-sm text-[var(--adm-primary)]">
        {selectedLens === "allocated"
          ? `Allocated profit is currently distributing ${formatMoney(coverage.allocatedOverheadCents, currency)} of explicit overhead from allocated expense records and recurring plans.`
          : "Use contribution first to isolate direct commercial performance, then switch to Allocated Profit for a fuller overhead-aware lens."}
      </div>

      {coverage.unattributedPaidOrders > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          {coverage.unattributedPaidOrders} paid order(s) in the selected window are missing
          storefront attribution. Storefront comparison currently excludes{" "}
          {formatMoney(coverage.unattributedContributionCents, currency)} of contribution until
          those orders are classified. Resolve them in{" "}
          <Link href="/admin/attribution" className="font-semibold underline underline-offset-2">
            Attribution
          </Link>
          .
        </div>
      ) : null}

      {coverage.unallocatedExpenseCount > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          {coverage.unallocatedExpenseCount} expense record(s) in the selected window still lack
          complete storefront allocation, so the allocated-profit lens remains incomplete until they
          are fixed in{" "}
          <Link href="/admin/expenses" className="font-semibold underline underline-offset-2">
            Expenses
          </Link>
          .
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Best Profit"
          value={
            bestProfit
              ? formatMoney(
                  selectedLens === "allocated"
                    ? bestProfit.allocatedProfitCents
                    : bestProfit.marginCents,
                  currency,
                )
              : formatMoney(0, currency)
          }
          detail={bestProfit ? bestProfit.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-violet"
          footnote={`highest ${selectedRange.adjectiveLabel} ${selectedLens === "allocated" ? "allocated profit" : "contribution"}`}
          tone="violet"
        />
        <AdminMetricCard
          label="Weakest Profit"
          value={
            worstProfit
              ? formatMoney(
                  selectedLens === "allocated"
                    ? worstProfit.allocatedProfitCents
                    : worstProfit.marginCents,
                  currency,
                )
              : formatMoney(0, currency)
          }
          detail={worstProfit ? worstProfit.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote="largest current margin drag"
          tone="amber"
        />
        <AdminMetricCard
          label="Strongest Margin"
          value={
            bestMargin
              ? formatPercent(
                  selectedLens === "allocated"
                    ? bestMargin.allocatedProfitRate
                    : bestMargin.marginRate,
                )
              : "0%"
          }
          detail={bestMargin ? bestMargin.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-emerald"
          footnote={
            selectedLens === "allocated"
              ? "best tracked allocated-profit rate"
              : "best tracked contribution rate"
          }
          tone="emerald"
        />
        <AdminMetricCard
          label="Leading Storefront"
          value={
            leadingStorefront
              ? formatMoney(
                  selectedLens === "allocated"
                    ? leadingStorefront.allocatedProfitCents
                    : leadingStorefront.contributionMarginCents,
                  currency,
                )
              : formatMoney(0, currency)
          }
          detail={leadingStorefront ? leadingStorefront.label : "no data"}
          detailBadgeClassName="orders-kpi-badge-slate"
          footnote={
            selectedLens === "allocated"
              ? "highest storefront allocated profit"
              : "highest storefront contribution"
          }
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          eyebrow="Storefronts"
          title={
            selectedLens === "allocated"
              ? "Smokeify vs GrowVault allocated profit quality"
              : "Smokeify vs GrowVault contribution quality"
          }
          description={
            selectedLens === "allocated"
              ? "Compare storefront performance after explicit overhead allocation while keeping attribution and allocation blockers visible."
              : "Compare which storefront converts contribution into cash most efficiently before shared operating costs are allocated."
          }
        >
          <div className="space-y-4">
            {storefronts.map((item) => (
              <StorefrontSummaryCard
                key={item.storefront}
                item={item}
                currency={currency}
                lens={selectedLens}
              />
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Actions"
          title="How to use this view"
          description="The fastest margin wins usually come from pricing discipline, pruning weak traffic and expanding proven products to the right storefront."
        >
          <div className="space-y-3 text-sm text-[var(--adm-text-muted)]">
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Raise price carefully on products with healthy conversion and modest margin before
              spending more to push traffic.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Review low-margin products with high traffic first. They often consume ad spend and
              support effort without enough contribution.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Expand proven Smokeify products into GrowVault when margin and conversion are already
              established and catalog fit is clear.
            </div>
            <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
              Push more visibility to products with strong contribution but limited views before
              broad discounting the rest of the catalog.
            </div>
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminPanel
          eyebrow="Pricing"
          title="Best price-lift candidates"
          description="These products already convert well enough that a disciplined price increase or discount rollback is worth testing."
        >
          <OpportunityList
            rows={opportunities.priceLiftCandidates}
            emptyCopy="No clear price-lift candidates are available in the selected period."
            metricLabel={selectedLens === "allocated" ? "allocated profit rate" : "current margin rate"}
            metricValue={(row) =>
              formatPercent(
                selectedLens === "allocated" ? row.allocatedProfitRate : row.marginRate,
              )
            }
            submetricLabel={selectedLens === "allocated" ? "allocated profit" : "contribution"}
            submetricValue={(row) =>
              formatMoney(
                selectedLens === "allocated" ? row.allocatedProfitCents : row.marginCents,
                currency,
              )
            }
          />
        </AdminPanel>

        <AdminPanel
          eyebrow="Leakage"
          title="Traffic with weak contribution"
          description="Start margin repair here. These products attract attention but are not turning enough demand into contribution."
        >
          <OpportunityList
            rows={opportunities.marginLeakCandidates}
            emptyCopy="No obvious high-traffic margin leaks were found in the selected period."
            metricLabel={selectedLens === "allocated" ? "allocated profit rate" : "tracked margin rate"}
            metricValue={(row) =>
              formatPercent(
                selectedLens === "allocated" ? row.allocatedProfitRate : row.marginRate,
              )
            }
            submetricLabel={selectedLens === "allocated" ? "allocated profit" : "contribution"}
            submetricValue={(row) =>
              formatMoney(
                selectedLens === "allocated" ? row.allocatedProfitCents : row.marginCents,
                currency,
              )
            }
          />
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminPanel
          eyebrow="Scale"
          title="High-margin products that deserve more visibility"
          description="These rows already create strong contribution. Merchandising, category placement, SEO and paid support are more defensible here."
        >
          <OpportunityList
            rows={opportunities.scaleCandidates}
            emptyCopy="No scale candidates were found with the current thresholds."
            metricLabel="views in window"
            metricValue={(row) => String(row.views)}
            submetricLabel={selectedLens === "allocated" ? "allocated profit" : "contribution"}
            submetricValue={(row) =>
              formatMoney(
                selectedLens === "allocated" ? row.allocatedProfitCents : row.marginCents,
                currency,
              )
            }
          />
        </AdminPanel>

        <AdminPanel
          eyebrow="GrowVault"
          title="Smokeify products worth expanding into GrowVault"
          description="These products perform on Smokeify, are not currently marked for GrowVault, and look commercially strong enough for storefront expansion."
        >
          <OpportunityList
            rows={opportunities.growExpansionCandidates}
            emptyCopy="No Smokeify-only expansion candidates were found in the selected period."
            metricLabel="purchase count"
            metricValue={(row) => String(row.purchases)}
            submetricLabel={selectedLens === "allocated" ? "allocated profit" : "contribution"}
            submetricValue={(row) =>
              formatMoney(
                selectedLens === "allocated" ? row.allocatedProfitCents : row.marginCents,
                currency,
              )
            }
          />
        </AdminPanel>
      </section>

      <AdminPanel
        eyebrow="Profit Table"
        title={`${selectedRange.adjectiveLabel} product ranking`}
        description={
          selectedLens === "allocated"
            ? "This table keeps the raw commercial signal visible while adding explicit storefront overhead allocation on top."
            : "This table stays close to the raw signal: revenue, tracked contribution, conversion and storefront availability."
        }
      >
        {displayRows.length === 0 ? (
          <AdminEmptyState copy="No profitability rows are available yet." />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {displayRows.map((row) => (
                <Link
                  key={row.productId}
                  href={`/admin/catalog/${row.productId}`}
                  className="block rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 text-sm text-[var(--adm-text-muted)] transition hover:bg-[var(--adm-surface)]"
                >
                  <div className="font-semibold text-[var(--adm-text)]">{row.productTitle}</div>
                  <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                    {row.categoryName} · {row.supplierName}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.storefronts.map((storefront) => (
                      <StorefrontBadge key={`${row.productId}-card-${storefront}`} storefront={storefront} />
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <ProfitabilityMeta label="Revenue" value={formatMoney(row.revenueCents, currency)} />
                    <ProfitabilityMeta
                      label={selectedLens === "allocated" ? "Allocated profit" : "Profit"}
                      value={formatMoney(
                        selectedLens === "allocated" ? row.allocatedProfitCents : row.marginCents,
                        currency,
                      )}
                      tone={
                        (selectedLens === "allocated"
                          ? row.allocatedProfitCents
                          : row.marginCents) >= 0
                          ? "positive"
                          : "warning"
                      }
                    />
                    <ProfitabilityMeta label="CVR" value={formatPercent(row.conversionRate)} />
                    <ProfitabilityMeta label="Views" value={String(row.views)} />
                  </div>
                </Link>
              ))}
            </div>
            <div className="admin-data-grid-scroll hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] md:block">
              <div className="grid min-w-[920px] grid-cols-[1.75fr_1fr_1fr_0.95fr_0.8fr_0.7fr_1fr] gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
                <div>Product</div>
                <div>Category</div>
                <div>Supplier</div>
                <div>Storefronts</div>
                <div>Revenue</div>
                <div>{selectedLens === "allocated" ? "Allocated Profit" : "Profit"}</div>
                <div>CVR / Views</div>
              </div>
              <div className="divide-y divide-white/5">
                {displayRows.map((row) => (
                  <Link
                    key={row.productId}
                    href={`/admin/catalog/${row.productId}`}
                    className="grid min-w-[920px] grid-cols-[1.75fr_1fr_1fr_0.95fr_0.8fr_0.7fr_1fr] gap-3 px-4 py-3 text-sm text-[var(--adm-text-muted)] transition hover:bg-[var(--adm-surface)]"
                  >
                    <div>
                      <div className="font-semibold text-[var(--adm-text)]">{row.productTitle}</div>
                      <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                        {row.purchases} purchases · {row.addToCart} carts
                      </div>
                    </div>
                    <div>{row.categoryName}</div>
                    <div>{row.supplierName}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {row.storefronts.map((storefront) => (
                        <StorefrontBadge key={`${row.productId}-table-${storefront}`} storefront={storefront} />
                      ))}
                    </div>
                    <div>{formatMoney(row.revenueCents, currency)}</div>
                    <div
                      className={
                        (selectedLens === "allocated"
                          ? row.allocatedProfitCents
                          : row.marginCents) >= 0
                          ? "text-[var(--adm-primary)]"
                          : "text-[#81560e]"
                      }
                    >
                      {formatMoney(
                        selectedLens === "allocated" ? row.allocatedProfitCents : row.marginCents,
                        currency,
                      )}
                    </div>
                    <div>
                      <div>{formatPercent(row.conversionRate)}</div>
                      <div className="mt-1 text-xs text-[var(--adm-text-faint)]">{row.views} views</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </AdminPanel>
    </AdminPage>
  );
}

function ProfitabilityMeta({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--adm-primary)]"
      : tone === "warning"
        ? "text-[#81560e]"
        : "text-[var(--adm-text)]";

  return (
    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
