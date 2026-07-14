import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(360_000);

const initializedPages = new WeakSet<Page>();

async function dismissCookieBanner(page: Page) {
  const necessaryOnly = page.getByRole("button", { name: "Nur notwendige" });
  const visible = await necessaryOnly
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (visible) await necessaryOnly.click();
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
  if (!initializedPages.has(page)) {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "smokeify-newsletter-offer-dismissed-v1",
        "e2e",
      );
    });
    initializedPages.add(page);
  }
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test("homepage renders primary storefront entry points", async ({ page }) => {
  await gotoStorefront(page, "/");

  await expect(
    page.getByRole("link", { name: /Setup konfigurieren/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Pflanzenfoto analysieren/i }).first(),
  ).toBeVisible();
  await expect(page.locator(".gv-tent-canvas")).toBeVisible();
  await expect(page.getByText(/Ziehen zum Drehen/)).toBeVisible();
});

test("products page renders a catalog state", async ({ page }) => {
  await gotoStorefront(page, "/products");

  await expect(
    page.getByRole("heading", { name: /Der Smokeify Katalog|Unsere Produkte/i }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Produkte suchen...").last()).toBeVisible();

  const productHref = await firstCatalogProductHref(page);
  if (productHref) {
    await expect(page.locator(`a[href="${productHref}"]`).first()).toBeVisible();
  } else {
    await expect(page.getByText("Keine Produkte gefunden")).toBeVisible();
  }
});

test("storefront templates do not overflow at mobile, tablet, or desktop widths", async ({
  page,
}) => {
  const paths = [
    "/",
    "/products",
    "/licht",
    "/cart",
    "/auth/signin",
    "/pages/imprint",
  ];
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await gotoStorefront(page, path);
      await expectNoPageOverflow(page);
    }
  }
});

test("mobile catalog filter is keyboard dismissible and reduced-motion safe", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoStorefront(page, "/products");

  const filterButton = page.getByRole("button", { name: /^Filter/ }).first();
  await expect(filterButton).toBeVisible();
  await filterButton.focus();
  await expect(filterButton).toBeFocused();
  await filterButton.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Finde deinen Match" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expectNoPageOverflow(page);
});

test("dynamic product template remains responsive when a test product is configured", async ({
  page,
}) => {
  let productPath = process.env.SMOKEIFY_E2E_PRODUCT_PATH;
  if (!productPath) {
    await gotoStorefront(page, "/products");
    productPath = (await firstCatalogProductHref(page)) ?? undefined;
  }
  if (!productPath) {
    test.skip(true, "No active MAIN product is available for dynamic PDP coverage.");
    return;
  }

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoStorefront(page, productPath);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expectNoPageOverflow(page);
  }
});

test("configured product can reach cart and checkout start when stock is available", async ({
  page,
}) => {
  let productHref = process.env.SMOKEIFY_E2E_PRODUCT_PATH;
  if (!productHref) {
    await gotoStorefront(page, "/products");
    productHref = (await firstCatalogProductHref(page)) ?? undefined;
  }
  if (!productHref) {
    test.skip(true, "No active MAIN product is available for cart coverage.");
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
      response.request().method() === "POST",
    { timeout: 60_000 },
  );
  await addToCart.click();
  const cartResponse = await cartMutation;
  expect(
    cartResponse.ok(),
    `Cart endpoint returned ${cartResponse.status()}: ${await cartResponse.text()}`,
  ).toBe(true);

  await gotoStorefront(page, "/cart");
  await expect(page.getByRole("button", { name: "Zur Kasse" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoStorefront(page, "/checkout/start?country=DE");
  await expect(
    page.getByRole("heading", { name: "Wohin dürfen wir liefern?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Checkout-Fortschritt" }),
  ).toBeVisible();
  const mobileSummary = page.locator(
    'button[aria-controls="checkout-order-summary-mobile"]',
  );
  await expect(mobileSummary).toBeVisible();
  await mobileSummary.click();
  await expect(page.locator("#checkout-order-summary-mobile")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(mobileSummary).toBeHidden();
  await expectNoPageOverflow(page);
});
