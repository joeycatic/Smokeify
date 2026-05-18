import { adminJson } from "@/lib/adminApi";
import { applyManualOrderAttribution } from "@/lib/adminAttribution";
import { parseStorefront } from "@/lib/storefronts";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      sourceStorefront?: string;
      reason?: string;
    };
    const storefront = parseStorefront(body.sourceStorefront ?? null);
    if (!storefront) {
      return adminJson({ error: "A valid storefront is required." }, { status: 400 });
    }

    try {
      const order = await applyManualOrderAttribution({
        orderId: params.id,
        storefront,
        reason: typeof body.reason === "string" ? body.reason : "",
        actor: { id: session.user.id, email: session.user.email ?? null },
      });
      return adminJson({ order });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Could not update attribution." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-order-attribution-update",
      limit: 50,
      windowMs: 10 * 60 * 1000,
    },
  },
);
