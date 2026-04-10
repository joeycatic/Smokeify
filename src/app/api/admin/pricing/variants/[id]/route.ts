import { NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import {
  AdminPricingError,
  updateAdminVariantPricingProfile,
} from "@/lib/adminPricingServer";
import type { PricingProfilePatch } from "@/lib/adminPricingIntegration";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { canAdminPerformAction } from "@/lib/adminPermissions";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-variant-pricing-profile-update:ip:${ip}`,
    limit: 60,
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
  if (!canAdminPerformAction(session.user.role, "pricing.write")) {
    return adminJson(
      { error: "You do not have permission to edit pricing profiles." },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    pricingProfile?: PricingProfilePatch;
    expectedUpdatedAt?: string | null;
  };

  if (!body.pricingProfile || typeof body.pricingProfile !== "object") {
    return adminJson(
      { error: "Pricing profile payload is required." },
      { status: 400 }
    );
  }

  try {
    const variantPricing = await updateAdminVariantPricingProfile(
      id,
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
      }
    );

    return adminJson({ variantPricing });
  } catch (error) {
    return adminJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save pricing profile.",
      },
      { status: error instanceof AdminPricingError ? error.status : 502 }
    );
  }
}
