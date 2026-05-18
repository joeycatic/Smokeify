import { describe, expect, it } from "vitest";
import { filterAdminCommandActions } from "@/lib/adminCommandActions";

describe("adminCommandActions", () => {
  it("filters actions by available routes", () => {
    const actions = filterAdminCommandActions({
      query: "support",
      availableHrefs: new Set(["/admin/support"]),
    });

    expect(actions.map((action) => action.id)).toContain("create-support-case");
    expect(actions.map((action) => action.id)).not.toContain("open-compliance-queue");
  });

  it("shows open-order action only for numeric queries", () => {
    expect(
      filterAdminCommandActions({
        query: "10023",
        availableHrefs: new Set(["/admin/orders"]),
      }).map((action) => action.id),
    ).toContain("open-order-number");

    expect(
      filterAdminCommandActions({
        query: "orders",
        availableHrefs: new Set(["/admin/orders"]),
      }).map((action) => action.id),
    ).not.toContain("open-order-number");
  });
});
