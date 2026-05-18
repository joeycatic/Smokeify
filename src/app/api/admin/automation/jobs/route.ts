import { adminJson } from "@/lib/adminApi";
import {
  getAutomationBootstrapMessage,
  isAutomationControlPlaneMissingError,
  listAutomationJobs,
} from "@/lib/automationQueue";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async () => {
    try {
      const jobs = await listAutomationJobs();
      return adminJson({ jobs });
    } catch (error) {
      if (!isAutomationControlPlaneMissingError(error)) throw error;
      return adminJson(
        {
          error: getAutomationBootstrapMessage(),
          jobs: [],
        },
        { status: 503 },
      );
    }
  },
  {
    scope: "ops.read",
    rateLimit: {
      keyPrefix: "admin-automation-jobs",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
);
