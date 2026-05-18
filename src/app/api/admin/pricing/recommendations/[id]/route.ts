import type { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import type { PricingRecommendationAction } from "@/lib/adminPricingIntegration";
import { reviewAdminPricingRecommendation } from "@/lib/adminPricingServer";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: PricingRecommendationAction;
      customPriceCents?: number | null;
      reviewNote?: string | null;
    };

    try {
      const result = await reviewAdminPricingRecommendation(
        params.id,
        body.action === "reject" ? "reject" : "approve",
        {
          actor: {
            id: session.user.id,
            email: session.user.email ?? null,
          },
          customPriceCents:
            typeof body.customPriceCents === "number" &&
            Number.isFinite(body.customPriceCents)
              ? Math.round(body.customPriceCents)
              : null,
          reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : null,
        },
      );

      return adminJson(result);
    } catch (error) {
      return adminJson(
        {
          error:
            error instanceof Error
              ? error.message
              : "Preisempfehlung konnte nicht verarbeitet werden.",
        },
        { status: 502 },
      );
    }
  },
  {
    action: "pricing.review",
    rateLimit: {
      keyPrefix: "admin-pricing-review",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);
