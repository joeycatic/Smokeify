import { type NextRequest } from "next/server";
import { adminJson } from "@/lib/adminApi";
import type { PricingRunMode } from "@/lib/adminPricingIntegration";
import { runAdminPricingAutomation } from "@/lib/adminPricingServer";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: PricingRunMode;
      limit?: number;
      notes?: string | null;
      refreshPublicCompetitorData?: boolean;
      marketReportPath?: string | null;
    };
    const runNotes = typeof body.notes === "string" ? body.notes.trim() : "";
    if ((body.mode ?? "APPLY") !== "PREVIEW" && !runNotes) {
      return adminJson(
        { error: "Freigabe-Läufe benötigen eine Begründung." },
        { status: 400 },
      );
    }

    try {
      const result = await runAdminPricingAutomation(
        {
          mode: body.mode === "PREVIEW" ? "PREVIEW" : "APPLY",
          limit:
            typeof body.limit === "number" &&
            Number.isFinite(body.limit) &&
            body.limit > 0
              ? Math.floor(body.limit)
              : undefined,
          notes: runNotes || null,
          refreshPublicCompetitorData: body.refreshPublicCompetitorData !== false,
          marketReportPath:
            typeof body.marketReportPath === "string" ? body.marketReportPath : null,
        },
        {
          actor: {
            id: session.user.id,
            email: session.user.email ?? null,
          },
        },
      );

      return adminJson(result);
    } catch (error) {
      return adminJson(
        {
          error:
            error instanceof Error ? error.message : "Preislauf konnte nicht gestartet werden.",
        },
        { status: 502 },
      );
    }
  },
  {
    action: "pricing.run",
    rateLimit: {
      keyPrefix: "admin-pricing-run",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    },
  },
);
