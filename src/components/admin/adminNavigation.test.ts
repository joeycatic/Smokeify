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

    expect(workspaceIds).toContain("overview");
    expect(workspaceIds).toContain("catalog");
    expect(workspaceIds).toContain("orders");
    expect(workspaceIds).toContain("customers");
    expect(workspaceIds).not.toContain("finance");
    expect(workspaces.find((workspace) => workspace.id === "system")?.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/admin/alerts" })]),
    );
    expect(workspaces.find((workspace) => workspace.id === "system")?.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/admin/page-previews" })]),
    );
    expect(workspaces.find((workspace) => workspace.id === "system")?.items).not.toEqual(
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

    expect(workspace?.id).toBe("finance");
    expect(item?.label).toBe("Pricing");
  });

  it("exposes page previews in the system workspace", () => {
    const workspaces = getVisibleAdminWorkspaces("ADMIN");
    const workspace = getActiveAdminWorkspace("/admin/page-previews", workspaces);
    const item = getActiveAdminNavItem("/admin/page-previews", workspaces, workspace);

    expect(workspace?.id).toBe("system");
    expect(item?.label).toBe("Page Previews");
  });

  it("assigns every route to exactly one workspace", () => {
    const workspaces = getVisibleAdminWorkspaces("ADMIN");
    const hrefs = workspaces.flatMap((workspace) => workspace.items.map((item) => item.href));

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/admin/returns");
    expect(hrefs).toContain("/admin/analyzer");
    expect(hrefs).toContain("/admin/recommendations");
  });

  it.each([
    ["/admin/orders/order_123", "orders", "Order Detail"],
    ["/admin/procurement/po_123", "orders", "Purchase Order"],
    ["/admin/catalog/product_123", "catalog", "Product Detail"],
    ["/admin/compliance/product_123", "catalog", "Compliance Detail"],
    ["/admin/users/user_123", "system", "User Detail"],
  ])("keeps %s in its parent workspace", (pathname, workspaceId, title) => {
    const workspaces = getVisibleAdminWorkspaces("ADMIN");

    expect(getActiveAdminWorkspace(pathname, workspaces)?.id).toBe(workspaceId);
    expect(getAdminHiddenRouteTitle(pathname)).toBe(title);
  });
});
