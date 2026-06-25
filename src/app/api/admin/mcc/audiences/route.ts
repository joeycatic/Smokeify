import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  createMccAudience,
  listMccAudiences,
  parseMccScope,
  previewMccAudience,
} from "@/lib/adminMcc";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = request.nextUrl;
  const scope = parseMccScope(searchParams.get("storefront"));
  const filters = searchParams.get("filters");
  if (filters) {
    const parsedFilters = JSON.parse(filters);
    const contacts = await previewMccAudience({ storefront: scope, filters: parsedFilters });
    return adminJson({
      count: contacts.length,
      recipients: contacts.slice(0, 20),
    });
  }
  return adminJson(await listMccAudiences(scope));
});

export const POST = withAdminRoute(async ({ request, session }) => {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    storefront?: string;
    filters?: unknown;
  };
  try {
    const audience = await createMccAudience({
      name: body.name ?? "",
      description: body.description,
      storefront: body.storefront,
      filters: body.filters,
      actor: session.user,
    });
    return adminJson({ ok: true, audience });
  } catch (error) {
    return adminJson(
      { error: error instanceof Error ? error.message : "Audience save failed." },
      { status: 400 },
    );
  }
});
