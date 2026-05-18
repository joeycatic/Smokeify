import { adminJson } from "@/lib/adminApi";
import {
  mutateAdminComplianceProduct,
  normalizeAdminComplianceMutationInput,
} from "@/lib/adminCompliance";
import { withAdminRoute } from "@/lib/adminRoute";

const normalizeIds = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean),
        ),
      ).slice(0, 100)
    : [];

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = await request.json().catch(() => null);
    const ids = normalizeIds((body as { ids?: unknown } | null)?.ids);
    const input = normalizeAdminComplianceMutationInput(body);

    if (!ids.length) {
      return adminJson({ error: "At least one product id is required." }, { status: 400 });
    }
    if (!input) {
      return adminJson({ error: "Invalid compliance action payload." }, { status: 400 });
    }

    const actor = { id: session.user.id, email: session.user.email ?? null };
    const results = [];
    for (const id of ids) {
      results.push(await mutateAdminComplianceProduct({ productId: id, actor, input }));
    }

    return adminJson({
      count: results.length,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  },
  {
    scope: "catalog.write",
    rateLimit: {
      keyPrefix: "admin:compliance:bulk",
      limit: 20,
      windowMs: 60_000,
      message: "Too many bulk compliance actions. Try again shortly.",
    },
  },
);
