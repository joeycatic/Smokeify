import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DonutChart,
  FunnelChart,
  MultiSeriesTrendChart,
  SparklineChart,
  type AdminChartPoint,
} from "@/components/admin/AdminCharts";
import {
  AdminTimeRangeTabs,
  AdminCompactMetric,
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { getFinancePageData, getVatPageData } from "@/lib/adminAddonData";
import {
  getActiveSessionSnapshot,
  getActivityFeed,
  getCustomerRevenueMix,
  getFunnelSnapshot,
  getFunnelTrend,
  getOrderComparisons,
  getProductPerformance,
  getStockCoverageMap,
} from "@/lib/adminInsights";
import {
  buildAdminTimeBuckets,
  getAdminTimeWindowStart,
  parseAdminTimeRangeDays,
} from "@/lib/adminTimeRange";
import { requireAdminScope } from "@/lib/adminCatalog";
import { isMissingProcessedWebhookStorageError } from "@/lib/adminStorageGuards";
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
      grossRevenue: { label: "Bruttoumsatz", footnote: "Top-Line im gewählten Zeitraum" },
      paidOrders: { label: "Bezahlte Bestellungen", footnote: "bestätigte Bestellungen" },
      sessionCvr: { label: "Session-CVR", footnote: "Session zu bezahlter Bestellung" },
      lowStock: { label: "Niedriger Bestand", footnote: "kritische Varianten / ausverkauft" },
    },
    panels: {
      performance: {
        eyebrow: "Leistung",
        title: "Tempo bezahlter Umsätze",
        description:
          "Umsatztrend bezahlter Bestellungen für den gewählten Zeitraum. Das ist eine schnelle Richtungsprüfung, keine Reporting-Oberfläche.",
      },
      orders: {
        eyebrow: "Bestellungen",
        title: "Bestellstatus-Verteilung",
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
        title: "Priorisierter Admin-Inbox",
        description:
          "Operative Signale nach Dringlichkeit sortiert, damit die naechste Entscheidung klar ist.",
        empty: "Aktuell sind keine priorisierten Aufgaben markiert.",
        priority: {
          critical: "Kritisch",
          high: "Hoch",
          medium: "Mittel",
        },
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
        detail: (delta: string) => `${delta} vs. vorheriges Zeitfenster`,
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
      category: {
        payments: "Zahlungen",
        vat: "USt",
        expenses: "Ausgaben",
        conversion: "Conversion",
        inventory: "Bestand",
        support: "Support",
      },
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
      vatDeadline: {
        title: "USt-Frist naht",
        detail: (days: number) =>
          `${days} Tag(e) bis zur USt-Uebergabe, aber der Status ist noch nicht bereit.`,
        hrefLabel: "USt öffnen",
      },
      expensesIncomplete: {
        title: "Ausgabendaten unvollstaendig",
        detail: (documents: number, vat: number) =>
          `${documents} Beleg(e) und ${vat} USt-Betraeg(e) fehlen fuer den Vorsteuerabzug.`,
        hrefLabel: "Ausgaben öffnen",
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
      grossRevenue: { label: "Gross Revenue", footnote: "selected-window top-line" },
      paidOrders: { label: "Paid Orders", footnote: "confirmed orders" },
      sessionCvr: { label: "Session CVR", footnote: "session to paid order" },
      lowStock: { label: "Low Stock", footnote: "at-risk variants / out of stock" },
    },
    panels: {
      performance: {
        eyebrow: "Performance",
        title: "Paid revenue pace",
        description:
          "Paid-order revenue trend for the selected window. This is a quick direction check, not a reporting surface.",
      },
      orders: {
        eyebrow: "Orders",
        title: "Order outcome split",
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
        title: "Priority admin inbox",
        description: "Operational signals sorted by urgency so the next decision is clear.",
        empty: "No prioritized actions are currently flagged.",
        priority: {
          critical: "Critical",
          high: "High",
          medium: "Medium",
        },
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
        detail: (delta: string) => `${delta} vs previous window`,
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
      category: {
        payments: "Payments",
        vat: "VAT",
        expenses: "Expenses",
        conversion: "Conversion",
        inventory: "Inventory",
        support: "Support",
      },
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
      vatDeadline: {
        title: "VAT deadline approaching",
        detail: (days: number) =>
          `${days} day(s) remain until VAT handover, but the status is not ready.`,
        hrefLabel: "Open VAT",
      },
      expensesIncomplete: {
        title: "Expense data incomplete",
        detail: (documents: number, vat: number) =>
          `${documents} document(s) and ${vat} VAT amount(s) are missing for input VAT review.`,
        hrefLabel: "Open expenses",
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

type AdminInboxPriority = "critical" | "high" | "medium";

type AdminInboxAction = {
  priority: AdminInboxPriority;
  category: string;
  score: number;
  title: string;
  detail: string;
  href: string;
  hrefLabel: string;
};

const ADMIN_INBOX_PRIORITY_WEIGHT: Record<AdminInboxPriority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

const ADMIN_INBOX_PRIORITY_CLASS: Record<AdminInboxPriority, string> = {
  critical: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  high: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  medium: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
};

async function getFailedWebhookCount() {
  try {
    return await prisma.processedWebhookEvent.count({ where: { status: "failed" } });
  } catch (error) {
    if (!isMissingProcessedWebhookStorageError(error)) {
      throw error;
    }
    return 0;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("dashboard.read"))) notFound();
  const resolvedSearchParams = await searchParams;
  const language = resolveAdminLanguage(resolvedSearchParams?.lang);
  const days = parseAdminTimeRangeDays(resolvedSearchParams?.days);
  const locale = ADMIN_LOCALE[language];
  const copy = ADMIN_PAGE_COPY[language];
  const salesWindowStart = getAdminTimeWindowStart(days);
  const paceTrendDays = days >= 365 ? 30 : days >= 90 ? 21 : 14;
  const visualCopy =
    language === "de"
      ? {
          deckEyebrow: "Signaldeck",
          deckTitle: "Handelslage im Blick",
          deckDescription:
            "Die Übersicht priorisiert Nachfrage, Checkout-Druck, Zahlungsqualität und operative Risiken in einem Scan.",
          revenuePulse: "Umsatztempo",
          demandPulse: "Nachfragefluss",
          queuePressure: "Offene Signale",
          funnelRecovery: "Checkout zu bezahlt",
          paceEyebrow: "Pace",
          paceTitle: "Commerce-Fluss",
          paceDescription: `${paceTrendDays}-Tage-Puls für Sessions, Checkouts und bezahlte Bestellungen.`,
          funnelEyebrow: "Funnel",
          funnelTitle: "Verluststellen im Kaufpfad",
          funnelDescription:
            "Jede Stufe zeigt, wie viel Volumen im aktuellen Fenster in den nächsten Schritt übergeht.",
          funnelStages: {
            sessions: "Sessions",
            views: "Produktansichten",
            cart: "Warenkörbe",
            checkout: "Checkouts",
            paid: "Bezahlte Bestellungen",
          },
          funnelRates: {
            viewToCart: "View zu Cart",
            cartToCheckout: "Cart zu Checkout",
            checkoutToPaid: "Checkout zu bezahlt",
          },
          moduleEyebrow: "Sprünge",
          moduleTitle: "Module mit klarer nächster Frage",
          moduleDescription:
            "Jede Zeile fasst den wichtigsten Druckpunkt des Moduls zusammen, damit der nächste Klick bewusst ist.",
          pulseEyebrow: "Pulse",
          pulseTitle: "Order Mix und Betriebszustand",
          pulseDescription:
            "Bestellstruktur und Kernsignale nebeneinander, damit Volumen und Qualität zusammen gelesen werden.",
          actionPressure: "Druck",
          activityNow: "Live Feed",
          queueHint: "Direkter Einstieg",
        }
      : {
          deckEyebrow: "Signal deck",
          deckTitle: "The operating picture at a glance",
          deckDescription:
            "The overview keeps demand, checkout pressure, payment quality, and operational risk in one scan.",
          revenuePulse: "Revenue pace",
          demandPulse: "Demand flow",
          queuePressure: "Open signals",
          funnelRecovery: "Checkout to paid",
          paceEyebrow: "Pace",
          paceTitle: "Commerce flow",
          paceDescription: `${paceTrendDays}-day pulse across sessions, checkouts, and paid orders.`,
          funnelEyebrow: "Funnel",
          funnelTitle: "Where the buying journey leaks",
          funnelDescription:
            "Each stage shows how much volume survives into the next step inside the current window.",
          funnelStages: {
            sessions: "Sessions",
            views: "Product views",
            cart: "Add to cart",
            checkout: "Checkouts",
            paid: "Paid orders",
          },
          funnelRates: {
            viewToCart: "View to cart",
            cartToCheckout: "Cart to checkout",
            checkoutToPaid: "Checkout to paid",
          },
          moduleEyebrow: "Jumps",
          moduleTitle: "Modules with a clear next question",
          moduleDescription:
            "Each row reduces a module to the one pressure point that should determine the next click.",
          pulseEyebrow: "Pulse",
          pulseTitle: "Order mix and operating state",
          pulseDescription:
            "Order structure and core operating signals side by side so volume and quality read together.",
          actionPressure: "Pressure",
          activityNow: "Live feed",
          queueHint: "Direct jump",
        };

  const [
    failedWebhookCount,
    pendingReturnCount,
    variants,
    recentOrders,
    liveSnapshot,
    funnelSnapshot,
    funnelTrend,
    orderComparisons,
    customerRevenueMix,
    productPerformance,
    activityFeed,
    stockCoverageMap,
    financeData,
    vatData,
  ] = await Promise.all([
    getFailedWebhookCount(),
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
    getFunnelSnapshot(days),
    getFunnelTrend(paceTrendDays),
    getOrderComparisons(days),
    getCustomerRevenueMix(days),
    getProductPerformance(days),
    getActivityFeed(6),
    getStockCoverageMap(days),
    getFinancePageData(days),
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

  const trendBuckets = buildAdminTimeBuckets(days, locale).map((bucket) => ({
    label: bucket.label,
    start: bucket.start,
    endExclusive: bucket.endExclusive,
    value: 0,
  }));
  for (const order of paidOrders) {
    const bucket = trendBuckets.find(
      (entry) => order.createdAt >= entry.start && order.createdAt < entry.endExclusive,
    );
    if (!bucket) continue;
    bucket.value += order.amountTotal;
  }
  const salesTrend: AdminChartPoint[] = trendBuckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.value,
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
  const countFormatter = new Intl.NumberFormat(locale);
  const demandSeries = [
    {
      label: visualCopy.funnelStages.sessions,
      color: "#38bdf8",
      values: funnelTrend.map((point) => point.sessions),
    },
    {
      label: visualCopy.funnelStages.checkout,
      color: "#f59e0b",
      values: funnelTrend.map((point) => point.beginCheckout),
    },
    {
      label: visualCopy.funnelStages.paid,
      color: "#34d399",
      values: funnelTrend.map((point) => point.paidOrders),
    },
  ];
  const funnelStages = [
    {
      label: visualCopy.funnelStages.sessions,
      value: funnelSnapshot.sessions,
      helper: countFormatter.format(funnelSnapshot.sessions),
      color: "#38bdf8",
    },
    {
      label: visualCopy.funnelStages.views,
      value: funnelSnapshot.productViews,
      helper:
        language === "de"
          ? `${formatPercent(
              funnelSnapshot.sessions > 0
                ? funnelSnapshot.productViews / funnelSnapshot.sessions
                : 0,
            )} der Sessions`
          : `${formatPercent(
              funnelSnapshot.sessions > 0
                ? funnelSnapshot.productViews / funnelSnapshot.sessions
                : 0,
            )} of sessions`,
      color: "#818cf8",
    },
    {
      label: visualCopy.funnelStages.cart,
      value: funnelSnapshot.addToCart,
      helper: `${formatPercent(funnelSnapshot.viewToCartRate)} ${visualCopy.funnelRates.viewToCart}`,
      color: "#c084fc",
    },
    {
      label: visualCopy.funnelStages.checkout,
      value: funnelSnapshot.beginCheckout,
      helper: `${formatPercent(funnelSnapshot.cartToCheckoutRate)} ${visualCopy.funnelRates.cartToCheckout}`,
      color: "#f59e0b",
    },
    {
      label: visualCopy.funnelStages.paid,
      value: funnelSnapshot.paidOrders,
      helper: `${formatPercent(funnelSnapshot.checkoutToPaidRate)} ${visualCopy.funnelRates.checkoutToPaid}`,
      color: "#34d399",
    },
  ];

  const primaryActionCandidates: Array<AdminInboxAction | null> = [
    failedWebhookCount > 0
      ? {
          priority: "critical" as const,
          category: copy.actions.category.payments,
          score: failedWebhookCount,
          title: copy.actions.webhookFailures.title,
          detail: copy.actions.webhookFailures.detail(failedWebhookCount),
          href: "/admin/orders",
          hrefLabel: copy.actions.webhookFailures.hrefLabel,
        }
      : null,
    vatData.deadline.daysUntilDue <= 7 &&
    financeData.vatSummary.status !== "ready_for_handover"
      ? {
          priority: "high" as const,
          category: copy.actions.category.vat,
          score: Math.max(0, 8 - vatData.deadline.daysUntilDue),
          title: copy.actions.vatDeadline.title,
          detail: copy.actions.vatDeadline.detail(vatData.deadline.daysUntilDue),
          href: "/admin/vat",
          hrefLabel: copy.actions.vatDeadline.hrefLabel,
        }
      : null,
    financeData.currentExpenseSummary.missingDocumentCount > 0 ||
    financeData.currentExpenseSummary.missingVatCount > 0
      ? {
          priority: "high" as const,
          category: copy.actions.category.expenses,
          score:
            financeData.currentExpenseSummary.missingDocumentCount +
            financeData.currentExpenseSummary.missingVatCount,
          title: copy.actions.expensesIncomplete.title,
          detail: copy.actions.expensesIncomplete.detail(
            financeData.currentExpenseSummary.missingDocumentCount,
            financeData.currentExpenseSummary.missingVatCount,
          ),
          href: "/admin/expenses",
          hrefLabel: copy.actions.expensesIncomplete.hrefLabel,
        }
      : null,
    funnelSnapshot.beginCheckout >= 10 && funnelSnapshot.checkoutAbandonmentRate >= 0.6
      ? {
          priority: "high" as const,
          category: copy.actions.category.conversion,
          score: Math.round(funnelSnapshot.checkoutAbandonmentRate * 100),
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
          priority: "high" as const,
          category: copy.actions.category.inventory,
          score:
            lowStockVariants[0].available <= 0
              ? 100
              : Math.max(0, 14 - Math.round(lowStockVariants[0].coverDays ?? 0)),
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
          priority: "medium" as const,
          category: copy.actions.category.support,
          score: pendingReturnCount,
          title: copy.actions.pendingReturns.title,
          detail: copy.actions.pendingReturns.detail(pendingReturnCount),
          href: "/admin/returns",
          hrefLabel: copy.actions.pendingReturns.hrefLabel,
        }
      : null,
  ];

  const primaryAction = primaryActionCandidates
    .filter((item): item is AdminInboxAction => item !== null)
    .sort((left, right) => {
      const priorityDelta =
        ADMIN_INBOX_PRIORITY_WEIGHT[right.priority] - ADMIN_INBOX_PRIORITY_WEIGHT[left.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return right.score - left.score;
    })
    .slice(0, 5);

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
      accentClassName: "from-emerald-400/60 via-emerald-300/15 to-transparent",
      valueClassName: "text-emerald-100",
    },
    {
      href: "/admin/vat",
      title: copy.modules.vat.title,
      value: formatMoney(vatData.current?.estimatedLiabilityCents ?? 0, locale, dashboardCurrency),
      detail: copy.modules.vat.detail(
        formatVatStatus(vatData.current?.status ?? "estimated", language),
      ),
      accentClassName: "from-amber-400/60 via-amber-300/15 to-transparent",
      valueClassName: "text-amber-100",
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
      accentClassName: "from-fuchsia-400/60 via-fuchsia-300/15 to-transparent",
      valueClassName: "text-fuchsia-100",
    },
    {
      href: "/admin/analytics",
      title: copy.modules.analytics.title,
      value: formatPercent(funnelSnapshot.sessionToOrderRate),
      detail: copy.modules.analytics.detail(liveSnapshot.activeVisitorCount),
      accentClassName: "from-sky-400/60 via-sky-300/15 to-transparent",
      valueClassName: "text-sky-100",
    },
    {
      href: "/admin/orders",
      title: copy.modules.orders.title,
      value: String(orderComparisons.paidOrders.current),
      detail: copy.modules.orders.detail(
        formatDelta(orderComparisons.paidOrders.deltaRatio, copy.noBaseline),
      ),
      accentClassName: "from-violet-400/60 via-violet-300/15 to-transparent",
      valueClassName: "text-violet-100",
    },
    {
      href: "/admin/customers",
      title: copy.modules.customers.title,
      value: formatMoney(customerRevenueMix.returningRevenueCents, locale, dashboardCurrency),
      detail: copy.modules.customers.detail(customerRevenueMix.returningCustomerCount),
      accentClassName: "from-cyan-400/60 via-cyan-300/15 to-transparent",
      valueClassName: "text-cyan-100",
    },
    {
      href: "/admin/catalog",
      title: copy.modules.catalog.title,
      value: String(lowStockCount),
      detail: copy.modules.catalog.detail(outOfStockCount),
      accentClassName: "from-orange-400/60 via-orange-300/15 to-transparent",
      valueClassName: "text-orange-100",
    },
    {
      href: "/admin/alerts",
      title: copy.modules.alerts.title,
      value: String(primaryAction.length),
      detail: copy.modules.alerts.detail,
      accentClassName: "from-rose-400/60 via-rose-300/15 to-transparent",
      valueClassName: "text-rose-100",
    },
  ];
  const heroSignals = [
    {
      label: visualCopy.revenuePulse,
      value: formatMoney(orderComparisons.revenue.current, locale, dashboardCurrency),
      detail: formatDelta(orderComparisons.revenue.deltaRatio, copy.noBaseline),
      accentClassName: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    },
    {
      label: visualCopy.demandPulse,
      value: countFormatter.format(funnelSnapshot.sessions),
      detail: `${countFormatter.format(funnelSnapshot.beginCheckout)} ${visualCopy.funnelStages.checkout.toLowerCase()}`,
      accentClassName: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    },
    {
      label: visualCopy.queuePressure,
      value: countFormatter.format(primaryAction.length),
      detail:
        primaryAction[0]?.title ??
        (language === "de" ? "Keine unmittelbare Eskalation" : "No immediate escalation"),
      accentClassName: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    },
    {
      label: visualCopy.funnelRecovery,
      value: formatPercent(funnelSnapshot.checkoutToPaidRate),
      detail: `${countFormatter.format(funnelSnapshot.paidOrders)} ${visualCopy.funnelStages.paid.toLowerCase()}`,
      accentClassName: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#060b14] p-5 shadow-[0_36px_90px_rgba(0,0,0,0.38)] sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_32%),radial-gradient(circle_at_78%_14%,_rgba(251,191,36,0.16),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(244,63,94,0.14),_transparent_28%),linear-gradient(140deg,_rgba(7,12,22,0.98),_rgba(11,18,30,0.94)_48%,_rgba(15,21,35,0.92))]" />
        <div className="absolute inset-y-0 right-0 w-[46%] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] opacity-70" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_430px] xl:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-cyan-200/70">
              {copy.hero.eyebrow}
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {copy.hero.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              {visualCopy.deckDescription}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-100">
                {copy.hero.liveVisitors(liveSnapshot.activeVisitorCount)}
              </span>
              <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200">
                {copy.hero.keyActions(primaryAction.length)}
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                {copy.hero.vatBadge(
                  formatVatStatus(vatData.current?.status ?? "estimated", language),
                )}
              </span>
            </div>
            <div className="mt-6 max-w-xl">
              <AdminTimeRangeTabs
                pathname="/admin"
                activeDays={days}
                extraParams={{ lang: language }}
                className="sm:flex-nowrap"
              />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {heroSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {signal.label}
                    </p>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${signal.accentClassName}`}>
                      {visualCopy.deckEyebrow}
                    </span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-white">{signal.value}</div>
                  <div className="mt-2 text-sm text-slate-400">{signal.detail}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {visualCopy.deckEyebrow}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">{visualCopy.deckTitle}</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                {paceTrendDays}d
              </span>
            </div>
            <div className="mt-4">
              <SparklineChart
                data={salesTrend}
                className="border-white/10 bg-white/[0.03]"
                strokeClassName="stroke-emerald-300"
                fillClassName="fill-emerald-400/10"
              />
            </div>
            <div className="mt-4 space-y-3">
              {primaryAction.slice(0, 3).map((item) => (
                <Link
                  key={`${item.title}-${item.href}`}
                  href={item.href}
                  className="group block rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${ADMIN_INBOX_PRIORITY_CLASS[item.priority]}`}
                        >
                          {copy.panels.actions.priority[item.priority]}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                          {item.category}
                        </span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {visualCopy.actionPressure}
                      </div>
                      <div className="mt-2 text-xl font-semibold text-white">{item.score}</div>
                    </div>
                  </div>
                </Link>
              ))}
              {primaryAction.length === 0 ? <AdminEmptyState copy={copy.panels.actions.empty} /> : null}
            </div>
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
          eyebrow={visualCopy.paceEyebrow}
          title={visualCopy.paceTitle}
          description={visualCopy.paceDescription}
          className="bg-[linear-gradient(180deg,rgba(10,18,30,0.95),rgba(7,12,20,0.92))]"
        >
          <MultiSeriesTrendChart
            labels={funnelTrend.map((point) => point.label)}
            series={demandSeries}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <AdminCompactMetric
              label={copy.metrics.sessionCvr.label}
              value={formatPercent(funnelSnapshot.sessionToOrderRate)}
            />
            <AdminCompactMetric
              label={visualCopy.funnelRates.checkoutToPaid}
              value={formatPercent(funnelSnapshot.checkoutToPaidRate)}
            />
            <AdminCompactMetric
              label={copy.health.checkoutAbandon}
              value={formatPercent(funnelSnapshot.checkoutAbandonmentRate)}
            />
          </div>
        </AdminPanel>
        <AdminPanel
          eyebrow={visualCopy.funnelEyebrow}
          title={visualCopy.funnelTitle}
          description={visualCopy.funnelDescription}
          className="bg-[linear-gradient(180deg,rgba(20,14,10,0.95),rgba(10,9,12,0.92))]"
        >
          <FunnelChart stages={funnelStages} />
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel
          eyebrow={visualCopy.moduleEyebrow}
          title={visualCopy.moduleTitle}
          description={visualCopy.moduleDescription}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {moduleCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accentClassName} opacity-70`} />
                <div className="relative flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {card.title}
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {visualCopy.queueHint}
                    </span>
                  </div>
                  <div>
                    <div className={`text-2xl font-semibold ${card.valueClassName}`}>{card.value}</div>
                    <div className="mt-2 text-sm text-slate-300">{card.detail}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel
          eyebrow={visualCopy.pulseEyebrow}
          title={visualCopy.pulseTitle}
          description={visualCopy.pulseDescription}
        >
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <DonutChart
              data={statusMix}
              totalLabel={copy.statusMix.totalLabel}
              totalValue={String(recentOrders.length)}
            />
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
                  className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02] px-4 py-4"
                >
                  <div
                    className={`absolute inset-y-0 left-0 w-1 ${
                      item.priority === "critical"
                        ? "bg-rose-400"
                        : item.priority === "high"
                          ? "bg-amber-400"
                          : "bg-cyan-400"
                    }`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${ADMIN_INBOX_PRIORITY_CLASS[item.priority]}`}
                    >
                      {copy.panels.actions.priority[item.priority]}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {item.category}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                      <Link
                        href={item.href}
                        className="mt-3 inline-flex text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                      >
                        {item.hrefLabel}
                      </Link>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {visualCopy.actionPressure}
                      </div>
                      <div className="mt-2 text-xl font-semibold text-white">{item.score}</div>
                    </div>
                  </div>
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
    <div className="space-y-4">
      {items.map((entry, index) => (
        <div key={entry.id} className="relative pl-6">
          {index < items.length - 1 ? (
            <div className="absolute left-[9px] top-7 bottom-[-18px] w-px bg-gradient-to-b from-cyan-400/40 to-transparent" />
          ) : null}
          <div className="absolute left-0 top-2.5 h-[18px] w-[18px] rounded-full border border-cyan-400/20 bg-cyan-400/15 shadow-[0_0_18px_rgba(56,189,248,0.25)]" />
          <div className="rounded-[24px] border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{entry.title}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{entry.subtitle}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {new Date(entry.createdAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
