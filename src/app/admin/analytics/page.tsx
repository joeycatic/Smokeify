import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { loadAdminAnalyticsOverview } from "@/lib/adminAnalyticsPageData";
import {
  parseAdminAnalyticsMetric,
  resolveAdminAnalyticsRange,
} from "@/lib/adminAnalyticsRange";
import { measureServerExecution } from "@/lib/perf";
import {
  parseAdminStorefrontScope,
  storefrontScopeToStorefront,
} from "@/lib/storefronts";
import AdminAnalyticsClient from "./AdminAnalyticsClient";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("analytics.read"))) notFound();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const range = resolveAdminAnalyticsRange({
    days: resolvedSearchParams?.days,
    from: resolvedSearchParams?.from,
    to: resolvedSearchParams?.to,
  });
  const metric = parseAdminAnalyticsMetric(resolvedSearchParams?.metric);
  const storefrontScope = parseAdminStorefrontScope(resolvedSearchParams?.storefront);
  const storefront = storefrontScopeToStorefront(storefrontScope);
  const { result: initialOverview } = await measureServerExecution(
    "admin.analytics.overview",
    () => loadAdminAnalyticsOverview(range, storefront),
  );

  return (
    <div className="w-full text-slate-100">
      <AdminAnalyticsClient
        initialOverview={initialOverview}
        initialRange={range}
        initialMetric={metric}
        initialStorefrontScope={storefrontScope}
      />
    </div>
  );
}
