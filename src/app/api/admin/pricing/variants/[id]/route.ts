import type { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import type { PricingProfilePatch } from "@/lib/adminPricingIntegration";
import {
  AdminPricingError,
  updateAdminVariantPricingProfile,
} from "@/lib/adminPricingServer";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      pricingProfile?: PricingProfilePatch;
      expectedUpdatedAt?: string | null;
    };

    if (!body.pricingProfile || typeof body.pricingProfile !== "object") {
      return adminJson(
        { error: "Pricing-Profil-Daten sind erforderlich." },
        { status: 400 },
      );
    }

    try {
      const variantPricing = await updateAdminVariantPricingProfile(
        params.id,
        {
          pricingProfile: body.pricingProfile,
          expectedUpdatedAt:
            typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : null,
        },
        {
          actor: {
            id: session.user.id,
            email: session.user.email ?? null,
          },
        },
      );

      return adminJson({ variantPricing });
    } catch (error) {
      return adminJson(
        {
          error:
            error instanceof Error ? error.message : "Pricing-Profil konnte nicht gespeichert werden.",
        },
        { status: error instanceof AdminPricingError ? error.status : 502 },
      );
    }
  },
  {
    action: "pricing.write",
    rateLimit: {
      keyPrefix: "admin-variant-pricing-profile-update",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
);
