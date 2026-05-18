import type { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import {
  createAdminCustomerTask,
  parseCustomerTaskPlaybook,
  parseCustomerTaskStatus,
} from "@/lib/adminCustomerTasks";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      ownerId?: string | null;
      sourceCohortId?: string | null;
      status?: string | null;
      playbook?: string | null;
      title?: string | null;
      description?: string | null;
      dueAt?: string | null;
    };

    const task = await createAdminCustomerTask({
      customerId: params.id,
      ownerId: typeof body.ownerId === "string" || body.ownerId === null ? body.ownerId : undefined,
      sourceCohortId:
        typeof body.sourceCohortId === "string" ? body.sourceCohortId : undefined,
      status: parseCustomerTaskStatus(body.status),
      playbook: parseCustomerTaskPlaybook(body.playbook),
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
      actor: {
        id: session.user.id,
        email: session.user.email ?? null,
      },
    });

    return adminJson({ task });
  },
  {
    action: "crm.write",
    rateLimit: {
      keyPrefix: "admin-customer-task-create",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    },
  },
);
