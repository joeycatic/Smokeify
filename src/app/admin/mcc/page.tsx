import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import type { AdminRole } from "@/lib/adminPermissions";
import { loadMccPageData, parseMccRange, parseMccScope } from "@/lib/adminMcc";
import AdminMccClient from "./AdminMccClient";

export default async function AdminMccPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin("marketing.read");
  if (!session) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const storefrontScope = parseMccScope(resolvedSearchParams.storefront);
  const rangeDays = parseMccRange(resolvedSearchParams.range);
  const query = Array.isArray(resolvedSearchParams.q)
    ? resolvedSearchParams.q[0] ?? ""
    : resolvedSearchParams.q ?? "";
  const data = await loadMccPageData({
    role: session.user.role as AdminRole,
    storefront: storefrontScope,
    range: String(rangeDays),
    q: query,
  });

  return (
    <div className="admin-route-frame text-slate-100">
      <AdminMccClient
        initialData={data}
        initialStorefrontScope={storefrontScope}
        initialRangeDays={rangeDays}
        initialQuery={query}
      />
    </div>
  );
}
