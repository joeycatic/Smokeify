import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildNewsletterCampaignEmail: typeof import("../newsletterEmail").buildNewsletterCampaignEmail;
const originalUnsubscribeSecret = process.env.UNSUBSCRIBE_SECRET;

describe("newsletterEmail", () => {
  beforeAll(async () => {
    process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
    ({ buildNewsletterCampaignEmail } = await import("../newsletterEmail"));
  });

  afterAll(() => {
    process.env.UNSUBSCRIBE_SECRET = originalUnsubscribeSecret;
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
    expect(email.html).toContain("linear-gradient(135deg,#0d2219 0%,#143126 44%,#1d4532 76%,#8ea85f 100%)");
    expect(email.html).toContain("#163a2a");
  });
});
