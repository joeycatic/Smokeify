import { adminJson } from "@/lib/adminApi";
import { submitPurchaseOrder } from "@/lib/adminProcurement";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute<{ id: string }>(
  async ({ params, session }) => {
    try {
      const purchaseOrder = await submitPurchaseOrder(params.id, {
        id: session.user.id,
        email: session.user.email ?? null,
      });

      return adminJson({ purchaseOrder });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to submit purchase order." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-purchase-orders-submit",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);
