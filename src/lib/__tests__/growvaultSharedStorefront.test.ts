import { describe, expect, it, vi } from "vitest";
import {
  SHARED_STOREFRONT_CONTRACT_VERSION,
  buildGrowvaultDiagnosticAlerts,
} from "@/lib/growvaultSharedStorefront";

vi.mock("server-only", () => ({}));

describe("growvaultSharedStorefront", () => {
  it("builds Growvault alert rows from failing statuses", () => {
    const alerts = buildGrowvaultDiagnosticAlerts([
      {
        key: "smokeify.growvault.catalog.freshness",
        status: "fail",
        summary: "Catalog is stale.",
        updatedAt: "2026-04-21T00:00:00.000Z",
        source: "smokeify",
        actionUrl: "https://www.smokeify.de/admin/growvault",
      },
      {
        key: "smokeify.growvault.discount.integrity",
        status: "ok",
        summary: "Discounts are configured.",
        updatedAt: "2026-04-21T00:00:00.000Z",
        source: "smokeify",
      },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.href).toBe("/admin/growvault");
    expect(alerts[0]?.priority).toBe("high");
  });

  it("keeps the shared contract version stable", () => {
    expect(SHARED_STOREFRONT_CONTRACT_VERSION).toBe("2026-04-21");
  });
});
