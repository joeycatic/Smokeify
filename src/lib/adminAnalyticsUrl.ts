import type { AdminTimeRangeDays } from "@/lib/adminTimeRange";
import type { AdminStorefrontScope } from "@/lib/storefronts";

export type AdminAnalyticsLocation = {
  days: AdminTimeRangeDays;
  storefront: AdminStorefrontScope;
};

export function buildAdminAnalyticsQuery({
  days,
  storefront,
}: AdminAnalyticsLocation) {
  const params = new URLSearchParams();
  params.set("days", String(days));
  params.set("storefront", storefront);
  return params.toString();
}

export function buildAdminAnalyticsHref(location: AdminAnalyticsLocation) {
  return `/admin/analytics?${buildAdminAnalyticsQuery(location)}`;
}

export function buildAdminAnalyticsApiHref(
  location: AdminAnalyticsLocation,
  section?: "overview" | "secondary",
) {
  const params = new URLSearchParams(buildAdminAnalyticsQuery(location));
  if (section) {
    params.set("section", section);
  }
  return `/api/admin/analytics?${params.toString()}`;
}
