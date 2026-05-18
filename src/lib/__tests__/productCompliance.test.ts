import { describe, expect, it } from "vitest";
import {
  approvalRequiresOverride,
  canExposeProductOnSurface,
  collectProductComplianceBlockers,
  getProductComplianceEligibility,
} from "@/lib/productCompliance";

const growCategory = {
  handle: "zelte",
  storefronts: ["GROW"],
};

const baseProduct = {
  title: "Homebox Ambient Q100",
  handle: "homebox-ambient-q100",
  storefronts: ["GROW"],
  complianceStatus: "APPROVED" as const,
  complianceFeedEligible: true,
  complianceAdsEligible: true,
  merchantCertificationAuthority: "Manufacturer",
  mainCategory: growCategory,
  categories: [{ category: growCategory }],
};

describe("productCompliance", () => {
  it("allows an approved product on storefront and feed surfaces", () => {
    expect(
      canExposeProductOnSurface(baseProduct, {
        storefront: "GROW",
        surface: "STOREFRONT",
        country: "DE",
      }),
    ).toBe(true);

    expect(
      canExposeProductOnSurface(baseProduct, {
        storefront: "GROW",
        surface: "FEED",
        country: "DE",
      }),
    ).toBe(true);
  });

  it("blocks draft review products", () => {
    const result = getProductComplianceEligibility(
      { ...baseProduct, complianceStatus: "DRAFT_REVIEW" },
      { storefront: "GROW", surface: "STOREFRONT" },
    );

    expect(result.allowed).toBe(false);
    expect(result.blockers.some((blocker) => blocker.field === "complianceStatus")).toBe(true);
  });

  it("requires feed and ads eligibility for those surfaces", () => {
    expect(
      canExposeProductOnSurface(
        { ...baseProduct, complianceFeedEligible: false },
        { storefront: "GROW", surface: "FEED", country: "DE" },
      ),
    ).toBe(false);

    expect(
      canExposeProductOnSurface(
        { ...baseProduct, complianceAdsEligible: false },
        { storefront: "GROW", surface: "ADS", country: "DE" },
      ),
    ).toBe(false);
  });

  it("collects medical and illegal-use text blockers", () => {
    const blockers = collectProductComplianceBlockers({
      ...baseProduct,
      title: "Medical pain relief grow setup",
      shortDescription: "for cannabis",
    });

    expect(blockers.map((blocker) => blocker.type)).toContain("MEDICAL_CLAIM");
    expect(blockers.map((blocker) => blocker.type)).toContain(
      "ILLEGAL_USE_IMPLICATION",
    );
    expect(approvalRequiresOverride({ ...baseProduct, title: "Medical grow setup" })).toBe(
      true,
    );
  });

  it("collects GrowVault restricted category blockers", () => {
    const blockers = collectProductComplianceBlockers({
      ...baseProduct,
      categories: [
        { category: growCategory },
        { category: { handle: "grinder", storefronts: ["MAIN"] } },
      ],
    });

    expect(blockers.map((blocker) => blocker.type)).toContain("RESTRICTED_CATEGORY");
  });

  it("country denylist wins over allowlist", () => {
    const result = getProductComplianceEligibility(
      {
        ...baseProduct,
        complianceCountryAllowlist: ["DE", "AT"],
        complianceCountryDenylist: ["DE"],
      },
      { storefront: "GROW", surface: "STOREFRONT", country: "DE" },
    );

    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.type)).toContain(
      "REGION_RESTRICTION",
    );
  });

  it("requires a known country when an allowlist exists", () => {
    const result = getProductComplianceEligibility(
      {
        ...baseProduct,
        complianceCountryAllowlist: ["DE"],
      },
      { storefront: "GROW", surface: "FEED" },
    );

    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.field)).toContain(
      "complianceCountryAllowlist",
    );
  });
});

