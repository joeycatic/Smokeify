import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildNewsletterCampaignEmail: typeof import("../newsletterEmail").buildNewsletterCampaignEmail;
const originalUnsubscribeSecret = process.env.UNSUBSCRIBE_SECRET;
const originalGrowAppUrl = process.env.NEXT_PUBLIC_GROW_APP_URL;

describe("newsletterEmail", () => {
  beforeAll(async () => {
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.test";
    ({ buildNewsletterCampaignEmail } = await import("../newsletterEmail"));
  });

  afterAll(() => {
    process.env.UNSUBSCRIBE_SECRET = originalUnsubscribeSecret;
    if (typeof originalGrowAppUrl === "string") {
      process.env.NEXT_PUBLIC_GROW_APP_URL = originalGrowAppUrl;
    } else {
      delete process.env.NEXT_PUBLIC_GROW_APP_URL;
    }
  });

  it("renders GrowVault campaign emails with GrowVault theme tokens", () => {
    const email = buildNewsletterCampaignEmail({
      storefront: "GROW",
      recipientEmail: "grow@example.com",
      subject: "Neu bei GrowVault",
      body: "Grow-ready Produkte und Setups.",
      fallbackOrigin: "https://growvault.test",
    });

    expect(email.html).toContain("GrowVault");
    expect(email.html).toContain("https://growvault.test/products");
    expect(email.html).toContain("https://growvault.test/pages/contact");
    expect(email.html).toContain("https://growvault.test/pages/refund");
    expect(email.html).toContain("linear-gradient(135deg,#0d2219 0%,#143126 44%,#1d4532 76%,#8ea85f 100%)");
    expect(email.html).toContain("#163a2a");
  });
});
