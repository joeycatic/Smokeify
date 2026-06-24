import { adminJson } from "@/lib/adminApi";
import {
  listAdminCustomerTasks,
  parseCustomerTaskStatus,
} from "@/lib/adminCustomerTasks";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async ({ request }) => {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");
    const status = parseCustomerTaskStatus(url.searchParams.get("status"));
    const data = await listAdminCustomerTasks({
      customerId,
      status,
    });

    return adminJson(data);
  },
  {
    // Read-only task lists can be requested from export/reporting surfaces
    // without requiring an origin header. Authorization still happens here.
    sameOrigin: false,
    action: "crm.write",
  },
);
