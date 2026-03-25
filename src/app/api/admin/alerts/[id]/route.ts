import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { adminJson } from "@/lib/adminApi";
import { mutateAdminAlert } from "@/lib/adminAlerts";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin-alert-patch:${ip}`,
    limit: 50,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return adminJson({ error: "Too many requests" }, { status: 429 });
  }

  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
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
      alertId: id,
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
}
