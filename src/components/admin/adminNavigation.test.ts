import { describe, expect, it } from "vitest";
import {
  getActiveAdminNavItem,
  getActiveAdminWorkspace,
  getAdminHiddenRouteTitle,
  getVisibleAdminWorkspaces,
  isAdminNavItemActive,
} from "@/components/admin/adminNavigation";

describe("adminNavigation", () => {
  it("filters workspace items by admin role scopes", () => {
    const workspaces = getVisibleAdminWorkspaces("STAFF");
    const workspaceIds = workspaces.map((workspace) => workspace.id);

    expect(workspaceIds).toContain("dashboard");
    expect(workspaceIds).toContain("catalog");
    expect(workspaceIds).toContain("orders");
    expect(workspaceIds).toContain("customers");
    expect(workspaceIds).not.toContain("finance");
    expect(workspaces.find((workspace) => workspace.id === "action-center")?.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/admin/alerts" })]),
    );
    expect(workspaces.find((workspace) => workspace.id === "action-center")?.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/admin/scripts" })]),
    );
  });

  it("keeps catalog hygiene distinct from the catalog root active state", () => {
    const workspaces = getVisibleAdminWorkspaces("ADMIN");
    const catalog = workspaces.find((workspace) => workspace.id === "catalog");
    const catalogRoot = catalog?.items.find((item) => item.href === "/admin/catalog");
    const hygiene = catalog?.items.find((item) => item.href === "/admin/catalog/hygiene");

    expect(catalogRoot).toBeDefined();
    expect(hygiene).toBeDefined();
    expect(isAdminNavItemActive("/admin/catalog/hygiene", catalogRoot!)).toBe(false);
    expect(isAdminNavItemActive("/admin/catalog/hygiene", hygiene!)).toBe(true);
    expect(getAdminHiddenRouteTitle("/admin/catalog/hygiene")).toBeNull();
    expect(getAdminHiddenRouteTitle("/admin/catalog/product_123")).toBe("Product Detail");
  });

  it("resolves active workspace and item from the current admin path", () => {
    const workspaces = getVisibleAdminWorkspaces("ADMIN");
    const workspace = getActiveAdminWorkspace("/admin/pricing", workspaces);
    const item = getActiveAdminNavItem("/admin/pricing", workspaces, workspace);

    expect(workspace?.id).toBe("growth");
    expect(item?.label).toBe("Pricing");
  });
});
