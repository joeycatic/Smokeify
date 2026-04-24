import {
  SupportCasePriority,
  SupportCaseStatus,
} from "@prisma/client";
import { adminJson } from "@/lib/adminApi";
import { updateAdminSupportCase } from "@/lib/adminSupport";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        status?: SupportCaseStatus;
        priority?: SupportCasePriority;
        assigneeUserId?: string | null;
        summary?: string;
        resolutionNote?: string | null;
        note?: string | null;
      };

      const supportCase = await updateAdminSupportCase(params.id, {
        status: body.status,
        priority: body.priority,
        assigneeUserId: body.assigneeUserId,
        summary: body.summary,
        resolutionNote: body.resolutionNote,
        note: body.note,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      return adminJson({ supportCase });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to update support case." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-support-case-update",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);
