import { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import { requireAdmin } from "@/lib/adminCatalog";
import { getAdminPricingOverview } from "@/lib/adminPricingServer";

export async function GET(_request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getAdminPricingOverview();
    return adminJson(snapshot);
  } catch (error) {
    return adminJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load pricing overview.",
      },
      { status: 502 }
    );
  }
}
