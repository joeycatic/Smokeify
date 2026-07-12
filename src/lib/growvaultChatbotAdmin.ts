import "server-only";

import type { AdminTimeRangeDays } from "@/lib/adminTimeRange";
import { fetchGrowvaultAnalyzerAdminJson } from "@/lib/growvaultAnalyzerAdminBridge";

export type GrowvaultChatbotAnalytics = {
  generatedAt: string;
  window: { days: number; startsAt: string };
  summary: { opened: number; messages: number; responses: number; errors: number; cardClicks: number };
  topIntents: Array<{ intent: string; count: number }>;
};

const EMPTY_ANALYTICS: GrowvaultChatbotAnalytics = {
  generatedAt: new Date(0).toISOString(),
  window: { days: 30, startsAt: new Date(0).toISOString() },
  summary: { opened: 0, messages: 0, responses: 0, errors: 0, cardClicks: 0 },
  topIntents: [],
};

export async function getGrowvaultChatbotAnalytics(days: AdminTimeRangeDays) {
  try {
    const bridge = await fetchGrowvaultAnalyzerAdminJson<GrowvaultChatbotAnalytics>(
      "/api/internal/admin/chatbot/analytics",
      `days=${days}`,
    );
    if (!bridge?.ok || !bridge.payload) {
      return {
        ok: false,
        analytics: EMPTY_ANALYTICS,
        error: bridge?.payload && "error" in bridge.payload ? bridge.payload.error : "GrowVault chatbot analytics unavailable.",
      };
    }
    return { ok: true, analytics: bridge.payload, error: null };
  } catch (error) {
    return {
      ok: false,
      analytics: EMPTY_ANALYTICS,
      error: error instanceof Error ? error.message : "GrowVault chatbot analytics unavailable.",
    };
  }
}
