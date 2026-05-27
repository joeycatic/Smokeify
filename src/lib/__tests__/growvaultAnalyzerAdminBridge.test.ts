import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXT_PUBLIC_GROWVAULT_APP_URL: process.env.NEXT_PUBLIC_GROWVAULT_APP_URL,
  GROWVAULT_APP_URL: process.env.GROWVAULT_APP_URL,
  NEXT_PUBLIC_GROW_APP_URL: process.env.NEXT_PUBLIC_GROW_APP_URL,
  GROW_APP_URL: process.env.GROW_APP_URL,
  GROWVAULT_ADMIN_BRIDGE_URL: process.env.GROWVAULT_ADMIN_BRIDGE_URL,
  INTERNAL_GROWVAULT_APP_URL: process.env.INTERNAL_GROWVAULT_APP_URL,
};

async function loadBridgeModule() {
  vi.resetModules();
  return import("@/lib/growvaultAnalyzerAdminBridge");
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

describe("growvaultAnalyzerAdminBridge", () => {
  it("prefers the local Growvault app in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXTAUTH_SECRET = "obama420";
    delete process.env.GROWVAULT_ADMIN_BRIDGE_URL;
    delete process.env.INTERNAL_GROWVAULT_APP_URL;
    delete process.env.NEXT_PUBLIC_GROWVAULT_APP_URL;
    delete process.env.GROWVAULT_APP_URL;
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.de";

    const bridgeModule = await loadBridgeModule();

    expect(bridgeModule.hasGrowvaultAnalyzerAdminBridge()).toBe(true);
    expect(bridgeModule.getGrowvaultAnalyzerAdminBridgeTarget()).toBe("http://127.0.0.1:3000");
  });

  it("falls back to the public Growvault app when the local dev target is unavailable", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXTAUTH_SECRET = "obama420";
    delete process.env.GROWVAULT_ADMIN_BRIDGE_URL;
    delete process.env.INTERNAL_GROWVAULT_APP_URL;
    delete process.env.NEXT_PUBLIC_GROWVAULT_APP_URL;
    delete process.env.GROWVAULT_APP_URL;
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.de";

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:3000"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ repairedCount: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const bridgeModule = await loadBridgeModule();
    const response = await bridgeModule.fetchGrowvaultAnalyzerAdminJson<{
      repairedCount: number;
    }>("/api/internal/admin/analyzer/publications/backfill", "", { method: "POST" });

    expect(response).toMatchObject({
      ok: true,
      status: 200,
      payload: { repairedCount: 0 },
      targetUrl: "https://growvault.de",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
