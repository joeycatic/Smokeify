import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { loadMccOverview } from "@/lib/adminMcc";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = request.nextUrl;
  return adminJson(
    await loadMccOverview({
      storefront: searchParams.get("storefront"),
      range: searchParams.get("range"),
    }),
  );
});
