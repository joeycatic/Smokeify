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

  it("extracts a higher public compare-at price when explicit old-price markup is present", async () => {
    const { extractCompetitorPagePricingFromHtml } = await loadModule();
    const html = `
      <html>
        <head>
          <meta itemprop="price" content="71.99">
        </head>
        <body><span class="old-price">89,99 €</span></body>
      </html>
    `;

    expect(extractCompetitorPagePricingFromHtml(html)).toEqual({
      priceCents: 7199,
      compareAtCents: 8999,
    });
  });

  it("ignores unrelated itemprop price tags from recommendation sliders", async () => {
    const { extractCompetitorPagePricingFromHtml } = await loadModule();
    const html = `
      <html>
        <head>
          <meta itemprop="price" content="5.90">
        </head>
        <body>
          <div class="item-slider-price">
            <meta itemprop="price" content="129.90">
            <strong>129,90 €</strong>
          </div>
        </body>
      </html>
    `;

    expect(extractCompetitorPagePricingFromHtml(html)).toEqual({
      priceCents: 590,
      compareAtCents: null,
    });
  });

  it("ignores old-price markup that appears outside the main product price context", async () => {
    const { extractCompetitorPagePricingFromHtml } = await loadModule();
    const html = `
      <html>
        <head><meta itemprop="price" content="5.90"></head>
        <body>
          <div>${"x".repeat(5000)}</div>
          <div class="item-slider-price">
            <strong class="price text-nowrap">
              <del class="old-price">22,90 €</del>
              <span>20,61 €</span>
            </strong>
          </div>
        </body>
      </html>
    `;

    expect(extractCompetitorPagePricingFromHtml(html)).toEqual({
      priceCents: 590,
      compareAtCents: null,
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
