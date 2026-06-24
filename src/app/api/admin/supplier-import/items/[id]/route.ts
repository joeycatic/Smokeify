import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  updateSupplierImportItem,
  type SupplierImportEditableFields,
} from "@/lib/adminSupplierImport";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      edits?: SupplierImportEditableFields;
      decision?: "APPROVED" | "DECLINED" | "PENDING";
    };
    if (
      body.decision &&
      !["APPROVED", "DECLINED", "PENDING"].includes(body.decision)
    ) {
      return adminJson({ error: "Invalid review decision." }, { status: 400 });
    }

    try {
      const item = await updateSupplierImportItem({
        itemId: params.id,
        edits: body.edits,
        decision: body.decision,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: body.decision
          ? `supplier_import.item.${body.decision.toLowerCase()}`
          : "supplier_import.item.updated",
        targetType: "supplier-import-item",
        targetId: item.id,
        summary: `${body.decision ? `Marked ${item.title} ${body.decision.toLowerCase()}` : `Updated ${item.title}`}`,
        metadata: {
          sourceUrl: item.sourceUrl,
          linkedProductId: item.linkedProductId,
        },
      });

      return adminJson({ item });
    } catch (error) {
      return adminJson(
        {
          error:
            error instanceof Error ? error.message : "The review item could not be saved.",
        },
        { status: 400 },
      );
    }
  },
  {
    scope: "catalog.write",
    rateLimit: {
      keyPrefix: "admin-supplier-import-item",
      limit: 180,
      windowMs: 10 * 60 * 1000,
    },
  },
);
