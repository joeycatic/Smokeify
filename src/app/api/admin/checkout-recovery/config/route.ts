import { adminJson } from "@/lib/adminApi";
import { parseCheckoutRecoveryConfig } from "@/lib/checkoutRecovery";
import { updateCheckoutRecoveryConfig } from "@/lib/checkoutRecoveryService";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute(
  async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const config = parseCheckoutRecoveryConfig(body);
    const updated = await updateCheckoutRecoveryConfig(config);
    return adminJson({ schedule: updated });
  },
  {
    scope: "ops.write",
    rateLimit: {
      keyPrefix: "admin-checkout-recovery-config",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    },
  },
);
