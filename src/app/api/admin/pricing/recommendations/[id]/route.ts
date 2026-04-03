import { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import { reviewAdminPricingRecommendation } from "@/lib/adminPricingIntegration";
import type { PricingRecommendationAction } from "@/lib/adminPricingIntegration";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-pricing-review:ip:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return adminJson(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: PricingRecommendationAction;
  };

  try {
    const result = await reviewAdminPricingRecommendation(
      id,
      body.action === "reject" ? "reject" : "approve",
      {
        forwardedCookieHeader: request.headers.get("cookie"),
      }
    );
    return adminJson(result);
  } catch (error) {
    return adminJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process pricing recommendation.",
      },
      { status: 502 }
    );
  }
}
