import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DonutChart,
  HorizontalBarsChart,
  SparklineChart,
  type AdminChartPoint,
} from "@/components/admin/AdminCharts";
import {
  getActiveSessionSnapshot,
  getActivityFeed,
  getCustomerRevenueMix,
  getFunnelSnapshot,
  getOrderComparisons,
  getProductPerformance,
  getStockCoverageMap,
} from "@/lib/adminInsights";
import AdminUsersClient from "./AdminUsersClient";
import AdminInventoryAlertsClient from "./AdminInventoryAlertsClient";

const USERS_PAGE_SIZE = 10;
const INVENTORY_PAGE_SIZE = 10;
const PAID_PAYMENT_STATUSES = new Set(["paid", "succeeded", "refunded", "partially_refunded"]);

const formatMoney = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

const formatDelta = (value: number | null) => {
  if (value === null) return "No baseline";
  const numeric = Math.round(value * 100);
  return `${numeric > 0 ? "+" : ""}${numeric}%`;
};

type ActivityItem = Awaited<ReturnType<typeof getActivityFeed>>[number];
type ProductItem = Awaited<ReturnType<typeof getProductPerformance>>[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string | string[];
    q?: string | string[];
    inv_page?: string | string[];
    inv_q?: string | string[];
  }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") notFound();

  const resolvedSearchParams = await searchParams;
  const rawQuery = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0] ?? ""
    : resolvedSearchParams?.q ?? "";
  const pageParamValue = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams?.page[0] ?? "1"
    : resolvedSearchParams?.page ?? "1";
  const rawInvQuery = Array.isArray(resolvedSearchParams?.inv_q)
    ? resolvedSearchParams?.inv_q[0] ?? ""
    : resolvedSearchParams?.inv_q ?? "";
  const invPageParamValue = Array.isArray(resolvedSearchParams?.inv_page)
    ? resolvedSearchParams?.inv_page[0] ?? "1"
    : resolvedSearchParams?.inv_page ?? "1";

  const requestedPage = Number(pageParamValue);
  const currentRequestedPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedInvPage = Number(invPageParamValue);
  const currentRequestedInvPage =
    Number.isFinite(requestedInvPage) && requestedInvPage > 0 ? requestedInvPage : 1;
  const normalizedQuery = rawQuery.trim();
  const normalizedInvQuery = rawInvQuery.trim();
  const normalizedRole = normalizedQuery.toUpperCase();
  const roleFilter =
    normalizedRole === "USER" ||
    normalizedRole === "ADMIN" ||
    normalizedRole === "STAFF"
      ? { role: normalizedRole as "USER" | "ADMIN" | "STAFF" }
      : null;
  const userWhere = normalizedQuery
    ? {
        OR: [
          { email: { contains: normalizedQuery, mode: "insensitive" as const } },
          { name: { contains: normalizedQuery, mode: "insensitive" as const } },
          ...(roleFilter ? [roleFilter] : []),
        ],
      }
    : undefined;

  const now = new Date();
  const trendWindowStart = new Date(now);
  trendWindowStart.setDate(trendWindowStart.getDate() - 13);
  trendWindowStart.setHours(0, 0, 0, 0);
  const salesWindowStart = new Date(now);
  salesWindowStart.setDate(salesWindowStart.getDate() - 29);
  salesWindowStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    users,
    variants,
    backInStockRequests,
    pendingReturnCount,
    pendingReturnRequests,
    failedWebhookCount,
    failedWebhookEvents,
    recentOrders,
    liveSnapshot,
    funnelSnapshot,
    orderComparisons,
    customerRevenueMix,
    productPerformance,
    activityFeed,
    stockCoverageMap,
  ] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: "desc" },
      take: USERS_PAGE_SIZE,
      skip: (currentRequestedPage - 1) * USERS_PAGE_SIZE,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
    prisma.variant.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        inventory: true,
        product: { select: { id: true, title: true, status: true } },
      },
      where: { product: { status: "ACTIVE" } },
    }),
    prisma.backInStockRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.returnRequest.count({ where: { status: "PENDING" } }),
    prisma.returnRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        order: { select: { orderNumber: true, amountTotal: true, currency: true } },
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.processedWebhookEvent.count({ where: { status: "failed" } }),
    prisma.processedWebhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: salesWindowStart } },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        amountTotal: true,
        amountRefunded: true,
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
    getActivityFeed(12),
    getStockCoverageMap(30),
  ]);

  const totalUserPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const currentUserPage = Math.min(currentRequestedPage, totalUserPages);
  const usersPageRows =
    currentUserPage === currentRequestedPage
      ? users
      : await prisma.user.findMany({
          where: userWhere,
          orderBy: { createdAt: "desc" },
          take: USERS_PAGE_SIZE,
          skip: (currentUserPage - 1) * USERS_PAGE_SIZE,
          select: { id: true, email: true, name: true, role: true, createdAt: true },
        });

  const lowStockVariants = variants
    .map((variant) => {
      const onHand = variant.inventory?.quantityOnHand ?? 0;
      const reserved = variant.inventory?.reserved ?? 0;
      const available = Math.max(onHand - reserved, 0);
      const velocity = stockCoverageMap.get(variant.id);
      const coverDays =
        velocity && velocity.dailyVelocity > 0 ? available / velocity.dailyVelocity : null;
      return {
        id: variant.id,
        title: variant.title,
        productId: variant.product.id,
        productTitle: variant.product.title,
        available,
        onHand,
        reserved,
        threshold: variant.lowStockThreshold,
        coverDays,
        updatedAt: variant.updatedAt,
      };
    })
    .filter((variant) => variant.available <= variant.threshold)
    .filter((variant) => {
      if (!normalizedInvQuery) return true;
      const query = normalizedInvQuery.toLowerCase();
      return (
        variant.productTitle.toLowerCase().includes(query) ||
        variant.title.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const leftCover = typeof a.coverDays === "number" ? a.coverDays : Number.POSITIVE_INFINITY;
      const rightCover = typeof b.coverDays === "number" ? b.coverDays : Number.POSITIVE_INFINITY;
      if (leftCover !== rightCover) return leftCover - rightCover;
      return a.available - b.available;
    });

  const lowStockCount = lowStockVariants.length;
  const outOfStockCount = lowStockVariants.filter((variant) => variant.available === 0).length;
  const totalInvPages = Math.max(1, Math.ceil(lowStockVariants.length / INVENTORY_PAGE_SIZE));
  const currentInvPage = Math.min(currentRequestedInvPage, totalInvPages);
  const lowStockPage = lowStockVariants.slice(
    (currentInvPage - 1) * INVENTORY_PAGE_SIZE,
    currentInvPage * INVENTORY_PAGE_SIZE,
  );

  const backInStockSummary = new Map<
    string,
    {
      productId: string;
      productTitle: string | null;
      total: number;
      pending: number;
      latest: Date;
      users: Map<string, { name: string | null; email: string | null }>;
    }
  >();

  for (const request of backInStockRequests) {
    const key = request.productId;
    const entry = backInStockSummary.get(key) ?? {
      productId: request.productId,
      productTitle: request.productTitle,
      total: 0,
      pending: 0,
      latest: request.createdAt,
      users: new Map<string, { name: string | null; email: string | null }>(),
    };
    entry.total += 1;
    if (!request.notifiedAt) entry.pending += 1;
    if (request.createdAt > entry.latest) entry.latest = request.createdAt;
    if (request.userId && request.user) {
      entry.users.set(request.user.id, {
        name: request.user.name,
        email: request.user.email,
      });
    }
    backInStockSummary.set(key, entry);
  }

  const backInStockRows = Array.from(backInStockSummary.values())
    .sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return b.latest.getTime() - a.latest.getTime();
    })
    .slice(0, 25);

  const dashboardCurrency = recentOrders[0]?.currency ?? orderComparisons.currency ?? "EUR";
  const paidOrders = recentOrders.filter((order) =>
    PAID_PAYMENT_STATUSES.has(order.paymentStatus.trim().toLowerCase()),
  );
  const refundedOrderCount = recentOrders.filter(
    (order) =>
      order.amountRefunded > 0 ||
      order.paymentStatus.trim().toLowerCase() === "refunded" ||
      order.status.trim().toLowerCase() === "refunded",
  ).length;

  const trendDays = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(trendWindowStart);
    day.setDate(trendWindowStart.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    return { key, label, value: 0, orders: 0 };
  });
  const trendMap = new Map(trendDays.map((day) => [day.key, day]));
  for (const order of paidOrders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const day = trendMap.get(key);
    if (!day) continue;
    day.value += order.amountTotal;
    day.orders += 1;
  }
  const salesTrend: AdminChartPoint[] = trendDays.map((day) => ({
    label: day.label,
    value: day.value,
    secondaryValue: day.orders,
  }));

  const statusMix = [
    { label: "Paid", value: paidOrders.length, colorClassName: "#22d3ee" },
    { label: "Refunded", value: refundedOrderCount, colorClassName: "#f59e0b" },
    {
      label: "Pending",
      value: recentOrders.filter(
        (order) =>
          !PAID_PAYMENT_STATUSES.has(order.paymentStatus.trim().toLowerCase()) &&
          order.paymentStatus.trim().toLowerCase() !== "refunded",
      ).length,
      colorClassName: "#818cf8",
    },
    {
      label: "Canceled",
      value: recentOrders.filter((order) =>
        ["canceled", "cancelled", "failed"].includes(order.status.trim().toLowerCase()),
      ).length,
      colorClassName: "#ef4444",
    },
  ];

  const alertBars: AdminChartPoint[] = [
    { label: "Failed webhooks", value: failedWebhookCount },
    { label: "Pending returns", value: pendingReturnCount },
    { label: "Low stock", value: lowStockCount },
    { label: "Out of stock", value: outOfStockCount },
    { label: "Back in stock demand", value: backInStockRows.reduce((sum, row) => sum + row.pending, 0) },
  ];

  const activePagesBars: AdminChartPoint[] = liveSnapshot.topPages.map((page) => ({
    label: page.path,
    value: page.count,
  }));
  const sourceBars: AdminChartPoint[] = liveSnapshot.trafficSources.map((source) => ({
    label: source.label,
    value: source.count,
  }));

  const topProducts = [...productPerformance]
    .sort((left, right) => right.revenueCents - left.revenueCents)
    .slice(0, 5);
  const weakProducts = [...productPerformance]
    .filter((item) => item.views >= 5)
    .sort((left, right) => {
      if (right.views !== left.views) return right.views - left.views;
      return left.conversionRate - right.conversionRate;
    })
    .slice(0, 5);
  const primaryStockRisk = lowStockVariants[0] ?? null;
  const actionAlerts = [
    failedWebhookCount > 0
      ? {
          title: "Stripe webhook failures need review",
          subtitle: `${failedWebhookCount} failed events can block payment and fulfillment sync.`,
          badge: "Critical",
          badgeClassName: "border-rose-400/20 bg-rose-400/10 text-rose-200",
          href: "/admin/orders",
          hrefLabel: "Open orders",
        }
      : null,
    funnelSnapshot.beginCheckout >= 10 && funnelSnapshot.checkoutAbandonmentRate >= 0.6
      ? {
          title: "Checkout abandonment is elevated",
          subtitle: `${Math.round(funnelSnapshot.checkoutAbandonmentRate * 100)}% of started checkouts are not converting.`,
          badge: "Revenue risk",
          badgeClassName: "border-amber-400/20 bg-amber-400/10 text-amber-200",
          href: "/admin/analytics",
          hrefLabel: "Inspect funnel",
        }
      : null,
    typeof orderComparisons.revenue.deltaRatio === "number" && orderComparisons.revenue.deltaRatio <= -0.15
      ? {
          title: "Revenue pace is below the previous period",
          subtitle: `${formatDelta(orderComparisons.revenue.deltaRatio)} vs prior 30-day window.`,
          badge: "Trend drop",
          badgeClassName: "border-amber-400/20 bg-amber-400/10 text-amber-200",
          href: "/admin/analytics",
          hrefLabel: "Open analytics",
        }
      : null,
    primaryStockRisk &&
    (primaryStockRisk.available === 0 ||
      (typeof primaryStockRisk.coverDays === "number" && primaryStockRisk.coverDays < 7))
      ? {
          title: `${primaryStockRisk.productTitle} needs replenishment`,
          subtitle:
            primaryStockRisk.available === 0
              ? `${primaryStockRisk.title} is already out of stock.`
              : `${Math.round(primaryStockRisk.coverDays ?? 0)} days of stock cover left on ${primaryStockRisk.title}.`,
          badge: "Stock risk",
          badgeClassName: "border-rose-400/20 bg-rose-400/10 text-rose-200",
          href: "/admin/catalog",
          hrefLabel: "Open catalog",
        }
      : null,
    pendingReturnCount > 0
      ? {
          title: "Pending return decisions are waiting",
          subtitle: `${pendingReturnCount} requests still need resolution or refund routing.`,
          badge: "Support",
          badgeClassName: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
          href: "/admin/returns",
          hrefLabel: "Open returns",
        }
      : null,
    weakProducts[0]
      ? {
          title: `${weakProducts[0].productTitle} is attracting attention but under-converting`,
          subtitle: `${weakProducts[0].views} views, ${Math.round(
            weakProducts[0].conversionRate * 100,
          )}% CVR and ${weakProducts[0].addToCart} add-to-cart events in the last 30 days.`,
          badge: "Merch",
          badgeClassName: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
          href: "/admin/catalog",
          hrefLabel: "Review product",
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    subtitle: string;
    badge: string;
    badgeClassName: string;
    href: string;
    hrefLabel: string;
  }>;

  const quickLinks = [
    { href: "/admin/catalog", label: "Catalog", description: "Products, variants and merch data." },
    { href: "/admin/orders", label: "Orders", description: "Refunds, tracking and webhook recovery." },
    { href: "/admin/customers", label: "Customers", description: "CRM segmentation and revenue mix." },
    { href: "/admin/users", label: "Users", description: "Profiles, notes, roles and audit history." },
    { href: "/admin/analytics", label: "Analytics", description: "Live sessions, funnel and payment mix." },
    { href: "/admin/suppliers", label: "Suppliers", description: "Lead times, contacts and catalog exposure." },
  ];

  return (
    <div className="admin-legacy-page space-y-6">
      <section className="admin-reveal relative overflow-hidden rounded-[32px] border border-white/10 bg-[#060b14] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.2),_transparent_28%),linear-gradient(135deg,_rgba(8,15,26,0.98),_rgba(12,22,38,0.92))]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-200/65">Admin / Dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Live operations, conversion pressure and action queues
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Core control room for live traffic, revenue movement, abandonment, stock risk and the next operational action.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-semibold text-slate-100">
                {liveSnapshot.activeVisitorCount} live visitors
              </span>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 font-semibold text-cyan-200">
                {funnelSnapshot.beginCheckout} checkout starts
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-200">
                {lowStockCount} stock risks
              </span>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 font-semibold text-amber-200">
                {pendingReturnCount} pending returns
              </span>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            ADMIN only
          </div>
        </div>
        <div className="relative mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <MetricCard label="Live visitors" value={String(liveSnapshot.activeVisitorCount)} footnote="active now" />
          <MetricCard label="30d revenue" value={formatMoney(orderComparisons.revenue.current, dashboardCurrency)} detail={formatDelta(orderComparisons.revenue.deltaRatio)} detailBadgeClassName="orders-kpi-badge-emerald" footnote="vs previous 30d" tone="emerald" />
          <MetricCard label="Paid orders" value={String(orderComparisons.paidOrders.current)} detail={formatDelta(orderComparisons.paidOrders.deltaRatio)} detailBadgeClassName="orders-kpi-badge-violet" footnote="confirmed orders" tone="violet" />
          <MetricCard label="AOV" value={formatMoney(orderComparisons.aov.current, dashboardCurrency)} detail={formatDelta(orderComparisons.aov.deltaRatio)} detailBadgeClassName="orders-kpi-badge-violet" footnote="average order value" tone="violet" />
          <MetricCard label="Session CVR" value={`${Math.round(funnelSnapshot.sessionToOrderRate * 100)}%`} footnote="session to paid" />
          <MetricCard label="Checkout abandon" value={`${Math.round(funnelSnapshot.checkoutAbandonmentRate * 100)}%`} footnote="checkout fallout" tone="amber" />
          <MetricCard label="Low stock" value={String(lowStockCount)} footnote={`${outOfStockCount} out of stock`} tone="amber" />
          <MetricCard label="Pending returns" value={String(pendingReturnCount)} footnote="awaiting action" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel eyebrow="Sales" title="Paid revenue trend" description="Last 14 days, based on paid orders only.">
          <SparklineChart data={salesTrend} />
        </Panel>
        <Panel eyebrow="Mix" title="Order outcome split" description="30-day operational status mix for payments and closures.">
          <DonutChart data={statusMix} totalLabel="Orders" totalValue={String(recentOrders.length)} />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Panel eyebrow="Live" title="Active pages now" description="Rolling 5-minute session heartbeat from the storefront.">
          <HorizontalBarsChart data={activePagesBars} colorClassName="bg-cyan-400" />
        </Panel>
        <Panel eyebrow="Traffic" title="Live traffic sources" description="Current active-session source mix.">
          <HorizontalBarsChart data={sourceBars} colorClassName="bg-emerald-400" />
        </Panel>
        <Panel eyebrow="Funnel" title="Conversion health" description="Top-of-funnel and abandonment metrics across the last 30 days.">
          <div className="grid gap-3">
            <MiniMetric label="Sessions" value={String(funnelSnapshot.sessions)} />
            <MiniMetric label="Add to cart" value={String(funnelSnapshot.addToCart)} />
            <MiniMetric label="Begin checkout" value={String(funnelSnapshot.beginCheckout)} />
            <MiniMetric label="Paid orders" value={String(funnelSnapshot.paidOrders)} />
            <MiniMetric label="Cart abandon" value={`${Math.round(funnelSnapshot.cartAbandonmentRate * 100)}%`} />
            <MiniMetric label="Checkout abandon" value={`${Math.round(funnelSnapshot.checkoutAbandonmentRate * 100)}%`} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel eyebrow="Products" title="Revenue leaders" description="Products with the strongest 30-day revenue signal.">
          <ProductList rows={topProducts} valueFormatter={(row) => formatMoney(row.revenueCents, dashboardCurrency)} detailFormatter={(row) => `${row.views} views · ${Math.round(row.conversionRate * 100)}% CVR · ${formatMoney(row.marginCents, dashboardCurrency)} margin`} emptyCopy="No product performance data yet." />
        </Panel>
        <Panel eyebrow="Products" title="High views, weak conversion" description="Products getting attention but under-converting.">
          <ProductList rows={weakProducts} valueFormatter={(row) => `${row.views} views`} detailFormatter={(row) => `${Math.round(row.conversionRate * 100)}% CVR · ${row.addToCart} carts · ${row.purchases} units`} emptyCopy="No weak-conversion products in the current window." />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr_0.85fr]">
        <Panel eyebrow="Actions" title="Action center" description="Priority tasks generated from live revenue, funnel, stock and support pressure.">
          <ActionAlertList items={actionAlerts} />
        </Panel>
        <Panel eyebrow="Alerts" title="Operational pressure" description="Failure and queue counts that usually need admin action first.">
          <HorizontalBarsChart data={alertBars} colorClassName="bg-cyan-400" />
        </Panel>
        <Panel eyebrow="CRM" title="Customer revenue mix" description="How much 30-day revenue comes from newly acquired versus returning customers.">
          <div className="space-y-3">
            <DeltaRow label="New customer revenue" value={formatMoney(customerRevenueMix.newRevenueCents, dashboardCurrency)} detail={`${customerRevenueMix.newCustomerCount} new customers`} />
            <DeltaRow label="Returning revenue" value={formatMoney(customerRevenueMix.returningRevenueCents, dashboardCurrency)} detail={`${customerRevenueMix.returningCustomerCount} returning customers`} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel eyebrow="Activity" title="Unified activity feed" description="Latest admin actions, paid orders, return requests and webhook failures.">
          <ActivityFeed items={activityFeed} />
        </Panel>
        <Panel eyebrow="Routes" title="Primary workspaces" description="Direct entry points into the most active admin surfaces.">
          <div className="grid gap-3">
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="admin-lift rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-cyan-400/20 hover:bg-cyan-400/5">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="mt-1 text-xs text-slate-400">{item.description}</div>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel eyebrow="Alerts" title="Failed Stripe webhooks" description="Most recent webhook failures that may need reprocessing from the orders screen.">
          <div className="space-y-3">
            {failedWebhookEvents.length === 0 ? <EmptyPanel copy="No failed webhook events." /> : failedWebhookEvents.map((event) => (
              <AlertRow key={event.id} title={event.type} subtitle={event.eventId} badge="Failed" badgeClassName="border-amber-300/20 bg-amber-300/10 text-amber-200" />
            ))}
          </div>
        </Panel>
        <Panel eyebrow="Alerts" title="Pending return requests" description="Latest unresolved return requests that still need an admin decision.">
          <div className="space-y-3">
            {pendingReturnRequests.length === 0 ? <EmptyPanel copy="No pending returns." /> : pendingReturnRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">Order #{request.order.orderNumber}</p>
                    <p className="truncate text-xs text-slate-500">{request.user.email ?? request.user.name ?? "Unknown customer"}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                    {formatMoney(request.order.amountTotal, request.order.currency)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-400">{request.reason}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel eyebrow="Access" title="User administration" description="Role control and direct profile access in the live admin workspace.">
        <AdminUsersClient initialUsers={usersPageRows.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))} initialQuery={normalizedQuery} totalCount={totalUsers} currentPage={currentUserPage} totalPages={totalUserPages} pageSize={USERS_PAGE_SIZE} />
      </Panel>

      <Panel eyebrow="Inventory" title="Low-stock watchlist" description="Active variants at or below threshold, sorted by stock cover days.">
        <AdminInventoryAlertsClient variants={lowStockPage.map((variant) => ({ ...variant, updatedAt: variant.updatedAt.toISOString() }))} totalCount={lowStockCount} outOfStockCount={outOfStockCount} currentPage={currentInvPage} totalPages={totalInvPages} pageSize={INVENTORY_PAGE_SIZE} initialQuery={normalizedInvQuery} />
      </Panel>

      <Panel eyebrow="CRM" title="Back-in-stock demand" description="Recent demand, prioritised by pending requests and logged-in user interest.">
        {backInStockRows.length === 0 ? (
          <EmptyPanel copy="No back-in-stock requests yet." />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#090d12]">
            <div className="grid grid-cols-1 gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:grid-cols-[2fr_120px_120px_2fr]">
              <div>Product</div>
              <div>Total</div>
              <div>Pending</div>
              <div>Logged-in users</div>
            </div>
            <div className="divide-y divide-white/5">
              {backInStockRows.map((row) => (
                <div key={row.productId} className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-slate-300 sm:grid-cols-[2fr_120px_120px_2fr]">
                  <div>
                    <div className="font-semibold text-slate-100">{row.productTitle || row.productId}</div>
                    <div className="text-xs text-slate-500">{row.productId}</div>
                  </div>
                  <div className="tabular-nums">{row.total}</div>
                  <div className="tabular-nums font-semibold text-amber-300">{row.pending}</div>
                  <div className="text-xs text-slate-500">
                    {Array.from(row.users.values()).map((user) => user.name || user.email || "Unknown").join(", ") || "None"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  footnote,
  detailBadgeClassName = "orders-kpi-badge-slate",
  tone = "slate",
}: {
  label: string;
  value: string;
  detail?: string;
  footnote?: string;
  detailBadgeClassName?: string;
  tone?: "slate" | "emerald" | "violet" | "amber";
}) {
  const toneClassName =
    tone === "emerald"
      ? "orders-kpi-card-emerald"
      : tone === "violet"
        ? "orders-kpi-card-violet"
        : tone === "amber"
          ? "orders-kpi-card-amber"
          : "orders-kpi-card-slate";
  return (
    <div className={`orders-kpi-card admin-lift rounded-[22px] border border-white/10 bg-white/[0.04] p-5 ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[14ch] text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
        {detail ? (
          <span className={`orders-kpi-badge rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${detailBadgeClassName}`}>
            {detail}
          </span>
        ) : null}
      </div>
      <p className="mt-6 text-[clamp(2rem,2.2vw,2.7rem)] font-semibold leading-none tracking-tight text-white">{value}</p>
      {footnote ? <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{footnote}</p> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function DeltaRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{label}</div>
          <div className="text-xs text-slate-500">{detail}</div>
        </div>
        <div className="text-sm font-semibold text-cyan-300">{value}</div>
      </div>
    </div>
  );
}

function ProductList({
  rows,
  valueFormatter,
  detailFormatter,
  emptyCopy,
}: {
  rows: ProductItem[];
  valueFormatter: (row: ProductItem) => string;
  detailFormatter: (row: ProductItem) => string;
  emptyCopy: string;
}) {
  if (rows.length === 0) return <EmptyPanel copy={emptyCopy} />;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.productId} className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-100">{row.productTitle}</div>
              <div className="text-xs text-slate-500">{detailFormatter(row)}</div>
            </div>
            <div className="shrink-0 text-sm font-semibold text-cyan-300">{valueFormatter(row)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <EmptyPanel copy="No activity yet." />;
  return (
    <div className="space-y-3">
      {items.map((entry) => (
        <div key={entry.id} className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{entry.title}</p>
              <p className="truncate text-xs text-slate-500">{entry.subtitle}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              {new Date(entry.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionAlertList({
  items,
}: {
  items: Array<{
    title: string;
    subtitle: string;
    badge: string;
    badgeClassName: string;
    href: string;
    hrefLabel: string;
  }>;
}) {
  if (items.length === 0) {
    return <EmptyPanel copy="No urgent actions generated from the current live signals." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={`${item.title}-${item.href}`} className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${item.badgeClassName}`}>{item.badge}</span>
          </div>
          <Link href={item.href} className="mt-3 inline-flex text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">
            {item.hrefLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}

function EmptyPanel({ copy }: { copy: string }) {
  return <div className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">{copy}</div>;
}

function AlertRow({
  title,
  subtitle,
  badge,
  badgeClassName,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeClassName: string;
}) {
  return (
    <div className="orders-summary-tile rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClassName}`}>{badge}</span>
      </div>
    </div>
  );
}
