import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import type { AdminRole } from "@/lib/adminPermissions";
import { loadAdminCustomersPageData } from "@/lib/adminCustomersPageData";

export const GET = withAdminRoute(async ({ request, session }) => {
  const { searchParams } = new URL(request.url);
  const data = await loadAdminCustomersPageData({
    role: session.user.role as AdminRole,
    query: searchParams.get("q"),
    tab: searchParams.get("tab"),
    segment: searchParams.get("segment"),
    page: Number(searchParams.get("page") ?? "1"),
    storefront: searchParams.get("storefront"),
  });
  return adminJson(data);
});
