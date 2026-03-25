import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";
import type { CustomerSegment, CustomerTab } from "@/lib/adminCustomers";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin-customer-cohort:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return adminJson({ error: "Too many requests" }, { status: 429 });
  }

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
}
