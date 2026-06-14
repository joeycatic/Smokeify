import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import type { AdminRole } from "@/lib/adminPermissions";
import { loadAdminCustomersPageData } from "@/lib/adminCustomersPageData";
import { parseAdminStorefrontScope } from "@/lib/storefronts";
import AdminCustomersClient from "./AdminCustomersClient";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin("customers.read");
  if (!session) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialSearchQuery = Array.isArray(resolvedSearchParams.query)
    ? resolvedSearchParams.query[0] ?? ""
    : resolvedSearchParams.query ?? "";
  const initialStorefrontScope = parseAdminStorefrontScope(
    resolvedSearchParams.storefront,
  );
  const initialTab = Array.isArray(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab[0] ?? "all"
    : resolvedSearchParams.tab ?? "all";
  const initialSegment = Array.isArray(resolvedSearchParams.segment)
    ? resolvedSearchParams.segment[0] ?? "all"
    : resolvedSearchParams.segment ?? "all";
  const initialData = await loadAdminCustomersPageData({
    role: session.user.role as AdminRole,
    query: initialSearchQuery,
    tab: initialTab,
    segment: initialSegment,
    page: Number(
      Array.isArray(resolvedSearchParams.page)
        ? resolvedSearchParams.page[0] ?? "1"
        : resolvedSearchParams.page ?? "1",
    ),
    storefront: Array.isArray(resolvedSearchParams.storefront)
      ? resolvedSearchParams.storefront[0] ?? null
      : resolvedSearchParams.storefront ?? null,
  });

  return (
    <div className="admin-route-frame text-slate-100">
      <AdminCustomersClient
        initialData={initialData}
        initialSegmentFilter={initialSegment}
        initialSearchQuery={initialSearchQuery}
        initialStorefrontScope={initialStorefrontScope}
        initialTab={initialTab}
      />
    </div>
  );
}
