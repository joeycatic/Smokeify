import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import {
  loadAdminAnalyticsOverview,
  loadAdminAnalyticsSecondary,
} from "@/lib/adminAnalyticsPageData";
import { parseAdminStorefrontScope, storefrontScopeToStorefront } from "@/lib/storefronts";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");
  const days = parseAdminTimeRangeDays(searchParams.get("days") ?? undefined);
  const storefront = storefrontScopeToStorefront(
    parseAdminStorefrontScope(searchParams.get("storefront")),
  );

  if (section === "overview") {
    return adminJson(await loadAdminAnalyticsOverview(days, storefront));
  }

  if (section === "secondary") {
    return adminJson(await loadAdminAnalyticsSecondary(days, storefront));
  }

  const [overview, secondary] = await Promise.all([
    loadAdminAnalyticsOverview(days, storefront),
    loadAdminAnalyticsSecondary(days, storefront),
  ]);

  return adminJson({
    ...overview,
    ...secondary,
  });
});
