import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { loadMccContacts } from "@/lib/adminMcc";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = request.nextUrl;
  return adminJson(
    await loadMccContacts({
      storefront: searchParams.get("storefront"),
      q: searchParams.get("q"),
      limit: Number(searchParams.get("limit") ?? 80),
    }),
  );
});
