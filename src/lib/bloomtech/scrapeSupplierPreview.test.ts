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
    `;

    expect(extractBloomtechPricingFromHtml(html)).toEqual({
      currentNetCents: 6723,
      compareAtNetCents: 8403,
    });
  });

  it("does not create a compare-at price without a real discount", async () => {
    const { extractBloomtechPricingFromHtml } = await loadScraper();
    const html = '<meta itemprop="price" content="67.23">';

    expect(extractBloomtechPricingFromHtml(html)).toEqual({
      currentNetCents: 6723,
      compareAtNetCents: null,
    });
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
