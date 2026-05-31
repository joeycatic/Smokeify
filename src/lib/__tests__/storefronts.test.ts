import { describe, expect, it } from "vitest";
import { adminPathSupportsStorefrontScope } from "@/lib/storefronts";

describe("storefront admin scope routing", () => {
  it("enables the scope switch on V1-safe storefront-aware admin routes", () => {
    expect(adminPathSupportsStorefrontScope("/admin/analytics")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/catalog")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/catalog/hygiene")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/catalog/product_123")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/customers")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/email-testing")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/finance")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/landing-page")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/orders")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/reports")).toBe(true);
    expect(adminPathSupportsStorefrontScope("/admin/reviews")).toBe(true);
  });

  it("keeps the scope switch hidden on unsupported or storefront-dashboard routes", () => {
    expect(adminPathSupportsStorefrontScope("/admin")).toBe(false);
    expect(adminPathSupportsStorefrontScope("/admin/smokeify")).toBe(false);
    expect(adminPathSupportsStorefrontScope("/admin/growvault")).toBe(false);
    expect(adminPathSupportsStorefrontScope("/admin/pricing")).toBe(false);
    expect(adminPathSupportsStorefrontScope("/admin/returns")).toBe(false);
    expect(adminPathSupportsStorefrontScope("/admin/support")).toBe(false);
  });
});
