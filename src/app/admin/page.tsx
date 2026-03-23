import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  DonutChart,
  SparklineChart,
  type AdminChartPoint,
} from "@/components/admin/AdminCharts";
import {
  AdminCompactMetric,
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminInsightPrimitives";
import { authOptions } from "@/lib/auth";
import { getFinancePageData, getVatPageData } from "@/lib/adminAddonData";
import {
  getActiveSessionSnapshot,
  getActivityFeed,
  getCustomerRevenueMix,
  getFunnelSnapshot,
  getOrderComparisons,
  getProductPerformance,
  getStockCoverageMap,
} from "@/lib/adminInsights";
import { prisma } from "@/lib/prisma";

const PAID_PAYMENT_STATUSES = new Set(["paid", "succeeded", "refunded", "partially_refunded"]);

type AdminLanguage = "de" | "en";

const ADMIN_LOCALE: Record<AdminLanguage, string> = {
  de: "de-DE",
  en: "en-GB",
};

const ADMIN_PAGE_COPY = {
  de: {
    noBaseline: "Keine Vergleichsbasis",
    statusMix: {
      paid: "Bezahlt",
      pending: "Ausstehend",
      canceled: "Storniert",
      totalLabel: "Bestellungen",
    },
    vatStatus: {
      ready_for_handover: "Bereit",
      review_required: "Prüfen",
      estimated: "Geschätzt",
    },
    hero: {
      eyebrow: "Admin / Übersicht",
      title: "Kompakter Überblick über die wichtigsten Admin-Module",
      description:
        "Dieses Dashboard bleibt bewusst schlank. Es zeigt zuerst die wenigen KPIs und Signale, die wirklich zählen, und verweist dann für Details auf Finanzen, USt, Rentabilität, Analyse, Bestellungen und Warnungen.",
      liveVisitors: (count: number) => `${count} Live-Besucher`,
      keyActions: (count: number) => `${count} Kernaufgaben`,
      vatBadge: (status: string) => `USt ${status}`,
    },
    metrics: {
      grossRevenue: { label: "Bruttoumsatz", footnote: "Top-Line der letzten 30 Tage" },
      paidOrders: { label: "Bezahlte Bestellungen", footnote: "bestätigte Bestellungen" },
      sessionCvr: { label: "Session-CVR", footnote: "Session zu bezahlter Bestellung" },
      lowStock: { label: "Niedriger Bestand", footnote: "kritische Varianten / ausverkauft" },
    },
    panels: {
      performance: {
        eyebrow: "Leistung",
        title: "Tempo bezahlter Umsätze",
        description:
          "Letzte 14 Tage, basierend nur auf bezahlten Bestellungen. Das ist eine schnelle Richtungsprüfung, keine Reporting-Oberfläche.",
      },
      orders: {
        eyebrow: "Bestellungen",
        title: "30-Tage-Verteilung",
        description:
          "Kompakter Blick auf bezahlte, ausstehende und stornierte Bestellzustände.",
      },
      modules: {
        eyebrow: "Module",
        title: "Arbeitsbereich-Snapshots",
        description:
          "Eine zentrale KPI pro Modul. Nutze diese Karten, um den nächsten Fokus festzulegen.",
      },
      health: {
        eyebrow: "Status",
        title: "Aktueller Betriebsüberblick",
        description:
          "Ein kompakter Blick auf Live-Traffic, Funnel-Druck, USt-Status und Kundenmix.",
      },
      actions: {
        eyebrow: "Aktionen",
        title: "Wichtigste Aufgaben",
        description:
          "Nur die wenigen Punkte, die den nächsten Schritt des Teams wirklich verändern sollten.",
        empty: "Aktuell sind keine Aufgaben mit hoher Priorität markiert.",
      },
      activity: {
        eyebrow: "Aktivität",
        title: "Neueste Aktivität",
        description:
          "Kurzer Feed für die neuesten Admin- und Commerce-Ereignisse. Für Details nutze die jeweiligen Modul-Seiten.",
        empty: "Keine aktuelle Aktivität gefunden.",
      },
    },
    health: {
      liveVisitors: "Live-Besucher",
      checkoutAbandon: "Checkout-Abbruch",
      vatDeadline: "USt-Frist",
      returningRevenue: "Wiederkehrender Umsatz",
      days: (count: number) => `${count} Tage`,
    },
    modules: {
      finance: {
        title: "Finanzen",
        detail: (ratio: string) => `${ratio} Deckungsbeitrag`,
      },
      vat: {
        title: "USt",
        detail: (status: string) => `${status} für den aktuellen Monat`,
      },
      profitability: {
        title: "Rentabilität",
        lead: (productTitle: string) => `${productTitle} führt nach Profit`,
        empty: "Noch kein klares Profitsignal",
      },
      analytics: {
        title: "Analyse",
        detail: (count: number) => `${count} Live-Besucher aktuell`,
      },
      orders: {
        title: "Bestellungen",
        detail: (delta: string) => `${delta} vs. vorherige 30 Tage`,
      },
      customers: {
        title: "Kunden",
        detail: (count: number) => `${count} wiederkehrende Kunden`,
      },
      catalog: {
        title: "Katalog",
        detail: (count: number) => `${count} ausverkauft`,
      },
      alerts: {
        title: "Warnungen",
        detail: "Aktuelle Aufgaben mit hoher Priorität",
      },
    },
    actions: {
      webhookFailures: {
        title: "Stripe-Webhook-Fehler",
        detail: (count: number) =>
          `${count} fehlgeschlagene Ereignisse müssen geprüft werden, bevor die Zahlungsabstimmung abweicht.`,
        hrefLabel: "Bestellungen öffnen",
      },
      checkoutAbandonment: {
        title: "Erhöhte Checkout-Abbrüche",
        detail: (rate: string) =>
          `${rate} der Checkouts brechen vor der Zahlung ab.`,
        hrefLabel: "Analyse öffnen",
      },
      replenishment: {
        title: "Nachschub erforderlich",
        outOfStock: (productTitle: string, variantTitle: string) =>
          `${productTitle} / ${variantTitle} ist ausverkauft.`,
        lowCover: (productTitle: string, variantTitle: string, coverDays: number) =>
          `${productTitle} / ${variantTitle} hat nur noch ungefähr ${coverDays} Tage Lagerreichweite.`,
        hrefLabel: "Katalog öffnen",
      },
      pendingReturns: {
        title: "Offene Retouren warten",
        detail: (count: number) =>
          `${count} Retourenanfrage(n) brauchen noch Routing oder eine Erstattungsentscheidung.`,
        hrefLabel: "Retouren öffnen",
      },
    },
  },
  en: {
    noBaseline: "No baseline",
    statusMix: {
      paid: "Paid",
      pending: "Pending",
      canceled: "Canceled",
      totalLabel: "Orders",
    },
    vatStatus: {
      ready_for_handover: "Ready",
      review_required: "Review",
      estimated: "Estimated",
    },
    hero: {
      eyebrow: "Admin / Overview",
      title: "Compact overview across the core admin modules",
      description:
        "This dashboard stays intentionally light. It surfaces the few KPIs and signals worth checking first, then pushes detail into Finance, VAT, Profitability, Analytics, Orders, and Alerts.",
      liveVisitors: (count: number) => `${count} live visitors`,
      keyActions: (count: number) => `${count} key actions`,
      vatBadge: (status: string) => `VAT ${status}`,
    },
    metrics: {
      grossRevenue: { label: "Gross Revenue", footnote: "30-day top-line" },
      paidOrders: { label: "Paid Orders", footnote: "confirmed orders" },
      sessionCvr: { label: "Session CVR", footnote: "session to paid order" },
      lowStock: { label: "Low Stock", footnote: "at-risk variants / out of stock" },
    },
    panels: {
      performance: {
        eyebrow: "Performance",
        title: "Paid revenue pace",
        description:
          "Last 14 days based on paid orders only. This is a quick direction check, not a reporting surface.",
      },
      orders: {
        eyebrow: "Orders",
        title: "30-day outcome split",
        description: "Compact view of paid, pending, and canceled order states.",
      },
      modules: {
        eyebrow: "Modules",
        title: "Workspace snapshots",
        description: "One key KPI per module. Use these cards to decide where to go next.",
      },
      health: {
        eyebrow: "Health",
        title: "Current operating snapshot",
        description:
          "A compact read across live traffic, funnel pressure, VAT readiness, and customer mix.",
      },
      actions: {
        eyebrow: "Actions",
        title: "Top actions",
        description: "Only the few items that should change what the team does next.",
        empty: "No high-priority actions are currently flagged.",
      },
      activity: {
        eyebrow: "Activity",
        title: "Recent activity",
        description:
          "Short feed for the latest admin and commerce events. Use module pages for full detail.",
        empty: "No recent activity found.",
      },
    },
    health: {
      liveVisitors: "Live Visitors",
      checkoutAbandon: "Checkout Abandon",
      vatDeadline: "VAT Deadline",
      returningRevenue: "Returning Revenue",
      days: (count: number) => `${count} days`,
    },
    modules: {
      finance: {
        title: "Finance",
        detail: (ratio: string) => `${ratio} contribution margin`,
      },
      vat: {
        title: "VAT",
        detail: (status: string) => `${status} for current month`,
      },
      profitability: {
        title: "Profitability",
        lead: (productTitle: string) => `${productTitle} leads by profit`,
        empty: "No product profit signal yet",
      },
      analytics: {
        title: "Analytics",
        detail: (count: number) => `${count} live visitors now`,
      },
      orders: {
        title: "Orders",
        detail: (delta: string) => `${delta} vs previous 30d`,
      },
      customers: {
        title: "Customers",
        detail: (count: number) => `${count} returning customers`,
      },
      catalog: {
        title: "Catalog",
        detail: (count: number) => `${count} out of stock`,
      },
      alerts: {
        title: "Alerts",
        detail: "Current high-priority actions",
      },
    },
    actions: {
      webhookFailures: {
        title: "Stripe webhook failures",
        detail: (count: number) =>
          `${count} failed event(s) need review before payment reconciliation drifts.`,
        hrefLabel: "Open orders",
      },
      checkoutAbandonment: {
        title: "Checkout abandonment elevated",
        detail: (rate: string) => `${rate} of checkouts are dropping before payment.`,
        hrefLabel: "Inspect analytics",
      },
      replenishment: {
        title: "Replenishment required",
        outOfStock: (productTitle: string, variantTitle: string) =>
          `${productTitle} / ${variantTitle} is out of stock.`,
        lowCover: (productTitle: string, variantTitle: string, coverDays: number) =>
          `${productTitle} / ${variantTitle} has roughly ${coverDays} days of stock cover left.`,
        hrefLabel: "Open catalog",
      },
      pendingReturns: {
        title: "Pending returns waiting",
        detail: (count: number) =>
          `${count} return request(s) still need routing or refund decisions.`,
        hrefLabel: "Open returns",
      },
    },
  },
} as const;

const resolveAdminLanguage = (value: string | string[] | undefined): AdminLanguage => {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "de" ? "de" : "en";
};

const formatMoney = (amountCents: number, locale: string, currency = "EUR") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

const formatDelta = (value: number | null, noBaselineLabel: string) => {
  if (value === null) return noBaselineLabel;
  const numeric = Math.round(value * 100);
  return `${numeric > 0 ? "+" : ""}${numeric}%`;
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatVatStatus = (
  value: "estimated" | "review_required" | "ready_for_handover",
  language: AdminLanguage,
) => {
  return ADMIN_PAGE_COPY[language].vatStatus[value];
};

type ActivityItem = Awaited<ReturnType<typeof getActivityFeed>>[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") notFound();
  const resolvedSearchParams = await searchParams;
  const language = resolveAdminLanguage(resolvedSearchParams?.lang);
  const locale = ADMIN_LOCALE[language];
  const copy = ADMIN_PAGE_COPY[language];

  const now = new Date();
  const trendWindowStart = new Date(now);
  trendWindowStart.setDate(trendWindowStart.getDate() - 13);
  trendWindowStart.setHours(0, 0, 0, 0);
  const salesWindowStart = new Date(now);
  salesWindowStart.setDate(salesWindowStart.getDate() - 29);
  salesWindowStart.setHours(0, 0, 0, 0);

  const [
    failedWebhookCount,
    pendingReturnCount,
    variants,
    recentOrders,
    liveSnapshot,
    funnelSnapshot,
    orderComparisons,
    customerRevenueMix,
    productPerformance,
    activityFeed,
    stockCoverageMap,
    financeData,
    vatData,
  ] = await Promise.all([
    prisma.processedWebhookEvent.count({ where: { status: "failed" } }),
    prisma.returnRequest.count({ where: { status: "PENDING" } }),
    prisma.variant.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        inventory: true,
        product: { select: { id: true, title: true, status: true } },
      },
      where: { product: { status: "ACTIVE" } },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: salesWindowStart } },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        amountTotal: true,
        currency: true,
        paymentStatus: true,
        status: true,
      },
    }),
    getActiveSessionSnapshot(),
    getFunnelSnapshot(30),
    getOrderComparisons(30),
    getCustomerRevenueMix(30),
    getProductPerformance(30),
    getActivityFeed(6),
    getStockCoverageMap(30),
    getFinancePageData(30),
    getVatPageData(6),
  ]);

  const lowStockVariants = variants
    .map((variant) => {
      const onHand = variant.inventory?.quantityOnHand ?? 0;
      const reserved = variant.inventory?.reserved ?? 0;
      const available = Math.max(onHand - reserved, 0);
      const velocity = stockCoverageMap.get(variant.id);
      const coverDays =
        velocity && velocity.dailyVelocity > 0 ? available / velocity.dailyVelocity : null;
      return {
        productTitle: variant.product.title,
        variantTitle: variant.title,
        available,
        coverDays,
        threshold: variant.lowStockThreshold,
      };
    })
    .filter((variant) => variant.available <= variant.threshold)
    .sort((left, right) => {
      const leftCover =
        typeof left.coverDays === "number" ? left.coverDays : Number.POSITIVE_INFINITY;
      const rightCover =
        typeof right.coverDays === "number" ? right.coverDays : Number.POSITIVE_INFINITY;
      if (leftCover !== rightCover) return leftCover - rightCover;
      return left.available - right.available;
    });

  const lowStockCount = lowStockVariants.length;
  const outOfStockCount = lowStockVariants.filter((variant) => variant.available <= 0).length;
  const dashboardCurrency = recentOrders[0]?.currency ?? orderComparisons.currency ?? "EUR";
  const paidOrders = recentOrders.filter((order) =>
    PAID_PAYMENT_STATUSES.has(order.paymentStatus.trim().toLowerCase()),
  );

  const trendDays = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(trendWindowStart);
    day.setDate(trendWindowStart.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
    return { key, label, value: 0 };
  });
  const trendMap = new Map(trendDays.map((day) => [day.key, day]));
  for (const order of paidOrders) {
    const day = trendMap.get(order.createdAt.toISOString().slice(0, 10));
    if (!day) continue;
    day.value += order.amountTotal;
  }
  const salesTrend: AdminChartPoint[] = trendDays.map((day) => ({
    label: day.label,
    value: day.value,
  }));

  const statusMix = [
    { label: copy.statusMix.paid, value: paidOrders.length, colorClassName: "#22d3ee" },
    {
      label: copy.statusMix.pending,
      value: recentOrders.filter(
        (order) => !PAID_PAYMENT_STATUSES.has(order.paymentStatus.trim().toLowerCase()),
      ).length,
      colorClassName: "#818cf8",
    },
    {
      label: copy.statusMix.canceled,
      value: recentOrders.filter((order) =>
        ["canceled", "cancelled", "failed"].includes(order.status.trim().toLowerCase()),
      ).length,
      colorClassName: "#ef4444",
    },
  ];

  const strongestProfitProduct = [...productPerformance]
    .sort((left, right) => right.marginCents - left.marginCents)
    .at(0);

  const primaryAction = [
    failedWebhookCount > 0
      ? {
          title: copy.actions.webhookFailures.title,
          detail: copy.actions.webhookFailures.detail(failedWebhookCount),
          href: "/admin/orders",
          hrefLabel: copy.actions.webhookFailures.hrefLabel,
        }
      : null,
    funnelSnapshot.beginCheckout >= 10 && funnelSnapshot.checkoutAbandonmentRate >= 0.6
      ? {
          title: copy.actions.checkoutAbandonment.title,
          detail: copy.actions.checkoutAbandonment.detail(
            formatPercent(funnelSnapshot.checkoutAbandonmentRate),
          ),
          href: "/admin/analytics",
          hrefLabel: copy.actions.checkoutAbandonment.hrefLabel,
        }
      : null,
    lowStockVariants[0] &&
    (lowStockVariants[0].available <= 0 ||
      (typeof lowStockVariants[0].coverDays === "number" && lowStockVariants[0].coverDays < 7))
      ? {
          title: copy.actions.replenishment.title,
          detail:
            lowStockVariants[0].available <= 0
              ? copy.actions.replenishment.outOfStock(
                  lowStockVariants[0].productTitle,
                  lowStockVariants[0].variantTitle,
                )
              : copy.actions.replenishment.lowCover(
                  lowStockVariants[0].productTitle,
                  lowStockVariants[0].variantTitle,
                  Math.round(lowStockVariants[0].coverDays ?? 0),
                ),
          href: "/admin/catalog",
          hrefLabel: copy.actions.replenishment.hrefLabel,
        }
      : null,
    pendingReturnCount > 0
      ? {
          title: copy.actions.pendingReturns.title,
          detail: copy.actions.pendingReturns.detail(pendingReturnCount),
          href: "/admin/returns",
          hrefLabel: copy.actions.pendingReturns.hrefLabel,
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 3) as Array<{
    title: string;
    detail: string;
    href: string;
    hrefLabel: string;
  }>;

  const moduleCards = [
    {
      href: "/admin/finance",
      title: copy.modules.finance.title,
      value: formatMoney(
        financeData.currentFinance.contributionMarginCents,
        locale,
        dashboardCurrency,
      ),
      detail: copy.modules.finance.detail(
        formatPercent(financeData.currentFinance.contributionMarginRatio),
      ),
    },
    {
      href: "/admin/vat",
      title: copy.modules.vat.title,
      value: formatMoney(vatData.current?.estimatedLiabilityCents ?? 0, locale, dashboardCurrency),
      detail: copy.modules.vat.detail(
        formatVatStatus(vatData.current?.status ?? "estimated", language),
      ),
    },
    {
      href: "/admin/profitability",
      title: copy.modules.profitability.title,
      value: strongestProfitProduct
        ? formatMoney(strongestProfitProduct.marginCents, locale, dashboardCurrency)
        : formatMoney(0, locale, dashboardCurrency),
      detail: strongestProfitProduct
        ? copy.modules.profitability.lead(strongestProfitProduct.productTitle)
        : copy.modules.profitability.empty,
    },
    {
      href: "/admin/analytics",
      title: copy.modules.analytics.title,
      value: formatPercent(funnelSnapshot.sessionToOrderRate),
      detail: copy.modules.analytics.detail(liveSnapshot.activeVisitorCount),
    },
    {
      href: "/admin/orders",
      title: copy.modules.orders.title,
      value: String(orderComparisons.paidOrders.current),
      detail: copy.modules.orders.detail(
        formatDelta(orderComparisons.paidOrders.deltaRatio, copy.noBaseline),
      ),
    },
    {
      href: "/admin/customers",
      title: copy.modules.customers.title,
      value: formatMoney(customerRevenueMix.returningRevenueCents, locale, dashboardCurrency),
      detail: copy.modules.customers.detail(customerRevenueMix.returningCustomerCount),
    },
    {
      href: "/admin/catalog",
      title: copy.modules.catalog.title,
      value: String(lowStockCount),
      detail: copy.modules.catalog.detail(outOfStockCount),
    },
    {
      href: "/admin/alerts",
      title: copy.modules.alerts.title,
      value: String(primaryAction.length),
      detail: copy.modules.alerts.detail,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#060b14] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.18),_transparent_28%),linear-gradient(135deg,_rgba(8,15,26,0.98),_rgba(12,22,38,0.92))]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-200/65">
              {copy.hero.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{copy.hero.title}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              {copy.hero.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-slate-100">
              {copy.hero.liveVisitors(liveSnapshot.activeVisitorCount)}
            </span>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">
              {copy.hero.keyActions(primaryAction.length)}
            </span>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-200">
              {copy.hero.vatBadge(formatVatStatus(vatData.current?.status ?? "estimated", language))}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label={copy.metrics.grossRevenue.label}
          value={formatMoney(orderComparisons.revenue.current, locale, dashboardCurrency)}
          detail={formatDelta(orderComparisons.revenue.deltaRatio, copy.noBaseline)}
          detailBadgeClassName="orders-kpi-badge-emerald"
          footnote={copy.metrics.grossRevenue.footnote}
          tone="emerald"
        />
        <AdminMetricCard
          label={copy.metrics.paidOrders.label}
          value={String(orderComparisons.paidOrders.current)}
          detail={formatDelta(orderComparisons.paidOrders.deltaRatio, copy.noBaseline)}
          detailBadgeClassName="orders-kpi-badge-violet"
          footnote={copy.metrics.paidOrders.footnote}
          tone="violet"
        />
        <AdminMetricCard
          label={copy.metrics.sessionCvr.label}
          value={formatPercent(funnelSnapshot.sessionToOrderRate)}
          footnote={copy.metrics.sessionCvr.footnote}
        />
        <AdminMetricCard
          label={copy.metrics.lowStock.label}
          value={String(lowStockCount)}
          detail={String(outOfStockCount)}
          detailBadgeClassName="orders-kpi-badge-amber"
          footnote={copy.metrics.lowStock.footnote}
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          eyebrow={copy.panels.performance.eyebrow}
          title={copy.panels.performance.title}
          description={copy.panels.performance.description}
        >
          <SparklineChart data={salesTrend} />
        </AdminPanel>
        <AdminPanel
          eyebrow={copy.panels.orders.eyebrow}
          title={copy.panels.orders.title}
          description={copy.panels.orders.description}
        >
          <DonutChart
            data={statusMix}
            totalLabel={copy.statusMix.totalLabel}
            totalValue={String(recentOrders.length)}
          />
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel
          eyebrow={copy.panels.modules.eyebrow}
          title={copy.panels.modules.title}
          description={copy.panels.modules.description}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {moduleCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-cyan-400/20 hover:bg-cyan-400/5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {card.title}
                </div>
                <div className="mt-3 text-xl font-semibold text-white">{card.value}</div>
                <div className="mt-2 text-sm text-slate-400">{card.detail}</div>
              </Link>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel
          eyebrow={copy.panels.health.eyebrow}
          title={copy.panels.health.title}
          description={copy.panels.health.description}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminCompactMetric
              label={copy.health.liveVisitors}
              value={String(liveSnapshot.activeVisitorCount)}
            />
            <AdminCompactMetric
              label={copy.health.checkoutAbandon}
              value={formatPercent(funnelSnapshot.checkoutAbandonmentRate)}
            />
            <AdminCompactMetric
              label={copy.health.vatDeadline}
              value={copy.health.days(vatData.deadline.daysUntilDue)}
            />
            <AdminCompactMetric
              label={copy.health.returningRevenue}
              value={formatMoney(customerRevenueMix.returningRevenueCents, locale, dashboardCurrency)}
            />
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          eyebrow={copy.panels.actions.eyebrow}
          title={copy.panels.actions.title}
          description={copy.panels.actions.description}
        >
          {primaryAction.length === 0 ? (
            <AdminEmptyState copy={copy.panels.actions.empty} />
          ) : (
            <div className="space-y-3">
              {primaryAction.map((item) => (
                <div
                  key={`${item.title}-${item.href}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                  <Link
                    href={item.href}
                    className="mt-3 inline-flex text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                  >
                    {item.hrefLabel}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
        <AdminPanel
          eyebrow={copy.panels.activity.eyebrow}
          title={copy.panels.activity.title}
          description={copy.panels.activity.description}
        >
          <ActivityFeed items={activityFeed} emptyLabel={copy.panels.activity.empty} locale={locale} />
        </AdminPanel>
      </section>
    </div>
  );
}

function ActivityFeed({
  items,
  emptyLabel,
  locale,
}: {
  items: ActivityItem[];
  emptyLabel: string;
  locale: string;
}) {
  if (items.length === 0) return <AdminEmptyState copy={emptyLabel} />;
  return (
    <div className="space-y-3">
      {items.map((entry) => (
        <div
          key={entry.id}
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{entry.title}</p>
              <p className="truncate text-xs text-slate-500">{entry.subtitle}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              {new Date(entry.createdAt).toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
