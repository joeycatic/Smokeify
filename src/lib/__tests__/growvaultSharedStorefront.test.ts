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
        actionLabel: "Open Growvault diagnostics",
        category: "catalog",
        owner: "smokeify",
        affectedCount: 3,
        impact: "Catalog is not current.",
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

  it("keeps diagnostics metadata available for the Growvault operator view", () => {
    const alert = buildGrowvaultDiagnosticAlerts([
      {
        key: "smokeify.growvault.assignment.category_required",
        status: "warn",
        summary: "Two products need category assignment.",
        updatedAt: "2026-04-21T00:00:00.000Z",
        source: "smokeify",
        actionUrl: "https://www.smokeify.de/admin/catalog?storefront=GROW",
        actionLabel: "Fix category assignment",
        category: "catalog",
        owner: "smokeify",
        affectedCount: 2,
        impact: "Products without Grow categories are hard to discover.",
      },
    ])[0];

    expect(alert?.detail).toContain("Two products");
    expect(alert?.href).toBe("/admin/growvault");
  });

  it("keeps the shared contract version stable", () => {
    expect(SHARED_STOREFRONT_CONTRACT_VERSION).toBe("2026-04-21");
  });
});
