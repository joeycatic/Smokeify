import { describe, expect, it } from "vitest";
import { SMOKEIFY_ROUTES } from "@/config/smokeify-routes";
import {
  buildProductsSearchParams,
  filtersFromProductsUrlState,
  hasProductsUrlState,
  parseProductUrlCsv,
  parseProductsUrlState,
} from "@/lib/productsUrlState";
import { buildCategoryHref } from "@/lib/seoPages";
import { parseCustomizerOptionCategories } from "@/lib/customizerRequest";
import { validatePlantAnalyzerImageMeta } from "@/lib/plantAnalyzerRequestValidation";

describe("Smokeify storefront revamp helpers", () => {
  it("keeps public route constants local to Smokeify", () => {
    expect(SMOKEIFY_ROUTES.customizer).toBe("/customizer");
    expect(SMOKEIFY_ROUTES.analyzer).toBe("/pflanzen-analyse");
    expect(Object.values(SMOKEIFY_ROUTES).every((route) => route.startsWith("/"))).toBe(true);
  });

  it("round-trips product URL state without noisy defaults", () => {
    const state = parseProductsUrlState(
      new URLSearchParams(
        "category=licht&categories=zelte,licht&manufacturer=AC%20Infinity&priceMin=40&priceMax=250&searchQuery=led&sortBy=price_asc&view=list",
      ),
    );

    expect(state.categories).toEqual(["zelte", "licht"]);
    expect(state.sortBy).toBe("price_asc");
    expect(state.view).toBe("list");
    expect(hasProductsUrlState(new URLSearchParams("searchQuery=led"))).toBe(true);
    expect(parseProductUrlCsv("a, b,,a")).toEqual(["a", "b", "a"]);

    const filters = filtersFromProductsUrlState(state, {
      priceMinBound: 0,
      priceMaxBound: 500,
    });
    const params = buildProductsSearchParams({
      filters,
      sortBy: state.sortBy,
      view: state.view,
      priceMinBound: 0,
      priceMaxBound: 500,
    });

    expect(params.get("categories")).toBe("licht,zelte");
    expect(params.get("manufacturer")).toBe("AC Infinity");
    expect(params.get("sortBy")).toBe("price_asc");
    expect(params.get("view")).toBe("list");
  });

  it("builds SEO/category aliases consistently", () => {
    expect(buildCategoryHref("licht")).toBe("/licht");
    expect(buildCategoryHref("sets", { parentHandle: "luft" })).toBe("/luft/sets");
  });

  it("sanitizes customizer option categories", () => {
    expect(parseCustomizerOptionCategories("zelte,evil,LICHT")).toEqual([
      "zelte",
      "licht",
    ]);
    expect(parseCustomizerOptionCategories("evil")).toEqual([
      "zelte",
      "licht",
      "luft",
      "bewaesserung",
      "anzucht",
    ]);
  });

  it("validates analyzer image uploads before model execution", () => {
    expect(
      validatePlantAnalyzerImageMeta({
        mimeType: "image/png",
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: true });
    expect(
      validatePlantAnalyzerImageMeta({
        mimeType: "image/gif",
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: false, code: "UNSUPPORTED_IMAGE_TYPE" });
    expect(
      validatePlantAnalyzerImageMeta({
        mimeType: "image/jpeg",
        sizeBytes: 8 * 1024 * 1024,
      }),
    ).toEqual({ ok: false, code: "IMAGE_TOO_LARGE" });
  });
});
