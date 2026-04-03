import { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import { requireAdmin } from "@/lib/adminCatalog";
import { getAdminPricingOverview } from "@/lib/adminPricingIntegration";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getAdminPricingOverview({
      forwardedCookieHeader: request.headers.get("cookie"),
    });
    return adminJson(snapshot);
  } catch (error) {
    return adminJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Growvault pricing overview.",
      },
      { status: 502 }
    );
  }
}
