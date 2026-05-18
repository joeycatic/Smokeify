import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  deleteAdminSavedView,
  updateAdminSavedView,
} from "@/lib/adminSavedViews";

export const PATCH = withAdminRoute<{ id: string }>(
  async ({ request, params, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      pinned?: boolean;
    };

    try {
      const view = await updateAdminSavedView({
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
        id: params.id,
        label: body.label,
        pinned: body.pinned,
      });

      return adminJson({ view });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to update saved view." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-saved-view-patch",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
);

export const DELETE = withAdminRoute<{ id: string }>(
  async ({ params, session }) => {
    try {
      await deleteAdminSavedView({
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
        id: params.id,
      });

      return adminJson({ ok: true });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to delete saved view." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-saved-view-delete",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
);
