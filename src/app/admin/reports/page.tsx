import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { getAdminReportSnapshot, parseAdminReportFilters } from "@/lib/adminReports";
import { parseAdminStorefrontScope, storefrontScopeToStorefront } from "@/lib/storefronts";
import AdminReportsClient from "./AdminReportsClient";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdmin())) notFound();
  const resolvedSearchParams = await searchParams;
  const filters = parseAdminReportFilters(resolvedSearchParams);
  if (filters.sourceStorefront === "ALL") {
    const storefront = storefrontScopeToStorefront(
      parseAdminStorefrontScope(resolvedSearchParams?.storefront),
    );
    if (storefront) {
      filters.sourceStorefront = storefront;
    }
  }
  const snapshot = await getAdminReportSnapshot(filters);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminReportsClient initialSnapshot={snapshot} />
    </div>
  );
}
