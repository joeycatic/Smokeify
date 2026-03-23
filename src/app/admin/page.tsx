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
import AdminUsersClient from "./AdminUsersClient";
import AdminInventoryAlertsClient from "./AdminInventoryAlertsClient";

const USERS_PAGE_SIZE = 10;
const INVENTORY_PAGE_SIZE = 10;
const PAID_PAYMENT_STATUSES = new Set(["paid", "succeeded"]);

const formatMoney = (amountCents: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

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
  ] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: "desc" },
      take: USERS_PAGE_SIZE,
      skip: (currentRequestedPage - 1) * USERS_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
        id: true,
        createdAt: true,
        amountTotal: true,
        amountRefunded: true,
        currency: true,
        paymentStatus: true,
        status: true,
      },
    }),
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
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        });

  const lowStockVariants = variants
    .map((variant) => {
      const onHand = variant.inventory?.quantityOnHand ?? 0;
      const reserved = variant.inventory?.reserved ?? 0;
      const available = Math.max(onHand - reserved, 0);
      return {
        id: variant.id,
        title: variant.title,
        productId: variant.product.id,
        productTitle: variant.product.title,
        available,
        onHand,
        reserved,
        threshold: variant.lowStockThreshold,
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
    .sort((a, b) => a.available - b.available);

  const lowStockCount = lowStockVariants.length;
  const outOfStockCount = lowStockVariants.filter((variant) => variant.available === 0).length;
  const totalInvPages = Math.max(1, Math.ceil(lowStockVariants.length / INVENTORY_PAGE_SIZE));
  const currentInvPage = Math.min(currentRequestedInvPage, totalInvPages);
  const lowStockPage = lowStockVariants.slice(
    (currentInvPage - 1) * INVENTORY_PAGE_SIZE,
    currentInvPage * INVENTORY_PAGE_SIZE
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

  const dashboardCurrency = recentOrders[0]?.currency ?? "EUR";
  const paidOrders = recentOrders.filter((order) =>
    PAID_PAYMENT_STATUSES.has(order.paymentStatus.trim().toLowerCase())
  );
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.amountTotal, 0);
  const refundedOrderCount = recentOrders.filter(
    (order) =>
      order.amountRefunded > 0 ||
      order.paymentStatus.trim().toLowerCase() === "refunded" ||
      order.status.trim().toLowerCase() === "refunded"
  ).length;
  const aov = paidOrders.length > 0 ? Math.round(paidRevenue / paidOrders.length) : 0;
  const refundRate = paidOrders.length > 0 ? refundedOrderCount / paidOrders.length : 0;

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
    {
      label: "Paid",
      value: paidOrders.length,
      color: "#22d3ee",
    },
    {
      label: "Refunded",
      value: refundedOrderCount,
      color: "#f59e0b",
    },
    {
      label: "Pending",
      value: recentOrders.filter(
        (order) =>
          !PAID_PAYMENT_STATUSES.has(order.paymentStatus.trim().toLowerCase()) &&
          order.paymentStatus.trim().toLowerCase() !== "refunded"
      ).length,
      color: "#818cf8",
    },
    {
      label: "Canceled",
      value: recentOrders.filter((order) =>
        ["canceled", "cancelled", "failed"].includes(order.status.trim().toLowerCase())
      ).length,
      color: "#ef4444",
    },
  ];

  const alertBars: AdminChartPoint[] = [
    { label: "Failed webhooks", value: failedWebhookCount },
    { label: "Pending returns", value: pendingReturnCount },
    { label: "Low stock", value: lowStockCount },
    { label: "Out of stock", value: outOfStockCount },
    {
      label: "Back in stock demand",
      value: backInStockRows.reduce((sum, row) => sum + row.pending, 0),
    },
  ];

  const quickLinks = [
    {
      href: "/admin/catalog",
      label: "Catalog",
      description: "Products, media, variants, associations, and merch data.",
    },
    {
      href: "/admin/orders",
      label: "Orders",
      description: "Refunds, tracking, communication, and webhook recovery.",
    },
    {
      href: "/admin/customers",
      label: "Customers",
      description: "CRM segmentation, guest vs registered, and revenue concentration.",
    },
    {
      href: "/admin/users",
      label: "Users",
      description: "Profiles, addresses, notes, role changes, and audit history.",
    },
    {
      href: "/admin/suppliers",
      label: "Suppliers",
      description: "Lead times, supplier contacts, and catalog exposure.",
    },
    {
      href: "/admin/analytics",
      label: "Analytics",
      description: "Revenue, inventory pressure, AI quality, and customer mix.",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="admin-reveal overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Live operations, access control, and sales pressure
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Admin-only control room for revenue tracking, order risk, CRM, and
              catalog operations across the live commerce system.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            ADMIN only
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="30d revenue" value={formatMoney(paidRevenue, dashboardCurrency)} />
          <MetricCard label="Paid orders" value={String(paidOrders.length)} />
          <MetricCard label="AOV" value={formatMoney(aov, dashboardCurrency)} />
          <MetricCard label="Refund rate" value={`${Math.round(refundRate * 100)}%`} />
          <MetricCard label="Low stock" value={String(lowStockCount)} />
          <MetricCard label="Pending returns" value={String(pendingReturnCount)} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel
          eyebrow="Sales"
          title="Paid revenue trend"
          description="Last 14 days, based on paid orders only."
          className="admin-reveal admin-reveal-delay-1"
        >
          <SparklineChart data={salesTrend} />
        </Panel>

        <Panel
          eyebrow="Mix"
          title="Order outcome split"
          description="30-day operational status mix for payments and closures."
          className="admin-reveal admin-reveal-delay-2"
        >
          <DonutChart
            data={statusMix.map((segment) => ({
              label: segment.label,
              value: segment.value,
              colorClassName: segment.color,
            }))}
            totalLabel="Orders"
            totalValue={String(recentOrders.length)}
          />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          eyebrow="Alerts"
          title="Operational pressure"
          description="Failure and queue counts that usually need admin action first."
          className="admin-reveal admin-reveal-delay-1"
        >
          <HorizontalBarsChart
            data={alertBars}
            colorClassName="bg-cyan-400"
          />
        </Panel>

        <Panel
          eyebrow="Routes"
          title="Primary workspaces"
          description="Direct entry points into the most active admin surfaces."
          className="admin-reveal admin-reveal-delay-2"
        >
          <div className="grid gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="admin-lift rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-cyan-400/20 hover:bg-cyan-400/5"
              >
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="mt-1 text-xs text-slate-400">{item.description}</div>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          eyebrow="Alerts"
          title="Failed Stripe webhooks"
          description="Most recent webhook failures that may need reprocessing from the orders screen."
          className="admin-reveal admin-reveal-delay-1"
        >
          <div className="space-y-3">
            {failedWebhookEvents.length === 0 ? (
              <EmptyPanel copy="No failed webhook events." />
            ) : (
              failedWebhookEvents.map((event) => (
                <AlertRow
                  key={event.id}
                  title={event.type}
                  subtitle={event.eventId}
                  badge="Failed"
                  badgeClassName="border-amber-300/20 bg-amber-300/10 text-amber-200"
                />
              ))
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Alerts"
          title="Pending return requests"
          description="Latest unresolved return requests that still need an admin decision."
          className="admin-reveal admin-reveal-delay-2"
        >
          <div className="space-y-3">
            {pendingReturnRequests.length === 0 ? (
              <EmptyPanel copy="No pending returns." />
            ) : (
              pendingReturnRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        Order #{request.order.orderNumber}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {request.user.email ?? request.user.name ?? "Unknown customer"}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                      {formatMoney(request.order.amountTotal, request.order.currency)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-400">{request.reason}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel
        eyebrow="Access"
        title="User administration"
        description="Role control and direct profile access in the live admin workspace."
        className="admin-reveal"
      >
        <AdminUsersClient
          initialUsers={usersPageRows.map((user) => ({
            ...user,
            createdAt: user.createdAt.toISOString(),
          }))}
          initialQuery={normalizedQuery}
          totalCount={totalUsers}
          currentPage={currentUserPage}
          totalPages={totalUserPages}
          pageSize={USERS_PAGE_SIZE}
        />
      </Panel>

      <Panel
        eyebrow="Inventory"
        title="Low-stock watchlist"
        description="Active variants at or below threshold, with direct links into product editing."
        className="admin-reveal admin-reveal-delay-1"
      >
        <AdminInventoryAlertsClient
          variants={lowStockPage.map((variant) => ({
            ...variant,
            updatedAt: variant.updatedAt.toISOString(),
          }))}
          totalCount={lowStockCount}
          outOfStockCount={outOfStockCount}
          currentPage={currentInvPage}
          totalPages={totalInvPages}
          pageSize={INVENTORY_PAGE_SIZE}
          initialQuery={normalizedInvQuery}
        />
      </Panel>

      <Panel
        eyebrow="CRM"
        title="Back-in-stock demand"
        description="Recent demand, prioritised by pending requests and logged-in user interest."
        className="admin-reveal admin-reveal-delay-2"
      >
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
              {backInStockRows.map((row) => {
                const usersList = Array.from(row.users.values())
                  .map((user) => user.name || user.email || "Unknown")
                  .join(", ");

                return (
                  <div
                    key={row.productId}
                    className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-slate-300 sm:grid-cols-[2fr_120px_120px_2fr]"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">
                        {row.productTitle || row.productId}
                      </div>
                      <div className="text-xs text-slate-500">{row.productId}</div>
                    </div>
                    <div className="tabular-nums">{row.total}</div>
                    <div className="tabular-nums font-semibold text-amber-300">{row.pending}</div>
                    <div className="text-xs text-slate-500">{usersList || "None"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${className}`}
    >
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-lift rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyPanel({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
      {copy}
    </div>
  );
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClassName}`}>
          {badge}
        </span>
      </div>
    </div>
  );
}
