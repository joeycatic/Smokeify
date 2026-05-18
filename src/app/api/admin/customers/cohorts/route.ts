import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";
import type { CustomerSegment, CustomerTab } from "@/lib/adminCustomers";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(async () => {
  const [cohorts, owners] = await Promise.all([
    prisma.adminCustomerCohort.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, email: true, name: true },
    }),
  ]);

  return adminJson({
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      description: cohort.description,
      customerCount: cohort.customerCount,
      filters: (cohort.filters as Record<string, unknown>) ?? {},
      createdByEmail: cohort.createdByEmail,
      assigneeUserId: cohort.assigneeUserId,
      assigneeEmail: cohort.assigneeEmail,
      status: cohort.status,
      createdAt: cohort.createdAt.toISOString(),
      updatedAt: cohort.updatedAt.toISOString(),
    })),
    owners,
  });
});

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string | null;
      customerCount?: number;
      filters?: {
        q?: string;
        tab?: CustomerTab;
        segment?: CustomerSegment | "all";
      };
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return adminJson({ error: "Cohort name is required." }, { status: 400 });
    }

    const cohort = await prisma.adminCustomerCohort.create({
      data: {
        name,
        description:
          typeof body.description === "string" ? body.description.trim() || null : null,
        customerCount:
          Number.isFinite(body.customerCount) && Number(body.customerCount) >= 0
            ? Math.floor(Number(body.customerCount))
            : 0,
        filters: body.filters ?? {},
        createdById: session.user.id,
        createdByEmail: session.user.email ?? null,
      },
    });

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "customer.cohort.create",
      targetType: "admin_customer_cohort",
      targetId: cohort.id,
      summary: `Created customer cohort ${cohort.name}`,
      metadata: {
        filters: body.filters ?? {},
        customerCount: cohort.customerCount,
      },
    });

    return adminJson({
      cohort: {
        id: cohort.id,
        name: cohort.name,
        description: cohort.description,
        customerCount: cohort.customerCount,
        filters: cohort.filters,
        createdByEmail: cohort.createdByEmail,
        createdAt: cohort.createdAt.toISOString(),
        updatedAt: cohort.updatedAt.toISOString(),
      },
    });
  },
  {
    action: "crm.write",
    rateLimit: {
      keyPrefix: "admin-customer-cohort",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      message: "Too many requests",
    },
  },
);
