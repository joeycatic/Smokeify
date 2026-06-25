import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  createMccCampaignDraft,
  launchMccCampaign,
  listMccCampaigns,
  parseMccScope,
  previewMccCampaignRecipients,
  sendMccCampaignTest,
} from "@/lib/adminMcc";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = request.nextUrl;
  const scope = parseMccScope(searchParams.get("storefront"));
  const previewCampaignId = searchParams.get("campaignId");
  if (previewCampaignId) {
    return adminJson(await previewMccCampaignRecipients(previewCampaignId));
  }
  return adminJson(await listMccCampaigns(scope));
});

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: "draft" | "test" | "launch";
      campaignId?: string;
      recipient?: string;
      confirm?: boolean;
      name?: string;
      storefront?: string;
      audienceId?: string;
      subject?: string;
      body?: string;
    };

    try {
      if (body.action === "test") {
        return adminJson(
          await sendMccCampaignTest({
            campaignId: body.campaignId ?? "",
            recipient: body.recipient ?? "",
            actor: session.user,
          }),
        );
      }
      if (body.action === "launch") {
        return adminJson(
          await launchMccCampaign({
            campaignId: body.campaignId ?? "",
            confirm: body.confirm === true,
            actor: session.user,
          }),
        );
      }

      const campaign = await createMccCampaignDraft({
        name: body.name ?? "",
        storefront: body.storefront,
        audienceId: body.audienceId,
        subject: body.subject,
        body: body.body,
        actor: session.user,
      });
      return adminJson({ ok: true, campaign });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Campaign action failed." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-mcc-campaigns",
      limit: 8,
      windowMs: 10 * 60 * 1000,
      message: "Too many MCC campaign actions. Please try again later.",
    },
  },
);
