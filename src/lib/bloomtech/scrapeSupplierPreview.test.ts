import { describe, expect, it } from "vitest";

const loadScraper = () => import("./scrapeSupplierPreview.mjs");

describe("Bloomtech supplier pricing", () => {
  it("extracts the authenticated current price and explicit original price", async () => {
    const { extractBloomtechPricingFromHtml } = await loadScraper();
    const html = `
      <div class="price-row">
        <meta itemprop="price" content="67,23">
        <strong class="price text-nowrap">
          <del class="old-price">84,03 EUR</del>
          <span>67,23 EUR</span>
        </strong>
      </div>
      <div class="discount">Rabatt: <span class="value">20%</span></div>
    `;

    expect(extractBloomtechPricingFromHtml(html)).toEqual({
      currentNetCents: 6723,
      compareAtNetCents: 8403,
      discounted: true,
      discountPercent: 20,
    });
  });

  it("does not treat a crossed-out manufacturer recommendation as a discount", async () => {
    const { extractBloomtechPricingFromHtml } = await loadScraper();
    const html = `
      <div class="price-row">
        <meta itemprop="price" content="67.23">
        <strong class="price text-nowrap">
          <del class="old-price">84.03 EUR</del>
          <span>67.23 EUR</span>
        </strong>
      </div>
      <div class="suggested-price">
        Unverbindliche Preisempfehlung des Herstellers: 84.03 EUR
      </div>
      <div class="discount">Rabatt: <span class="value">10%</span></div>
    `;

    expect(extractBloomtechPricingFromHtml(html)).toEqual({
      currentNetCents: 6723,
      compareAtNetCents: null,
      discounted: false,
      discountPercent: null,
    });
  });

  it("ignores discount markers belonging to recommended products", async () => {
    const { extractBloomtechPricingFromHtml } = await loadScraper();
    const html = `
      <meta itemprop="price" content="67.23">
      <div class="suggested-price">UVP: 84.03 EUR</div>
      ${"x".repeat(2500)}
      <div class="discount">Rabatt: <span>15%</span></div>
      <del class="old-price">99.00 EUR</del>
    `;

    expect(extractBloomtechPricingFromHtml(html)).toEqual({
      currentNetCents: 6723,
      compareAtNetCents: null,
      discounted: false,
      discountPercent: null,
    });
  });

  it("rejects a crossed-out price when it does not match the stated discount", async () => {
    const { extractBloomtechPricingFromHtml } = await loadScraper();
    const pricing = extractBloomtechPricingFromHtml(`
      <meta itemprop="price" content="80.00">
      <strong class="price"><del class="old-price">200,00 €</del></strong>
      <div class="discount">Rabatt: <span class="value">5%</span></div>
    `);

    expect(pricing).toEqual({
      currentNetCents: 8000,
      compareAtNetCents: null,
      discounted: false,
      discountPercent: null,
    });
  });
});

describe("Bloomtech supplier images", () => {
  it("extracts every full-size image from the product gallery", async () => {
    const { extractSupplierImagesFromHtml } = await loadScraper();
    const html = `
      <div id="gallery">
        <div class="inner">
          <a data-href="/media/image/product/123/lg/example.jpg">
            <div class="img-ct" data-src="/media/image/product/123/lg/example.jpg">
              <img
                class="product-image"
                data-big="/media/image/product/123/lg/example.jpg"
                data-big-webp="/media/image/product/123/lg/example.webp"
                data-index="0"
              >
            </div>
          </a>
          <a data-href="/media/image/product/123/lg/example~2.jpg">
            <div class="img-ct" data-src="/media/image/product/123/lg/example~2.jpg">
              <img
                class="product-image"
                data-big-webp="/media/image/product/123/lg/example~2.webp"
                data-index="1"
              >
            </div>
          </a>
          <a data-href="/media/image/product/123/lg/example~3.jpg">
            <div class="img-ct" data-src="/media/image/product/123/lg/example~3.jpg">
              <img
                class="product-image"
                data-big-webp="/media/image/product/123/lg/example~3.webp"
                data-index="2"
              >
            </div>
          </a>
        </div>
      </div>
    `;

    expect(
      extractSupplierImagesFromHtml(html, "https://bloomtech.de/example"),
    ).toEqual([
      "https://bloomtech.de/media/image/product/123/lg/example.webp",
      "https://bloomtech.de/media/image/product/123/lg/example~2.webp",
      "https://bloomtech.de/media/image/product/123/lg/example~3.webp",
    ]);
  });
});

describe("Bloomtech authentication detection", () => {
  it("does not mistake the guest Mein Konto page for an authenticated session", async () => {
    const { isBloomtechAuthenticatedHtml } = await loadScraper();
    const html = `
      <h1>Mein Konto</h1>
      <form action="/Konto" method="post">
        <input name="email" type="email">
        <input name="passwort" type="password">
        <button name="login" value="1">Anmelden</button>
      </form>
    `;

    expect(isBloomtechAuthenticatedHtml(html)).toBe(false);
  });

  it("accepts an account page with a logout action and no login form", async () => {
    const { isBloomtechAuthenticatedHtml } = await loadScraper();

    expect(
      isBloomtechAuthenticatedHtml(
        '<nav><a href="/Konto?logout=1">Abmelden</a></nav>',
      ),
    ).toBe(true);
  });
});
