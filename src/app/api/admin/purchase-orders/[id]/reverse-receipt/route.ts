import { adminJson } from "@/lib/adminApi";
import { reversePurchaseOrderReceipt } from "@/lib/adminProcurement";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        receiptId?: string;
        note?: string | null;
      };

      const purchaseOrder = await reversePurchaseOrderReceipt({
        purchaseOrderId: params.id,
        receiptId: body.receiptId ?? "",
        note: body.note,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      return adminJson({ purchaseOrder });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to reverse receipt." },
        { status: 400 },
      );
    }
  },
  {
    role: "ADMIN",
    rateLimit: {
      keyPrefix: "admin-purchase-orders-reverse-receipt",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    },
  },
);
