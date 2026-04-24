import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FunnelChart,
  HorizontalBarsChart,
  MultiSeriesTrendChart,
} from "@/components/admin/AdminCharts";
import {
  AdminCompactMetric,
  AdminEmptyState,
  AdminMetricCard,
  AdminTimeRangeTabs,
} from "@/components/admin/AdminInsightPrimitives";
import { AdminPageIntro, AdminPanel } from "@/components/admin/AdminWorkspace";
import { requireAdmin } from "@/lib/adminCatalog";
import { getGrowvaultInsights } from "@/lib/adminGrowvaultInsights";
import {
  getGrowvaultSharedDiagnosticsFeed,
  getGrowvaultSharedMerchandisingFeed,
} from "@/lib/growvaultSharedStorefront";
import { getAdminTimeRangeOption, parseAdminTimeRangeDays } from "@/lib/adminTimeRange";

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

function ProductList({
  rows,
  emptyCopy,
}: {
  rows: Awaited<ReturnType<typeof getGrowvaultInsights>>["topProducts"];
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
          href={`/admin/catalog/${row.productId}?storefront=GROW`}
          className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-white/20 hover:bg-white/[0.05]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {row.productTitle}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                <span>{row.addToCart} Warenkörbe</span>
                <span>{row.beginCheckout} Checkouts</span>
                <span>{row.paymentStarted} Zahlungen</span>
                <span>{row.purchases} Käufe</span>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-400">
              <div>{formatPercent(row.cartToPurchaseRate)} Cart → Kauf</div>
              <div className="mt-1">
                {formatPercent(row.checkoutToPurchaseRate)} Checkout → Kauf
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function AdminGrowvaultPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdmin())) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const days = parseAdminTimeRangeDays(resolvedSearchParams?.days);
  const selectedRange = getAdminTimeRangeOption(days);

  const [insights, diagnostics, merchandising] = await Promise.all([
    getGrowvaultInsights(days),
    getGrowvaultSharedDiagnosticsFeed(),
    getGrowvaultSharedMerchandisingFeed(),
  ]);

  const funnelStages = [
    {
      label: "Warenkorb",
      value: insights.funnel.addToCart,
      helper: "Basis",
      color: "#38bdf8",
    },
    {
      label: "Checkout",
      value: insights.funnel.beginCheckout,
      helper: formatPercent(insights.funnel.cartToCheckoutRate),
      color: "#818cf8",
    },
    {
      label: "Versanddaten",
      value: insights.funnel.shippingSubmitted,
      helper: formatPercent(insights.funnel.checkoutToShippingRate),
      color: "#f59e0b",
    },
    {
      label: "Zahlungsstart",
      value: insights.funnel.paymentStarted,
      helper: formatPercent(insights.funnel.shippingToPaymentRate),
      color: "#22d3ee",
    },
    {
      label: "Bezahlte Käufe",
      value:
        insights.funnel.purchaseSessions > 0
          ? insights.funnel.purchaseSessions
          : insights.funnel.paidOrders,
      helper: formatPercent(insights.funnel.paymentToPaidRate),
      color: "#34d399",
    },
  ];

  const trendLabels = insights.trend.map((point) => point.label);
  const trendSeries = [
    {
      label: "Warenkorb",
      color: "#38bdf8",
      values: insights.trend.map((point) => point.addToCart),
    },
    {
      label: "Checkout",
      color: "#818cf8",
      values: insights.trend.map((point) => point.beginCheckout),
    },
    {
      label: "Versanddaten",
      color: "#f59e0b",
      values: insights.trend.map((point) => point.shippingSubmitted),
    },
    {
      label: "Zahlungsstart",
      color: "#22d3ee",
      values: insights.trend.map((point) => point.paymentStarted),
    },
    {
      label: "Käufe",
      color: "#34d399",
      values: insights.trend.map((point) => point.purchases),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <div className="space-y-5">
        <AdminPageIntro
          eyebrow="GrowVault"
          title="Checkout- und Funnel-Insights"
          description={`GrowVault-spezifischer Admin-Arbeitsbereich für Warenkorb, Checkout, Versanddaten, Zahlungsstart und Kaufabschluss im ${selectedRange.longLabel}-Fenster.`}
          actions={<AdminTimeRangeTabs pathname="/admin/growvault" activeDays={days} />}
          metrics={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <AdminMetricCard
                label="Warenkorb"
                value={String(insights.funnel.addToCart)}
                detail={formatPercent(insights.funnel.cartToCheckoutRate)}
                footnote="Sessions mit Add to Cart"
                tone="slate"
              />
              <AdminMetricCard
                label="Checkout"
                value={String(insights.funnel.beginCheckout)}
                detail={formatPercent(insights.funnel.checkoutToShippingRate)}
                footnote="Sessions mit Checkout-Start"
                tone="violet"
              />
              <AdminMetricCard
                label="Versanddaten"
                value={String(insights.funnel.shippingSubmitted)}
                detail={formatPercent(insights.funnel.shippingToPaymentRate)}
                footnote="Kontakt- und Adressdaten erfolgreich übergeben"
                tone="amber"
              />
              <AdminMetricCard
                label="Zahlungsstart"
                value={String(insights.funnel.paymentStarted)}
                detail={formatPercent(insights.funnel.paymentToPaidRate)}
                footnote="Zahlungsseite bereit"
                tone="slate"
              />
              <AdminMetricCard
                label="Bezahlte Käufe"
                value={String(insights.funnel.paidOrders)}
                detail={formatPercent(insights.funnel.paymentToPaidRate)}
                footnote="GrowVault Orders mit bezahltem Status"
                tone="emerald"
              />
            </div>
          }
        />

        {!insights.firstTaggedEventAt ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Für GrowVault existieren noch keine storefront-getaggten Analytics-Events. Der
            Funnel bleibt leer, bis neue Events mit `storefront = GROW` eingehen. Order-Zahlen
            basieren bereits auf `sourceStorefront = GROW`.
          </div>
        ) : null}

        {insights.warningStartsAt ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Der GrowVault Funnel ist erst ab {formatDate(insights.warningStartsAt)} vollständig
            storefront-getaggt. Order-Zahlen bleiben historisch sichtbar, aber Vorstufen des
            Funnels sind davor unvollständig.
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <AdminPanel
            eyebrow="Funnel"
            title="Session-Funnel und Stufenverluste"
            description="Jede Stufe basiert auf storefront-getaggten GrowVault Sessions. Kaufabschlüsse fallen auf bezahlte Orders zurück, wenn noch keine Purchase-Sessiondaten vorhanden sind."
          >
            <FunnelChart stages={funnelStages} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminCompactMetric
                label="Cart-Abbruch"
                value={formatPercent(insights.funnel.cartDropoffRate)}
              />
              <AdminCompactMetric
                label="Checkout-Abbruch"
                value={formatPercent(insights.funnel.checkoutDropoffRate)}
              />
              <AdminCompactMetric
                label="Versand-Abbruch"
                value={formatPercent(insights.funnel.shippingDropoffRate)}
              />
              <AdminCompactMetric
                label="Payment-Abbruch"
                value={formatPercent(insights.funnel.paymentDropoffRate)}
              />
            </div>
          </AdminPanel>

          <AdminPanel
            eyebrow="Live Ops"
            title="Aktive GrowVault Sessions"
            description={`Rolling ${insights.activeWindowMinutes}-Minuten-Fenster aus storefront-getaggten Analytics-Sessions.`}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <AdminCompactMetric
                label="Live-Besucher"
                value={String(insights.live.activeVisitorCount)}
              />
              <AdminCompactMetric
                label="Top-Quellen"
                value={String(insights.live.trafficSources.length)}
              />
              <AdminCompactMetric
                label="Top-Seiten"
                value={String(insights.live.topPages.length)}
              />
            </div>
            <div className="mt-4 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-3">
                {insights.live.topPages.length === 0 ? (
                  <AdminEmptyState copy="Keine aktiven GrowVault Sessions im aktuellen Fenster." />
                ) : (
                  insights.live.topPages.map((page) => (
                    <div
                      key={`${page.pageType}:${page.path}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="truncate text-sm font-semibold text-white">
                        {page.path}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {page.pageType} · {page.count} aktiv
                      </div>
                    </div>
                  ))
                )}
              </div>
              <HorizontalBarsChart
                data={insights.live.trafficSources.map((source) => ({
                  label: source.label,
                  value: source.count,
                }))}
                valueFormatter={(value) => `${value}`}
              />
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          eyebrow="Trend"
          title="GrowVault Funnel-Verlauf"
          description={`Verdichtete ${selectedRange.longLabel}-Trendansicht für Warenkorb, Checkout, Versanddaten, Zahlungsstart und Käufe.`}
        >
          <MultiSeriesTrendChart labels={trendLabels} series={trendSeries} />
        </AdminPanel>

        <div className="grid gap-5 xl:grid-cols-2">
          <AdminPanel
            eyebrow="Produkte"
            title="Starke Abschlüsse"
            description="Produkte mit den meisten GrowVault Käufen im gewählten Zeitraum."
          >
            <ProductList
              rows={insights.topProducts}
              emptyCopy="Noch keine GrowVault Kaufdaten im gewählten Zeitraum."
            />
          </AdminPanel>

          <AdminPanel
            eyebrow="Produkte"
            title="Hoher Warenkorb, schwacher Abschluss"
            description="Produkte mit viel Warenkorb-Druck, aber schwacher Conversion bis zum Kauf."
          >
            <ProductList
              rows={insights.underperformingProducts}
              emptyCopy="Keine auffälligen GrowVault Abbruchkandidaten im gewählten Zeitraum."
            />
          </AdminPanel>
        </div>

        <AdminPanel
          eyebrow="Diagnostik"
          title="Operative Statussignale"
          description="Maschinenlesbare GrowVault Signale aus dem Shared-Storefront-Vertrag."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {diagnostics.statuses.map((status) => (
              <div
                key={status.key}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                    {status.status}
                  </span>
                  <span className="text-xs text-slate-500">{status.key}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{status.summary}</p>
                {status.actionUrl ? (
                  <a
                    href={status.actionUrl}
                    className="mt-3 inline-flex text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline"
                  >
                    Workspace öffnen
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Merchandising"
          title="Shared Merchandising Feed"
          description="GrowVault Homepage-Slots, die im Smokeify Admin gepflegt und in den Feed exportiert werden."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {merchandising.slots.map((slot) => (
              <div
                key={slot.slotKey}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {slot.slotKey}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {slot.copy?.title ?? slot.slotKey}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {slot.productHandles.length} Produkt-Handle(s) im Live-Feed.
                </p>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
