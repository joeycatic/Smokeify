import type { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import {
  parseCustomerTaskPlaybook,
  parseCustomerTaskStatus,
  updateAdminCustomerTask,
} from "@/lib/adminCustomerTasks";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      ownerId?: string | null;
      status?: string | null;
      playbook?: string | null;
      title?: string | null;
      description?: string | null;
      dueAt?: string | null;
      snoozedUntil?: string | null;
    };

    const task = await updateAdminCustomerTask({
      taskId: params.id,
      ownerId: typeof body.ownerId === "string" || body.ownerId === null ? body.ownerId : undefined,
      status: parseCustomerTaskStatus(body.status),
      playbook: parseCustomerTaskPlaybook(body.playbook),
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
      snoozedUntil: typeof body.snoozedUntil === "string" ? body.snoozedUntil : undefined,
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
      keyPrefix: "admin-customer-task-patch",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);
