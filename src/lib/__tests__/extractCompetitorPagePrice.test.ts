import { describe, expect, it } from "vitest";

const loadModule = () =>
  import("../../../scripts/shared/extractCompetitorPagePrice.mjs");

describe("extractCompetitorPagePriceCentsFromHtml", () => {
  it("keeps the scraped page price as-is without adding VAT", async () => {
    const { extractCompetitorPagePriceCentsFromHtml } = await loadModule();
    const html =
      '<html><head><meta itemprop="price" content="71.99"></head><body></body></html>';

    expect(extractCompetitorPagePriceCentsFromHtml(html)).toBe(7199);
  });

  it("supports comma decimals from page markup", async () => {
    const { extractCompetitorPagePriceCentsFromHtml } = await loadModule();
    const html =
      '<html><head><meta itemprop="price" content="71,99"></head><body></body></html>';

    expect(extractCompetitorPagePriceCentsFromHtml(html)).toBe(7199);
  });
});
