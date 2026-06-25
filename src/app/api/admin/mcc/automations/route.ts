import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { listMccAutomations, parseMccScope, upsertMccAutomation } from "@/lib/adminMcc";

export const GET = withAdminRoute(async ({ request }) => {
  const scope = parseMccScope(request.nextUrl.searchParams.get("storefront"));
  return adminJson(await listMccAutomations(scope));
});

export const PATCH = withAdminRoute(async ({ request, session }) => {
  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    name?: string;
    type?: string;
    storefront?: string;
    status?: string;
    config?: unknown;
  };
  try {
    const automation = await upsertMccAutomation({
      key: body.key ?? "",
      name: body.name ?? "",
      type: body.type ?? "CUSTOM",
      storefront: body.storefront,
      status: body.status,
      config: body.config,
      actor: session.user,
    });
    return adminJson({ ok: true, automation });
  } catch (error) {
    return adminJson(
      { error: error instanceof Error ? error.message : "Automation save failed." },
      { status: 400 },
    );
  }
});
