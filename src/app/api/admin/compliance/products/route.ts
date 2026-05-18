import { adminJson } from "@/lib/adminApi";
import {
  listAdminComplianceProducts,
  parseAdminComplianceFilters,
} from "@/lib/adminCompliance";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async ({ request }) => {
    const filters = parseAdminComplianceFilters(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await listAdminComplianceProducts(filters);
    return adminJson(result);
  },
  { scope: "catalog.write", sameOrigin: false },
);
