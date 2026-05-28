import "server-only";

import { fetchGrowvaultAnalyzerAdminJson } from "@/lib/growvaultAnalyzerAdminBridge";
import type { AdminTimeRangeDays } from "@/lib/adminTimeRange";

export type GrowvaultWishlistAdminAnalytics = {
  generatedAt: string;
  window: {
    days: number;
    startsAt: string;
  };
  summary: {
    activeWishlistItems: number;
    activeWishlistUsers: number;
    activeWishlistProducts: number;
    addEvents: number;
    removeEvents: number;
    uniqueActors: number;
    avgWishlistSize: number;
    largestWishlistSize: number;
  };
  topProducts: Array<{
    productId: string;
    title: string;
    handle: string | null;
    currentWishlists: number;
    addEvents: number;
    removeEvents: number;
    netEvents: number;
    lastActivityAt: string | null;
  }>;
  topUsers: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    currentWishlistItems: number;
    addEvents: number;
    removeEvents: number;
    netEvents: number;
    lastActivityAt: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    userId: string;
    name: string | null;
    email: string | null;
    productId: string;
    productTitle: string;
    productHandle: string | null;
    action: "ADD" | "REMOVE";
    source: string;
    createdAt: string;
  }>;
};

const emptyWishlistAnalytics: GrowvaultWishlistAdminAnalytics = {
  generatedAt: new Date(0).toISOString(),
  window: {
    days: 30,
    startsAt: new Date(0).toISOString(),
  },
  summary: {
    activeWishlistItems: 0,
    activeWishlistUsers: 0,
    activeWishlistProducts: 0,
    addEvents: 0,
    removeEvents: 0,
    uniqueActors: 0,
    avgWishlistSize: 0,
    largestWishlistSize: 0,
  },
  topProducts: [],
  topUsers: [],
  recentActivity: [],
};

export async function getGrowvaultWishlistAdminAnalytics(days: AdminTimeRangeDays) {
  try {
    const bridge = await fetchGrowvaultAnalyzerAdminJson<GrowvaultWishlistAdminAnalytics>(
      "/api/internal/admin/wishlist/analytics",
      `days=${days}`,
    );

    if (!bridge?.ok || !bridge.payload) {
      return {
        ok: false,
        analytics: emptyWishlistAnalytics,
        error: bridge?.payload && "error" in bridge.payload ? bridge.payload.error : "Growvault wishlist analytics unavailable.",
        targetUrl: bridge?.targetUrl ?? null,
      };
    }

    return {
      ok: true,
      analytics: bridge.payload,
      error: null,
      targetUrl: bridge.targetUrl,
    };
  } catch (error) {
    return {
      ok: false,
      analytics: emptyWishlistAnalytics,
      error:
        error instanceof Error
          ? error.message
          : "Growvault wishlist analytics unavailable.",
      targetUrl: null,
    };
  }
}
