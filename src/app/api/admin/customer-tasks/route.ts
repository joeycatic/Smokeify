import { type NextRequest } from "next/server";
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
    sameOrigin: false,
    action: "crm.write",
  },
);

