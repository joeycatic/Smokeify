import { adminJson } from "@/lib/adminApi";
import {
  createPurchaseOrder,
  listAdminPurchaseOrders,
} from "@/lib/adminProcurement";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(async () => {
  const purchaseOrders = await listAdminPurchaseOrders();
  return adminJson({ purchaseOrders });
});

export const POST = withAdminRoute(
  async ({ request, session }) => {
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

      const purchaseOrder = await createPurchaseOrder({
        supplierId: body.supplierId ?? "",
        reference: body.reference,
        note: body.note,
        expectedDeliveryAt: body.expectedDeliveryAt,
        items: (body.items ?? []).map((item) => ({
          productId: item.productId ?? "",
          variantId: item.variantId ?? "",
          orderedQuantity: item.orderedQuantity ?? 0,
          unitCostCents: item.unitCostCents ?? 0,
          note: item.note,
        })),
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      return adminJson({ purchaseOrder }, { status: 201 });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to create purchase order." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-purchase-orders-create",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    },
  },
);
