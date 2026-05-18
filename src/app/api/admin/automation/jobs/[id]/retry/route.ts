import { adminJson } from "@/lib/adminApi";
import { retryAutomationJob } from "@/lib/automationQueue";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute(
  async ({ params }) => {
    const job = await retryAutomationJob(params.id);
    return adminJson({ job });
  },
  {
    scope: "ops.write",
    rateLimit: {
      keyPrefix: "admin-automation-job-retry",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    },
  },
);
