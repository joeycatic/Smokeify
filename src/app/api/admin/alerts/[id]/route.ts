import { adminJson } from "@/lib/adminApi";
import { mutateAdminAlert } from "@/lib/adminAlerts";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "assign" | "acknowledge" | "resolve" | "snooze" | "reopen";
      assigneeUserId?: string | null;
      snoozedUntil?: string | null;
      resolutionNote?: string | null;
    };

    if (!body.action) {
      return adminJson({ error: "Missing alert action." }, { status: 400 });
    }

    try {
      const alert = await mutateAdminAlert({
        alertId: params.id,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
        action: body.action,
        assigneeUserId: body.assigneeUserId ?? null,
        snoozedUntil: body.snoozedUntil ? new Date(body.snoozedUntil) : null,
        resolutionNote: body.resolutionNote ?? null,
      });

      return adminJson({ alert });
    } catch (error) {
      return adminJson(
        {
          error: error instanceof Error ? error.message : "Failed to update alert.",
        },
        { status: 400 }
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-alert-patch",
      limit: 50,
      windowMs: 10 * 60 * 1000,
    },
  },
);
