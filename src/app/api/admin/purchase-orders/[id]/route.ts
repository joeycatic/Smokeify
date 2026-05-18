import { adminJson } from "@/lib/adminApi";
import {
  loadAdminPurchaseOrderDetail,
  updatePurchaseOrder,
} from "@/lib/adminProcurement";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute<{ id: string }>(async ({ params }) => {
  const purchaseOrder = await loadAdminPurchaseOrderDetail(params.id);
  if (!purchaseOrder) {
    return adminJson({ error: "Purchase order not found." }, { status: 404 });
  }
  return adminJson({ purchaseOrder });
});

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        supplierId?: string;
        reference?: string | null;
        note?: string | null;
        expectedDeliveryAt?: string | null;
        items?: Array<{
          productId?: string;
          variantId?: string;
          orderedQuantity?: number;
          unitCostCents?: number;
          note?: string | null;
        }>;
      };

      const purchaseOrder = await updatePurchaseOrder(params.id, {
        supplierId: body.supplierId,
        reference: body.reference,
        note: body.note,
        expectedDeliveryAt: body.expectedDeliveryAt,
        items: body.items
          ? body.items.map((item) => ({
              productId: item.productId ?? "",
              variantId: item.variantId ?? "",
              orderedQuantity: item.orderedQuantity ?? 0,
              unitCostCents: item.unitCostCents ?? 0,
              note: item.note,
            }))
          : undefined,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      return adminJson({ purchaseOrder });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to update purchase order." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-purchase-orders-update",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);
