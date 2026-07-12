import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import { withAdminRoute } from "@/lib/adminRoute";
import {
  getGrowvaultChatbotConfig,
  updateGrowvaultChatbotConfig,
} from "@/lib/growvaultChatbot";

export const GET = withAdminRoute(
  async () => adminJson({ config: await getGrowvaultChatbotConfig() }),
  { scope: "analytics.read" },
);

export const PATCH = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const config = await updateGrowvaultChatbotConfig({
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.accountActionsEnabled === "boolean"
        ? { accountActionsEnabled: body.accountActionsEnabled }
        : {}),
    });
    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "growvault.chatbot.config.update",
      targetType: "growth_config",
      targetId: config.key,
      summary: `Updated GrowVault chatbot: ${config.enabled ? "enabled" : "disabled"}`,
      metadata: {
        enabled: config.enabled,
        accountActionsEnabled:
          config.payload && typeof config.payload === "object" && !Array.isArray(config.payload)
            ? (config.payload as Record<string, unknown>).accountActionsEnabled === true
            : false,
      },
    });
    return adminJson({ ok: true, config: await getGrowvaultChatbotConfig() });
  },
  { scope: "ops.write" },
);
