import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";

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
    <AdminPage layout="queue">
      <AdminPageHeader
        eyebrow="Admin / Users"
        title="User access and governance"
        description="Search accounts, review roles and MFA posture, and open individual governance records."
      />

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
    </AdminPage>
  );
}
