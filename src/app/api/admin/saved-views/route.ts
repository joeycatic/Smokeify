import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  createAdminSavedView,
  listAdminSavedViews,
  normalizeAdminSavedViewFilters,
} from "@/lib/adminSavedViews";

export const GET = withAdminRoute(async ({ request, session }) => {
  const url = new URL(request.url);
  const views = await listAdminSavedViews({
    actor: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
    route: url.searchParams.get("route"),
  });

  return adminJson({ views });
});

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      route?: string;
      label?: string;
      filters?: Record<string, unknown>;
      storefrontScope?: string | null;
      pinned?: boolean;
    };

    try {
      const view = await createAdminSavedView({
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
        route: body.route ?? "",
        label: body.label ?? "",
        filters: normalizeAdminSavedViewFilters(body.filters),
        storefrontScope: body.storefrontScope ?? null,
        pinned: body.pinned,
      });

      return adminJson({ view }, { status: 201 });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to save view." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-saved-view-create",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    },
  },
);
