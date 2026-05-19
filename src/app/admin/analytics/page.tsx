import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { loadAdminAnalyticsOverview } from "@/lib/adminAnalyticsPageData";
import { measureServerExecution } from "@/lib/perf";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
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
  const days = parseAdminTimeRangeDays(resolvedSearchParams?.days);
  const storefrontScope = parseAdminStorefrontScope(resolvedSearchParams?.storefront);
  const storefront = storefrontScopeToStorefront(storefrontScope);
  const { result: initialOverview } = await measureServerExecution(
    "admin.analytics.overview",
    () => loadAdminAnalyticsOverview(days, storefront),
  );

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminAnalyticsClient
        initialOverview={initialOverview}
        initialDays={days}
        initialStorefrontScope={storefrontScope}
      />
    </div>
  );
}
