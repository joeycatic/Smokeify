import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { createMccActivity, listMccActivities } from "@/lib/adminMcc";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = request.nextUrl;
  return adminJson(
    await listMccActivities({
      storefront: searchParams.get("storefront"),
      campaignId: searchParams.get("campaignId"),
      audienceId: searchParams.get("audienceId"),
      contactProfileId: searchParams.get("contactProfileId"),
    }),
  );
});

export const POST = withAdminRoute(async ({ request, session }) => {
  const body = (await request.json().catch(() => ({}))) as {
    storefront?: string;
    contactProfileId?: string;
    campaignId?: string;
    audienceId?: string;
    activityType?: string;
    title?: string;
    summary?: string;
    dueAt?: string;
  };
  try {
    const activity = await createMccActivity({
      storefront: body.storefront,
      contactProfileId: body.contactProfileId,
      campaignId: body.campaignId,
      audienceId: body.audienceId,
      activityType: body.activityType,
      title: body.title ?? "",
      summary: body.summary,
      dueAt: body.dueAt,
      actor: session.user,
    });
    return adminJson({ ok: true, activity });
  } catch (error) {
    return adminJson(
      { error: error instanceof Error ? error.message : "Activity save failed." },
      { status: 400 },
    );
  }
});
