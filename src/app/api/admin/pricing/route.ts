import { adminJson } from "@/lib/adminApi";
import { getAdminPricingOverview } from "@/lib/adminPricingServer";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(async () => {
  try {
    const snapshot = await getAdminPricingOverview();
    return adminJson(snapshot);
  } catch (error) {
    return adminJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load pricing overview.",
      },
      { status: 502 }
    );
  }
});
