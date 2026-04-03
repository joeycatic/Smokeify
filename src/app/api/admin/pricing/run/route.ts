import { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import {
  runAdminPricingAutomation,
} from "@/lib/adminPricingIntegration";
import type { PricingRunMode } from "@/lib/adminPricingIntegration";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-pricing-run:ip:${ip}`,
    limit: 20,
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

  const body = (await request.json().catch(() => ({}))) as {
    mode?: PricingRunMode;
    limit?: number;
    notes?: string | null;
  };

  try {
    const result = await runAdminPricingAutomation(
      {
        mode: body.mode === "PREVIEW" ? "PREVIEW" : "APPLY",
        limit:
          typeof body.limit === "number" &&
          Number.isFinite(body.limit) &&
          body.limit > 0
            ? Math.floor(body.limit)
            : undefined,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
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
            : "Unable to start pricing automation.",
      },
      { status: 502 }
    );
  }
}
