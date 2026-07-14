import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Smokeify storefront parity contracts", () => {
  it("uses MAIN landing-page merchandising and catalog-driven fallbacks", () => {
    const homepage = source("src/app/page.tsx");
    const landingConfig = source("src/lib/landingPageConfig.ts");
    const tentProducts = source("src/lib/growTentHotspotProducts.ts");
    const hero = source("src/components/landing/HeroSection.tsx");

    expect(homepage).toContain('resolveLandingPageProductSections("MAIN"');
    expect(homepage).toContain("getNavbarCategories()");
    expect(homepage).toContain("getGrowTentHotspotProducts()");
    expect(hero).toContain("GrowTentViewerLoader");
    expect(tentProducts).toContain('buildStorefrontProductWhere("MAIN"');
    expect(tentProducts).not.toContain("diamondbox-sl-60");
    expect(landingConfig).toContain("getProductsByIdsForStorefront(allIds, storefront)");
    expect(landingConfig).not.toContain("diamondbox-sl-60");
    expect(landingConfig).not.toContain("lux-helios-pro-300-watt-2-8");
  });

  it("keeps every public product lookup surface active and MAIN-only", () => {
    const catalog = source("src/lib/catalog.ts");
    const search = source("src/app/api/search/route.ts");
    const variants = source("src/app/api/products/[id]/variants/route.ts");
    const recommendations = source("src/app/api/recommendations/route.ts");
    const sitemap = source("src/app/sitemap.ts");
    const wishlist = source("src/app/api/wishlist/route.ts");

    expect(catalog).toContain('product.status !== "ACTIVE"');
    expect(catalog).toContain("!storefrontsInclude(product.storefronts, MAIN_STOREFRONT)");
    expect(search).toContain('storefronts: { has: MAIN_STOREFRONT }');
    expect(variants).toContain('storefronts: { has: "MAIN" }');
    expect(recommendations).toContain('storefront: "MAIN"');
    expect(sitemap).toContain('where: { status: "ACTIVE", storefronts: { has: "MAIN" } }');
    expect(wishlist).toContain("getProductsByIds(body.ids)");
  });

  it("routes GrowVault-owned tools and guides to their canonical deployment", () => {
    for (const path of [
      "src/app/customizer/page.tsx",
      "src/app/pflanzen-analyse/page.tsx",
      "src/app/pflanzen-analyzer/page.tsx",
      "src/app/blog/page.tsx",
      "src/app/blog/[slug]/page.tsx",
    ]) {
      const route = source(path);
      expect(route).toContain("redirect(");
      expect(route).toContain("serializeForwardedSearchParams");
    }
  });

  it("keeps the recently viewed strip on the light storefront theme", () => {
    const recentlyViewed = source("src/components/RecentlyViewedStrip.tsx");

    expect(recentlyViewed).toContain("var(--gv-dark)");
    expect(recentlyViewed).toContain("Verlauf");
    expect(recentlyViewed).toContain("bg-white");
    expect(recentlyViewed).not.toContain("rgba(27,23,20");
    expect(recentlyViewed).not.toContain("rgba(14,14,13");
  });
});
