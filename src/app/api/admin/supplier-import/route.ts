import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  createBloomtechImportBatch,
  getSupplierImportWorkspaceData,
} from "@/lib/adminSupplierImport";
import { withAdminRoute } from "@/lib/adminRoute";

export const runtime = "nodejs";
export const maxDuration = 600;

export const GET = withAdminRoute(
  async () => adminJson(await getSupplierImportWorkspaceData()),
  { scope: "catalog.write" },
);

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      sourceUrl?: string;
      mainCategoryId?: string;
      additionalCategoryIds?: string[];
    };

    try {
      const batch = await createBloomtechImportBatch({
        sourceUrl: body.sourceUrl ?? "",
        mainCategoryId: body.mainCategoryId ?? "",
        additionalCategoryIds: Array.isArray(body.additionalCategoryIds)
          ? body.additionalCategoryIds
          : [],
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "supplier_import.batch.fetched",
        targetType: "supplier-import-batch",
        targetId: batch.id,
        summary: `Fetched ${batch.items.length} Bloomtech products for review`,
        metadata: {
          sourceUrl: batch.sourceUrl,
          fetchedCount: batch.fetchedCount,
          skippedCount: batch.skippedCount,
        },
      });

      return adminJson({ batch });
    } catch (error) {
      return adminJson(
        {
          error:
            error instanceof Error
              ? error.message
              : "The Bloomtech category could not be fetched.",
        },
        { status: 400 },
      );
    }
  },
  {
    scope: "catalog.write",
    rateLimit: {
      keyPrefix: "admin-supplier-import-fetch",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      message: "Too many supplier fetches. Wait before trying again.",
    },
  },
);
