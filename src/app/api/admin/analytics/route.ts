import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  loadAdminAnalyticsOverview,
  loadAdminAnalyticsSecondary,
} from "@/lib/adminAnalyticsPageData";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");

  if (section === "overview") {
    return adminJson(await loadAdminAnalyticsOverview());
  }

  if (section === "secondary") {
    return adminJson(await loadAdminAnalyticsSecondary());
  }

  const [overview, secondary] = await Promise.all([
    loadAdminAnalyticsOverview(),
    loadAdminAnalyticsSecondary(),
  ]);

  return adminJson({
    ...overview,
    ...secondary,
  });
});
