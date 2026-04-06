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

  it("extracts a higher public compare-at price when a guest discount is present", async () => {
    const { extractCompetitorPagePricingFromHtml } = await loadModule();
    const html = `
      <html>
        <head>
          <meta itemprop="price" content="71.99">
          <script type="application/ld+json">
            {"offers":{"price":"71.99","highPrice":"89.99"}}
          </script>
        </head>
        <body></body>
      </html>
    `;

    expect(extractCompetitorPagePricingFromHtml(html)).toEqual({
      priceCents: 7199,
      compareAtCents: 8999,
    });
  });

  it("supports labeled public compare-at prices in German markup", async () => {
    const { extractCompetitorPagePricingFromHtml } = await loadModule();
    const html = `
      <html>
        <head><meta itemprop="price" content="71,99"></head>
        <body><span>Statt 89,99 €</span></body>
      </html>
    `;

    expect(extractCompetitorPagePricingFromHtml(html)).toEqual({
      priceCents: 7199,
      compareAtCents: 8999,
    });
  });
});
