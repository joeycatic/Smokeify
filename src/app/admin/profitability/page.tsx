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
import {
  getAdminTimeRangeOption,
  parseAdminTimeRangeDays,
} from "@/lib/adminTimeRange";
import { STOREFRONT_LABELS } from "@/lib/storefronts";

type ProfitabilityPageData = Awaited<ReturnType<typeof getProfitabilityPageData>>;
type ProfitabilityRow = ProfitabilityPageData["rows"][number];
type StorefrontSummary = ProfitabilityPageData["storefronts"][number];

const getStorefrontBadgeClassName = (storefront: Storefront) =>
  storefront === "GROW"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
    : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";

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
}: {
  item: StorefrontSummary;
  currency: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Storefront
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{item.label}</div>
        </div>
        <StorefrontBadge storefront={item.storefront} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0a1017] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Contribution
          </div>
          <div className="mt-2 text-xl font-semibold text-white">
            {formatMoney(item.contributionMarginCents, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {formatPercent(item.contributionMarginRatio)} after COGS and fees
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a1017] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Net Revenue
          </div>
          <div className="mt-2 text-xl font-semibold text-white">
            {formatMoney(item.netRevenueCents, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-400">{item.paidOrderCount} paid orders</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a1017] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Order Quality
          </div>
          <div className="mt-2 text-base font-semibold text-white">
            {formatMoney(item.averageOrderValueCents, currency)} AOV
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {formatMoney(item.contributionPerOrderCents, currency)} contribution per order
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a1017] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Catalog Fit
          </div>
          <div className="mt-2 text-base font-semibold text-white">
            {item.activeProductCount} active SKUs
          </div>
          <div className="mt-1 text-xs text-slate-400">
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
  currency,
  metricLabel,
  metricValue,
}: {
  rows: ProfitabilityRow[];
  emptyCopy: string;
  currency: string;
  metricLabel: string;
  metricValue: (row: ProfitabilityRow) => string;
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
          className="block rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-cyan-400/20 hover:bg-cyan-400/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {row.storefronts.map((storefront) => (
                  <StorefrontBadge key={`${row.productId}-${storefront}`} storefront={storefront} />
                ))}
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-white">
                {row.productTitle}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {row.categoryName} · {row.supplierName}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {row.views} views · {row.purchases} purchases · {formatPercent(row.conversionRate)} CVR
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">{metricValue(row)}</div>
              <div className="mt-1 text-xs text-slate-500">{metricLabel}</div>
              <div className="mt-2 text-xs text-slate-400">
                {formatMoney(row.marginCents, currency)} contribution
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
  const selectedRange = getAdminTimeRangeOption(days);

  const {
    rows,
    topProfit,
    lowestProfit,
    strongestMargin,
    storefronts,
    opportunities,
    coverage,
  } = await getProfitabilityPageData(days);

  const bestProfit = topProfit[0] ?? null;
  const worstProfit = lowestProfit[0] ?? null;
  const bestMargin = strongestMargin[0] ?? null;
  const leadingStorefront = storefronts[0] ?? null;
  const currency = coverage.currency;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0c0a14] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(135deg,_rgba(12,10,20,0.98),_rgba(16,12,28,0.94))]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-violet-200/70">
              Control Layer / Profitability
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Margin and profit opportunities across Smokeify and GrowVault
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              This report is contribution-focused. It uses tracked net revenue, product cost and
              payment fees to show where price, assortment, storefront allocation and traffic can
              improve commercial performance.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100">
              {selectedRange.adjectiveLabel} control window
            </div>
          </div>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <AdminTimeRangeTabs pathname="/admin/profitability" activeDays={days} />
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link
                href="/admin/catalog"
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                Catalog workspace
              </Link>
              <Link
                href="/admin/finance"
                className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-emerald-200 transition hover:border-emerald-300/30 hover:bg-emerald-400/15"
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

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        Shared shipping operations, packaging, marketing spend and fixed overhead are not allocated
        here yet. Use this page to find contribution opportunity first, then validate full P&amp;L in
        Finance and Expenses.
      </div>

      {coverage.unattributedPaidOrders > 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {coverage.unattributedPaidOrders} paid order(s) in the selected window are missing
          storefront attribution. Storefront comparison currently excludes{" "}
          {formatMoney(coverage.unattributedContributionCents, currency)} of contribution until
          those orders are classified.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Best Profit"
          value={bestProfit ? formatMoney(bestProfit.marginCents, currency) : formatMoney(0, currency)}
          detail={bestProfit ? bestProfit.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-violet"
          footnote={`highest ${selectedRange.adjectiveLabel} contribution`}
          tone="violet"
        />
        <AdminMetricCard
          label="Weakest Profit"
          value={
            worstProfit ? formatMoney(worstProfit.marginCents, currency) : formatMoney(0, currency)
          }
          detail={worstProfit ? worstProfit.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote="largest current margin drag"
          tone="amber"
        />
        <AdminMetricCard
          label="Strongest Margin"
          value={bestMargin ? formatPercent(bestMargin.marginRate) : "0%"}
          detail={bestMargin ? bestMargin.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-emerald"
          footnote="best tracked contribution rate"
          tone="emerald"
        />
        <AdminMetricCard
          label="Leading Storefront"
          value={
            leadingStorefront
              ? formatMoney(leadingStorefront.contributionMarginCents, currency)
              : formatMoney(0, currency)
          }
          detail={leadingStorefront ? leadingStorefront.label : "no data"}
          detailBadgeClassName="orders-kpi-badge-slate"
          footnote="highest storefront contribution"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          eyebrow="Storefronts"
          title="Smokeify vs GrowVault contribution quality"
          description="Compare which storefront converts contribution into cash most efficiently before shared operating costs are allocated."
        >
          <div className="space-y-4">
            {storefronts.map((item) => (
              <StorefrontSummaryCard key={item.storefront} item={item} currency={currency} />
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Actions"
          title="How to use this view"
          description="The fastest margin wins usually come from pricing discipline, pruning weak traffic and expanding proven products to the right storefront."
        >
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              Raise price carefully on products with healthy conversion and modest margin before
              spending more to push traffic.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              Review low-margin products with high traffic first. They often consume ad spend and
              support effort without enough contribution.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              Expand proven Smokeify products into GrowVault when margin and conversion are already
              established and catalog fit is clear.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
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
            currency={currency}
            metricLabel="current margin rate"
            metricValue={(row) => formatPercent(row.marginRate)}
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
            currency={currency}
            metricLabel="tracked margin rate"
            metricValue={(row) => formatPercent(row.marginRate)}
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
            currency={currency}
            metricLabel="views in window"
            metricValue={(row) => String(row.views)}
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
            currency={currency}
            metricLabel="purchase count"
            metricValue={(row) => String(row.purchases)}
          />
        </AdminPanel>
      </section>

      <AdminPanel
        eyebrow="Profit Table"
        title={`${selectedRange.adjectiveLabel} product ranking`}
        description="This table stays close to the raw signal: revenue, tracked contribution, conversion and storefront availability."
      >
        {rows.length === 0 ? (
          <AdminEmptyState copy="No profitability rows are available yet." />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {rows.map((row) => (
                <Link
                  key={row.productId}
                  href={`/admin/catalog/${row.productId}`}
                  className="block rounded-[24px] border border-white/10 bg-[#090d12] px-4 py-4 text-sm text-slate-300 transition hover:bg-white/[0.03]"
                >
                  <div className="font-semibold text-white">{row.productTitle}</div>
                  <div className="mt-1 text-xs text-slate-500">
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
                      label="Profit"
                      value={formatMoney(row.marginCents, currency)}
                      tone={row.marginCents >= 0 ? "positive" : "warning"}
                    />
                    <ProfitabilityMeta label="CVR" value={formatPercent(row.conversionRate)} />
                    <ProfitabilityMeta label="Views" value={String(row.views)} />
                  </div>
                </Link>
              ))}
            </div>
            <div className="admin-data-grid-scroll hidden rounded-[24px] border border-white/10 bg-[#090d12] md:block">
              <div className="grid min-w-[920px] grid-cols-[1.75fr_1fr_1fr_0.95fr_0.8fr_0.7fr_1fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <div>Product</div>
                <div>Category</div>
                <div>Supplier</div>
                <div>Storefronts</div>
                <div>Revenue</div>
                <div>Profit</div>
                <div>CVR / Views</div>
              </div>
              <div className="divide-y divide-white/5">
                {rows.map((row) => (
                  <Link
                    key={row.productId}
                    href={`/admin/catalog/${row.productId}`}
                    className="grid min-w-[920px] grid-cols-[1.75fr_1fr_1fr_0.95fr_0.8fr_0.7fr_1fr] gap-3 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.03]"
                  >
                    <div>
                      <div className="font-semibold text-white">{row.productTitle}</div>
                      <div className="mt-1 text-xs text-slate-500">
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
                    <div className={row.marginCents >= 0 ? "text-cyan-300" : "text-amber-300"}>
                      {formatMoney(row.marginCents, currency)}
                    </div>
                    <div>
                      <div>{formatPercent(row.conversionRate)}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.views} views</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </AdminPanel>
    </div>
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
      ? "text-cyan-300"
      : tone === "warning"
        ? "text-amber-300"
        : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
