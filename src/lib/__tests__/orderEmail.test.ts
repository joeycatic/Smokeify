import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildOrderEmail: typeof import("../orderEmail").buildOrderEmail;

process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.test";
process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.test";

const sampleOrder = {
  id: "ord_test_12345678",
  createdAt: new Date("2026-03-31T10:00:00.000Z"),
  currency: "EUR",
  amountSubtotal: 8990,
  amountTax: 1436,
  amountShipping: 690,
  amountDiscount: 0,
  amountTotal: 11016,
  items: [
    {
      name: "Grow Tent - Default Title",
      quantity: 1,
      totalAmount: 11016,
      currency: "EUR",
    },
  ],
};

describe("orderEmail", () => {
  beforeAll(async () => {
    ({ buildOrderEmail } = await import("../orderEmail"));
  });

  it("renders Smokeify branding by default", () => {
    const email = buildOrderEmail(
      "confirmation",
      sampleOrder,
      "https://smokeify.test/account/orders/ord_test_12345678",
      "https://smokeify.test/api/orders/ord_test_12345678/invoice",
      { fallbackOrigin: "https://smokeify.test" },
    );

    expect(email.html).toContain("Smokeify");
    expect(email.html).toContain("https://smokeify.test/products");
    expect(email.text).toContain("bei Smokeify");
  });

  it("renders GrowVault branding when storefront is GROW", () => {
    const email = buildOrderEmail(
      "confirmation",
      sampleOrder,
      "https://growvault.test/account/orders/ord_test_12345678",
      "https://growvault.test/api/orders/ord_test_12345678/invoice",
      {
        storefront: "GROW",
        fallbackOrigin: "https://growvault.test",
      },
    );

    expect(email.html).toContain("GrowVault");
    expect(email.html).toContain("https://growvault.test/products");
    expect(email.text).toContain("bei GrowVault");
    expect(email.html).toContain("linear-gradient(135deg,#0d2219 0%,#143126 44%,#1d4532 76%,#8ea85f 100%)");
    expect(email.html).toContain("#163a2a");
  });

  it("infers GrowVault branding from the fallback origin for legacy orders", () => {
    const email = buildOrderEmail(
      "confirmation",
      sampleOrder,
      "https://growvault.test/account/orders/ord_test_12345678",
      "https://growvault.test/api/orders/ord_test_12345678/invoice",
      {
        fallbackOrigin: "https://growvault.test",
      },
    );

    expect(email.html).toContain("GrowVault");
    expect(email.html).toContain("https://growvault.test/products");
    expect(email.text).toContain("bei GrowVault");
  });

  it("infers GrowVault branding from the real growvault domain without env host config", () => {
    const previousGrowUrl = process.env.NEXT_PUBLIC_GROW_APP_URL;
    delete process.env.NEXT_PUBLIC_GROW_APP_URL;

    try {
      const email = buildOrderEmail(
        "shipping",
        sampleOrder,
        "https://www.growvault.de/account/orders/ord_test_12345678",
        undefined,
        {
          fallbackOrigin: "https://www.growvault.de",
        },
      );

      expect(email.html).toContain("GrowVault");
      expect(email.html).toContain("https://www.growvault.de/products");
      expect(email.html).toContain("#163a2a");
    } finally {
      if (typeof previousGrowUrl === "undefined") {
        delete process.env.NEXT_PUBLIC_GROW_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_GROW_APP_URL = previousGrowUrl;
      }
    }
  });
});
