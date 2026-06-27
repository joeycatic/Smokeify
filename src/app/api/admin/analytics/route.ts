import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { resolveAdminAnalyticsRange } from "@/lib/adminAnalyticsRange";
import {
  loadAdminAnalyticsLive,
  loadAdminAnalyticsOverview,
  loadAdminAnalyticsSecondary,
} from "@/lib/adminAnalyticsPageData";
import { parseAdminStorefrontScope, storefrontScopeToStorefront } from "@/lib/storefronts";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");
  const range = resolveAdminAnalyticsRange({
    days: searchParams.get("days"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  const storefront = storefrontScopeToStorefront(
    parseAdminStorefrontScope(searchParams.get("storefront")),
  );

  if (section === "live") {
    return adminJson(await loadAdminAnalyticsLive(storefront));
  }

  if (section === "overview") {
    return adminJson(await loadAdminAnalyticsOverview(range, storefront));
  }

  if (section === "secondary") {
    return adminJson(await loadAdminAnalyticsSecondary(range, storefront));
  }

  const [overview, secondary] = await Promise.all([
    loadAdminAnalyticsOverview(range, storefront),
    loadAdminAnalyticsSecondary(range, storefront),
  ]);

  return adminJson({
    ...overview,
    ...secondary,
    acquisition: {
      ...(overview.acquisition ?? {}),
      ...(secondary.acquisition ?? {}),
    },
    operations: secondary.operations,
  });
});
