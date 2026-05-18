import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { loadAdminAnalyticsOverview } from "@/lib/adminAnalyticsPageData";
import { measureServerExecution } from "@/lib/perf";
import AdminAnalyticsClient from "./AdminAnalyticsClient";

export default async function AdminAnalyticsPage() {
  if (!(await requireAdminScope("analytics.read"))) notFound();
  const { result: initialOverview } = await measureServerExecution(
    "admin.analytics.overview",
    () => loadAdminAnalyticsOverview(),
  );

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminAnalyticsClient initialOverview={initialOverview} />
    </div>
  );
}
