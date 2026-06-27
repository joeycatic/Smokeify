import type {
  AdminAnalyticsMetric,
  AdminAnalyticsRange,
  AdminAnalyticsPresetDays,
} from "@/lib/adminAnalyticsRange";
import type { AdminStorefrontScope } from "@/lib/storefronts";

export type AdminAnalyticsLocation = {
  range: Pick<AdminAnalyticsRange, "kind" | "days" | "from" | "to">;
  storefront: AdminStorefrontScope;
  metric?: AdminAnalyticsMetric;
};

export function buildAdminAnalyticsQuery({
  range,
  storefront,
  metric,
}: AdminAnalyticsLocation) {
  const params = new URLSearchParams();
  if (range.kind === "custom") {
    params.set("from", range.from);
    params.set("to", range.to);
  } else {
    params.set("days", String(range.days));
  }
  params.set("storefront", storefront);
  if (metric && metric !== "revenue") params.set("metric", metric);
  return params.toString();
}

export function buildAdminAnalyticsHref(location: AdminAnalyticsLocation) {
  return `/admin/analytics?${buildAdminAnalyticsQuery(location)}`;
}

export function buildAdminAnalyticsApiHref(
  location: AdminAnalyticsLocation,
  section?: "overview" | "secondary" | "live",
) {
  const params = new URLSearchParams(buildAdminAnalyticsQuery(location));
  if (section) {
    params.set("section", section);
  }
  return `/api/admin/analytics?${params.toString()}`;
}

export function buildAdminAnalyticsPresetHref(
  days: AdminAnalyticsPresetDays,
  storefront: AdminStorefrontScope,
  metric?: AdminAnalyticsMetric,
) {
  return buildAdminAnalyticsHref({
    range: { kind: "preset", days, from: "", to: "" },
    storefront,
    metric,
  });
}
