import { adminJson } from "@/lib/adminApi";
import { receivePurchaseOrder } from "@/lib/adminProcurement";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        note?: string | null;
        lines?: Array<{
          purchaseOrderItemId?: string;
          quantityReceived?: number;
        }>;
      };

      const purchaseOrder = await receivePurchaseOrder({
        purchaseOrderId: params.id,
        note: body.note,
        lines: (body.lines ?? []).map((line) => ({
          purchaseOrderItemId: line.purchaseOrderItemId ?? "",
          quantityReceived: line.quantityReceived ?? 0,
        })),
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      return adminJson({ purchaseOrder });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to receive purchase order." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-purchase-orders-receive",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);
