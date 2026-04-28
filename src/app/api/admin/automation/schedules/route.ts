import { adminJson } from "@/lib/adminApi";
import {
  getAutomationBootstrapMessage,
  isAutomationControlPlaneMissingError,
  listAutomationSchedules,
  updateAutomationSchedule,
} from "@/lib/automationQueue";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async () => {
    try {
      const schedules = await listAutomationSchedules();
      return adminJson({ schedules });
    } catch (error) {
      if (!isAutomationControlPlaneMissingError(error)) throw error;
      return adminJson(
        {
          error: getAutomationBootstrapMessage(),
          schedules: [],
        },
        { status: 503 },
      );
    }
  },
  {
    scope: "ops.read",
    rateLimit: {
      keyPrefix: "admin-automation-schedules",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
);

export const PATCH = withAdminRoute(
  async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      key?: string;
      status?: "ACTIVE" | "PAUSED";
      nextRunAt?: string | null;
      payload?: Record<string, unknown> | null;
    };

    if (!body.key?.trim()) {
      return adminJson({ error: "Schedule key is required." }, { status: 400 });
    }

    let schedule;
    try {
      schedule = await updateAutomationSchedule({
        key: body.key.trim(),
        status: body.status,
        nextRunAt: typeof body.nextRunAt === "undefined" ? undefined : body.nextRunAt,
        payload: typeof body.payload === "undefined" ? undefined : body.payload,
      });
    } catch (error) {
      if (!isAutomationControlPlaneMissingError(error)) throw error;
      return adminJson(
        { error: getAutomationBootstrapMessage() },
        { status: 503 },
      );
    }

    return adminJson({ schedule });
  },
  {
    scope: "ops.write",
    rateLimit: {
      keyPrefix: "admin-automation-schedules-patch",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    },
  },
);
