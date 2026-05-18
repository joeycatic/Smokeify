import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string | string[];
    q?: string | string[];
  }>;
}) {
  if (!(await requireAdminScope("users.manage"))) notFound();

  const resolvedSearchParams = await searchParams;
  const rawQuery = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0] ?? ""
    : resolvedSearchParams?.q ?? "";
  const rawPage = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams?.page[0] ?? "1"
    : resolvedSearchParams?.page ?? "1";
  const requestedPage = Number(rawPage);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const normalizedQuery = rawQuery.trim();
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

  const totalCount = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    skip: (currentPage - 1) * PAGE_SIZE,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminTotpEnabledAt: true,
      adminTotpPendingSecretEncrypted: true,
      adminAccessDisabledAt: true,
      adminAccessDisableReason: true,
      sessions: { select: { id: true } },
      devices: { select: { id: true } },
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <section className="admin-reveal overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
          Admin / Users
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          User access and profile controls
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Dedicated user administration view for role changes, profile review,
          and direct access into individual user records.
        </p>
      </section>

      <AdminUsersClient
        initialUsers={users.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          adminTotpEnabled: Boolean(user.adminTotpEnabledAt),
          adminTotpPending: Boolean(user.adminTotpPendingSecretEncrypted),
          adminAccessDisabledAt: user.adminAccessDisabledAt?.toISOString() ?? null,
          adminAccessDisableReason: user.adminAccessDisableReason ?? null,
          sessionCount: user.sessions.length,
          deviceCount: user.devices.length,
          createdAt: user.createdAt.toISOString(),
        }))}
        initialQuery={normalizedQuery}
        totalCount={totalCount}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        basePath="/admin/users"
        heading="All users"
        description="Standalone CRM access surface with role changes and direct profile entry."
      />
    </div>
  );
}
