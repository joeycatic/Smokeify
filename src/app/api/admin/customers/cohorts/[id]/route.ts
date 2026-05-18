import type { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import {
  parseCustomerCohortStatus,
  updateAdminCustomerCohort,
} from "@/lib/adminCustomerTasks";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      status?: string | null;
      assigneeUserId?: string | null;
    };

    const cohort = await updateAdminCustomerCohort({
      cohortId: params.id,
      status: parseCustomerCohortStatus(body.status),
      assigneeUserId:
        typeof body.assigneeUserId === "string" || body.assigneeUserId === null
          ? body.assigneeUserId
          : undefined,
      actor: {
        id: session.user.id,
        email: session.user.email ?? null,
      },
    });

    return adminJson({ cohort });
  },
  {
    action: "crm.write",
    rateLimit: {
      keyPrefix: "admin-customer-cohort-patch",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    },
  },
);
