import { adminJson } from "@/lib/adminApi";
import { cancelAutomationJob } from "@/lib/automationQueue";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute(
  async ({ params }) => {
    const job = await cancelAutomationJob(params.id);
    return adminJson({ job });
  },
  {
    scope: "ops.write",
    rateLimit: {
      keyPrefix: "admin-automation-job-cancel",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    },
  },
);
