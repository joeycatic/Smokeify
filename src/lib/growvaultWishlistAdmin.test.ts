import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/growvaultAnalyzerAdminBridge", () => ({
  fetchGrowvaultAnalyzerAdminJson: vi.fn(),
}));

describe("growvaultWishlistAdmin", () => {
  it("returns analytics when the Growvault bridge succeeds", async () => {
    const { fetchGrowvaultAnalyzerAdminJson } = await import(
      "@/lib/growvaultAnalyzerAdminBridge"
    );
    vi.mocked(fetchGrowvaultAnalyzerAdminJson).mockResolvedValueOnce({
      ok: true,
      status: 200,
      targetUrl: "https://growvault.de",
      payload: {
        generatedAt: "2026-05-28T00:00:00.000Z",
        window: {
          days: 30,
          startsAt: "2026-04-29T00:00:00.000Z",
        },
        summary: {
          activeWishlistItems: 12,
          activeWishlistUsers: 4,
          activeWishlistProducts: 8,
          addEvents: 20,
          removeEvents: 5,
          uniqueActors: 4,
          avgWishlistSize: 3,
          largestWishlistSize: 6,
        },
        topProducts: [],
        topUsers: [],
        recentActivity: [],
      },
    });

    const { getGrowvaultWishlistAdminAnalytics } = await import(
      "@/lib/growvaultWishlistAdmin"
    );
    const response = await getGrowvaultWishlistAdminAnalytics(30);

    expect(response).toMatchObject({
      ok: true,
      error: null,
      targetUrl: "https://growvault.de",
      analytics: {
        summary: {
          activeWishlistItems: 12,
        },
      },
    });
  });

  it("returns a safe fallback when the Growvault bridge fails", async () => {
    const { fetchGrowvaultAnalyzerAdminJson } = await import(
      "@/lib/growvaultAnalyzerAdminBridge"
    );
    vi.mocked(fetchGrowvaultAnalyzerAdminJson).mockResolvedValueOnce({
      ok: false,
      status: 503,
      targetUrl: "https://growvault.de",
      payload: { error: "Unavailable" },
    });

    const { getGrowvaultWishlistAdminAnalytics } = await import(
      "@/lib/growvaultWishlistAdmin"
    );
    const response = await getGrowvaultWishlistAdminAnalytics(90);

    expect(response).toMatchObject({
      ok: false,
      error: "Unavailable",
      targetUrl: "https://growvault.de",
      analytics: {
        summary: {
          activeWishlistItems: 0,
        },
      },
    });
  });
});
