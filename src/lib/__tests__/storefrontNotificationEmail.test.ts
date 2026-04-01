import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildBackInStockEmail: typeof import("../storefrontNotificationEmail").buildBackInStockEmail;
let buildCheckoutRecoveryEmail: typeof import("../storefrontNotificationEmail").buildCheckoutRecoveryEmail;
const originalUnsubscribeSecret = process.env.UNSUBSCRIBE_SECRET;

describe("storefrontNotificationEmail", () => {
  beforeAll(async () => {
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    ({ buildBackInStockEmail, buildCheckoutRecoveryEmail } = await import(
      "../storefrontNotificationEmail"
    ));
  });

  afterAll(() => {
    process.env.UNSUBSCRIBE_SECRET = originalUnsubscribeSecret;
  });

  it("renders GrowVault back-in-stock emails with GrowVault links", () => {
    const email = buildBackInStockEmail({
      storefront: "GROW",
      recipientEmail: "grow@example.com",
      productTitle: "BioBizz Light Mix",
      variantTitle: "50L",
      fallbackOrigin: "https://growvault.test",
    });

    expect(email.subject).toContain("GrowVault");
    expect(email.html).toContain("BioBizz Light Mix (50L)");
    expect(email.html).toContain("https://growvault.test/products");
    expect(email.text).toContain("Abmelden: https://growvault.test/api/newsletter/unsubscribe");
  });

  it("renders GrowVault checkout recovery emails with GrowVault cart links", () => {
    const email = buildCheckoutRecoveryEmail({
      storefront: "GROW",
      recipientEmail: "grow@example.com",
      sessionId: "cs_test_grow_123",
      fallbackOrigin: "https://growvault.test",
    });

    expect(email.subject).toContain("GrowVault");
    expect(email.html).toContain("https://growvault.test/cart");
    expect(email.text).toContain("cs_test_grow_123");
    expect(email.html).toContain("#163a2a");
  });
});
