import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";
import AdminInventoryAlertsClient from "./AdminInventoryAlertsClient";
import Link from "next/link";

const USERS_PAGE_SIZE = 10;
const INVENTORY_PAGE_SIZE = 10;

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
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

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
  const pageParam = Number(pageParamValue);
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const invPageParam = Number(invPageParamValue);
  const requestedInvPage =
    Number.isFinite(invPageParam) && invPageParam > 0 ? invPageParam : 1;
  const normalizedQuery = rawQuery.trim();
  const normalizedInvQuery = rawInvQuery.trim();
  const normalizedRole = normalizedQuery.toUpperCase();
  const roleFilter =
    normalizedRole === "USER" ||
    normalizedRole === "ADMIN" ||
    normalizedRole === "STAFF"
      ? { role: normalizedRole as "USER" | "ADMIN" | "STAFF" }
      : null;
  const where = normalizedQuery
    ? {
        OR: [
          { email: { contains: normalizedQuery, mode: "insensitive" as const } },
          { name: { contains: normalizedQuery, mode: "insensitive" as const } },
          ...(roleFilter ? [roleFilter] : []),
        ],
      }
    : undefined;

  const totalUsers = await prisma.user.count({ where });
  const totalUserPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const currentUserPage = Math.min(requestedPage, totalUserPages);

  const users = await prisma.user.findMany({
    where,
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

  const variants = await prisma.variant.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      inventory: true,
      product: { select: { id: true, title: true, status: true } },
    },
    where: { product: { status: "ACTIVE" } },
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
      const q = normalizedInvQuery.toLowerCase();
      return (
        variant.productTitle.toLowerCase().includes(q) ||
        variant.title.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.available - b.available);

  const lowStockCount = lowStockVariants.length;
  const outOfStockCount = lowStockVariants.filter(
    (variant) => variant.available === 0
  ).length;
  const totalInvPages = Math.max(
    1,
    Math.ceil(lowStockVariants.length / INVENTORY_PAGE_SIZE)
  );
  const currentInvPage = Math.min(requestedInvPage, totalInvPages);
  const lowStockPage = lowStockVariants.slice(
    (currentInvPage - 1) * INVENTORY_PAGE_SIZE,
    currentInvPage * INVENTORY_PAGE_SIZE
  );

  const backInStockRequests = await prisma.backInStockRequest.findMany({
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
  });

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
    if (!request.notifiedAt) {
      entry.pending += 1;
    }
    if (request.createdAt > entry.latest) {
      entry.latest = request.createdAt;
    }
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

  const [
    pendingReturnCount,
    pendingReturnRequests,
    failedWebhookCount,
    failedWebhookEvents,
  ] = await Promise.all([
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
  ]);

  const quickLinks = [
    {
      href: "/admin/catalog",
      label: "Catalog",
      description: "Products, variants, categories, and collections",
    },
    {
      href: "/admin/orders",
      label: "Orders",
      description: "Fulfillment, refunds, tracking, and webhook recovery",
    },
    {
      href: "/admin/customers",
      label: "Customers",
      description: "CRM segments, repeat buyers, and spend concentration",
    },
    {
      href: "/admin/suppliers",
      label: "Suppliers",
      description: "Supplier CRM, lead times, and catalog exposure",
    },
    {
      href: "/admin/discounts",
      label: "Discounts",
      description: "Promotion codes, activation, and redemption control",
    },
    {
      href: "/admin/analytics",
      label: "Analytics",
      description: "Revenue, stock pressure, conversion, and AI quality",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Operations, access control, and stock pressure
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Central launch point for catalog work, order operations, CRM, and
              admin-only controls across the live commerce system.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            ADMIN only
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Users" value={String(totalUsers)} detail={`${totalUserPages} pages`} />
          <StatCard label="Low stock" value={String(lowStockCount)} detail={`${outOfStockCount} fully out`} />
          <StatCard label="Pending returns" value={String(pendingReturnCount)} detail="Awaiting admin decision" />
          <StatCard label="Failed webhooks" value={String(failedWebhookCount)} detail="Requires manual review" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Workspace
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">{item.label}</h2>
            <p className="mt-2 text-sm text-slate-400">{item.description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          eyebrow="Alerts"
          title="Failed Stripe webhooks"
          description="Most recent webhook failures that may need reprocessing from the orders screen."
        >
          <div className="space-y-3">
            {failedWebhookEvents.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
                No failed webhook events.
              </div>
            ) : (
              failedWebhookEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {event.type}
                      </p>
                      <p className="truncate text-xs text-slate-500">{event.eventId}</p>
                    </div>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                      Failed
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Alerts"
          title="Pending return requests"
          description="Latest unresolved return requests that still need an admin decision."
        >
          <div className="space-y-3">
            {pendingReturnRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-500">
                No pending returns.
              </div>
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
                      {new Intl.NumberFormat("de-DE", {
                        style: "currency",
                        currency: request.order.currency,
                      }).format(request.order.amountTotal / 100)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                    {request.reason}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel
        eyebrow="Access"
        title="User administration"
        description="Role control and direct user detail access. Admin area remains ADMIN-only."
      >
        <AdminUsersClient
          initialUsers={users.map((user) => ({
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
        description="Active variants at or below threshold, with direct links into the catalog editor."
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
        description="Recent notification demand across products, prioritised by pending requests."
      >
        {backInStockRows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
            No back-in-stock requests yet.
          </div>
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
                    <div className="tabular-nums font-semibold text-amber-300">
                      {row.pending}
                    </div>
                    <div className="text-xs text-slate-500">
                      {usersList || "None"}
                    </div>
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
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
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

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
