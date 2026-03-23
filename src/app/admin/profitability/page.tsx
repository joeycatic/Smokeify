import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminInsightPrimitives";
import { authOptions } from "@/lib/auth";
import { getProfitabilityPageData } from "@/lib/adminAddonData";

const formatMoney = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export default async function AdminProfitabilityPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") notFound();

  const { rows, topProfit, lowestProfit, strongestMargin, weakestMargin } =
    await getProfitabilityPageData(30);

  const bestProfit = topProfit[0] ?? null;
  const worstProfit = lowestProfit[0] ?? null;
  const bestMargin = strongestMargin[0] ?? null;
  const weakest = weakestMargin[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0c0a14] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(217,70,239,0.12),_transparent_28%),linear-gradient(135deg,_rgba(12,10,20,0.98),_rgba(16,12,28,0.94))]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-violet-200/70">
              Control Layer / Profitability
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Product performance ranked by profit, not just revenue
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              This workspace highlights where gross sales create real contribution and where traffic,
              discounts or returns are masking weak commercial performance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Link
              href="/admin/catalog"
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Catalog workspace
            </Link>
            <Link
              href="/admin/orders"
              className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-violet-200 transition hover:border-violet-300/30 hover:bg-violet-400/15"
            >
              Order margins
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Best Profit"
          value={bestProfit ? formatMoney(bestProfit.marginCents) : formatMoney(0)}
          detail={bestProfit ? bestProfit.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-violet"
          footnote="highest 30-day contribution"
          tone="violet"
        />
        <AdminMetricCard
          label="Weakest Profit"
          value={worstProfit ? formatMoney(worstProfit.marginCents) : formatMoney(0)}
          detail={worstProfit ? worstProfit.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote="lowest 30-day contribution"
          tone="amber"
        />
        <AdminMetricCard
          label="Strongest Margin"
          value={bestMargin ? formatPercent(bestMargin.marginRate) : "0%"}
          detail={bestMargin ? bestMargin.productTitle : "no data"}
          detailBadgeClassName="orders-kpi-badge-emerald"
          footnote="best margin rate"
          tone="emerald"
        />
        <AdminMetricCard
          label="Products Ranked"
          value={String(rows.length)}
          detail={weakest ? weakest.productTitle : "catalog"}
          detailBadgeClassName="orders-kpi-badge-slate"
          footnote="with activity in the last 30 days"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          eyebrow="Leaders"
          title="Top products by contribution"
          description="Prioritize these for stock protection, price discipline and merchandising support."
        >
          {topProfit.length === 0 ? (
            <AdminEmptyState copy="No profitable products are available in the selected period." />
          ) : (
            <div className="space-y-3">
              {topProfit.map((row) => (
                <Link
                  key={row.productId}
                  href={`/admin/catalog/${row.productId}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-violet-400/20 hover:bg-violet-400/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {row.productTitle}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.categoryName} · {row.supplierName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-cyan-300">
                        {formatMoney(row.marginCents)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatPercent(row.marginRate)} margin
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          eyebrow="Risk"
          title="Lowest-profit products"
          description="These rows usually need a pricing, sourcing, content, or returns review before they are scaled further."
        >
          {lowestProfit.length === 0 ? (
            <AdminEmptyState copy="No weak-profit products were found in the selected period." />
          ) : (
            <div className="space-y-3">
              {lowestProfit.map((row) => (
                <Link
                  key={row.productId}
                  href={`/admin/catalog/${row.productId}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-amber-400/20 hover:bg-amber-400/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {row.productTitle}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.views} views · {row.purchases} purchases ·{" "}
                        {formatPercent(row.conversionRate)} CVR
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-amber-300">
                        {formatMoney(row.marginCents)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatMoney(row.revenueCents)} revenue
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AdminPanel>
      </section>

      <AdminPanel
        eyebrow="Profit Table"
        title="30-day product ranking"
        description="Sortable views and filters will come later. This first pass exposes the core product profit table in a dedicated add-on route instead of burying it in the dashboard."
      >
        {rows.length === 0 ? (
          <AdminEmptyState copy="No profitability rows are available yet." />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#090d12]">
            <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              <div>Product</div>
              <div>Category</div>
              <div>Supplier</div>
              <div>Revenue</div>
              <div>Profit</div>
              <div>Margin</div>
              <div>Views</div>
              <div>CVR</div>
            </div>
            <div className="divide-y divide-white/5">
              {rows.map((row) => (
                <Link
                  key={row.productId}
                  href={`/admin/catalog/${row.productId}`}
                  className="grid grid-cols-[1.8fr_1fr_1fr_1fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.03]"
                >
                  <div className="font-semibold text-white">{row.productTitle}</div>
                  <div>{row.categoryName}</div>
                  <div>{row.supplierName}</div>
                  <div>{formatMoney(row.revenueCents)}</div>
                  <div className={row.marginCents >= 0 ? "text-cyan-300" : "text-amber-300"}>
                    {formatMoney(row.marginCents)}
                  </div>
                  <div>{formatPercent(row.marginRate)}</div>
                  <div>{row.views}</div>
                  <div>{formatPercent(row.conversionRate)}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
