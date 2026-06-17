import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

async function dismissCookieBanner(page: Page) {
  const acceptCookies = page.getByRole("button", { name: "Alle akzeptieren" });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
  }
}

async function firstCatalogProductHref(page: Page) {
  return page.locator('a[href^="/products/"]').evaluateAll((links) => {
    const productHrefPattern = /^\/products\/[^/?#]+$/;
    const hrefs = links
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => Boolean(href));

    return hrefs.find((href) => productHrefPattern.test(href)) ?? null;
  });
}

async function gotoStorefront(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
}

test("homepage renders primary storefront entry points", async ({ page }) => {
  await gotoStorefront(page, "/");

  await expect(
    page.getByRole("link", { name: /Setup konfigurieren/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Pflanzenfoto analysieren/i }).first(),
  ).toBeVisible();
});

test("products page renders a catalog state", async ({ page }) => {
  await gotoStorefront(page, "/products");

  await expect(page.getByRole("heading", { name: /Unsere Produkte|Produkte/i })).toBeVisible();
  await expect(page.getByPlaceholder("Produkte suchen...").last()).toBeVisible();

  const productHref = await firstCatalogProductHref(page);
  if (productHref) {
    await expect(page.locator(`a[href="${productHref}"]`).first()).toBeVisible();
  } else {
    await expect(page.getByText("Keine Produkte gefunden")).toBeVisible();
  }
});

test("configured product can reach cart and checkout start when stock is available", async ({
  page,
}) => {
  const productHref = process.env.SMOKEIFY_E2E_PRODUCT_PATH;
  if (!productHref) {
    test.skip(true, "Set SMOKEIFY_E2E_PRODUCT_PATH to a purchasable /products/:handle path.");
    return;
  }

  const initialCartLoad = page
    .waitForResponse(
      (response) =>
        response.url().includes("/api/cart") &&
        response.request().method() === "GET",
      { timeout: 15_000 },
    )
    .catch(() => null);
  await gotoStorefront(page, productHref);
  await initialCartLoad;

  await expect(page.getByRole("heading").first()).toBeVisible();

  const addToCart = page.getByRole("button", { name: /In den Warenkorb/ }).last();
  if (!(await addToCart.isVisible().catch(() => false))) {
    test.skip(true, "First catalog product is not currently purchasable.");
    return;
  }
  await expect(addToCart).toBeEnabled();

  const cartMutation = page.waitForResponse(
    (response) =>
      response.url().includes("/api/cart") &&
      response.request().method() === "POST" &&
      response.status() === 200,
    { timeout: 15_000 },
  );
  await addToCart.click();
  await cartMutation;

  await gotoStorefront(page, "/cart");
  await expect(page.getByRole("button", { name: "Zur Kasse" })).toBeVisible();

  await gotoStorefront(page, "/checkout/start?country=DE");
  await expect(page.getByRole("heading", { name: "Lieferdaten bestätigen" })).toBeVisible();
});
