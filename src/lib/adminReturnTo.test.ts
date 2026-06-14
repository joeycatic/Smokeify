import { describe, expect, it } from "vitest";
import {
  buildAdminLoginPath,
  buildAdminReturnTo,
  sanitizeAdminReturnTo,
} from "@/lib/adminReturnTo";

describe("admin return targets", () => {
  it("preserves admin paths with query strings", () => {
    expect(buildAdminReturnTo("/admin/orders", "?storefront=ALL")).toBe(
      "/admin/orders?storefront=ALL",
    );
    expect(buildAdminLoginPath("/admin/orders?storefront=ALL")).toBe(
      "/auth/admin?returnTo=%2Fadmin%2Forders%3Fstorefront%3DALL",
    );
  });

  it("falls back for external or malformed targets", () => {
    expect(sanitizeAdminReturnTo("https://example.com/admin")).toBe("/admin");
    expect(sanitizeAdminReturnTo("//example.com/admin")).toBe("/admin");
    expect(buildAdminReturnTo("admin/orders", "?storefront=ALL")).toBe(
      "/admin?storefront=ALL",
    );
  });
});
