import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  deleteSupplierImportItems,
  normalizeSupplierImportItemIds,
} from "@/lib/adminSupplierImport";
import { withAdminRoute } from "@/lib/adminRoute";

export const DELETE = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as { itemIds?: unknown };

    try {
      const itemIds = normalizeSupplierImportItemIds(body.itemIds);
      const items = await deleteSupplierImportItems({ itemIds });

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action:
          items.length === 1
            ? "supplier_import.item.removed"
            : "supplier_import.items.bulk_removed",
        targetType: "supplier-import-item",
        targetId: items.length === 1 ? items[0].id : undefined,
        summary:
          items.length === 1
            ? `Removed ${items[0].title} from the supplier import queue`
            : `Removed ${items.length} items from the supplier import queue`,
        metadata: {
          itemIds: items.map((item) => item.id),
          itemTitles: items.map((item) => item.title),
          linkedProductIds: items
            .map((item) => item.linkedProductId)
            .filter((id): id is string => Boolean(id)),
        },
      });

      return adminJson({
        ok: true,
        deletedCount: items.length,
        deletedIds: items.map((item) => item.id),
      });
    } catch (error) {
      return adminJson(
        {
          error:
            error instanceof Error
              ? error.message
              : "The supplier import items could not be removed.",
        },
        { status: 400 },
      );
    }
  },
  {
    scope: "catalog.write",
    rateLimit: {
      keyPrefix: "admin-supplier-import-delete",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
);
