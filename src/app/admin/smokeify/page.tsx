import { notFound } from "next/navigation";
import { AdminStorefrontDashboard } from "@/components/admin/AdminStorefrontDashboard";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getAdminStorefrontDashboardData } from "@/lib/adminStorefrontDashboard";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";

export default async function AdminSmokeifyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("analytics.read"))) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const days = parseAdminTimeRangeDays(resolvedSearchParams?.days);
  const dashboardData = await getAdminStorefrontDashboardData({
    storefront: "MAIN",
    days,
  });

  return (
    <div className="w-full text-slate-100">
      <AdminStorefrontDashboard data={dashboardData} pathname="/admin/smokeify" />
    </div>
  );
}
