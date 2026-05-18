import { adminJson } from "@/lib/adminApi";
import {
  mutateAdminComplianceProduct,
  normalizeAdminComplianceMutationInput,
} from "@/lib/adminCompliance";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const input = normalizeAdminComplianceMutationInput(await request.json().catch(() => null));
    if (!input) {
      return adminJson({ error: "Invalid compliance action payload." }, { status: 400 });
    }

    const result = await mutateAdminComplianceProduct({
      productId: params.id,
      actor: { id: session.user.id, email: session.user.email ?? null },
      input,
    });

    if (!result.ok) {
      return adminJson(
        { error: result.error, blockers: "blockers" in result ? result.blockers : undefined },
        { status: result.status },
      );
    }

    return adminJson({ product: result.product });
  },
  {
    scope: "catalog.write",
    rateLimit: {
      keyPrefix: "admin:compliance:product",
      limit: 80,
      windowMs: 60_000,
      message: "Too many compliance actions. Try again shortly.",
    },
  },
);
