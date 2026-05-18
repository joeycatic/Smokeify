import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildRefundRequestEmail: typeof import("../refundRequestEmail").buildRefundRequestEmail;

process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.test";
process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.test";

describe("refundRequestEmail", () => {
  beforeAll(async () => {
    ({ buildRefundRequestEmail } = await import("../refundRequestEmail"));
  });

  it("renders Smokeify refund request emails with Smokeify links", () => {
    const email = buildRefundRequestEmail(
      {
        orderId: "ord_test_12345678",
        customerName: "Max Mustermann",
      },
      {
        fallbackOrigin: "https://smokeify.test",
        refundRequestUrl: "https://smokeify.test/returns/request/ord_test_12345678?token=abc",
      },
    );

    expect(email.subject).toContain("Smokeify");
    expect(email.html).toContain("https://smokeify.test/products");
    expect(email.html).toContain("Formular auf Smokeify öffnen");
    expect(email.text).toContain("Max Mustermann");
  });

  it("renders GrowVault refund request emails with GrowVault branding", () => {
    const email = buildRefundRequestEmail(
      {
        orderId: "ord_test_12345678",
        customerName: "Lisa Grow",
      },
      {
        storefront: "GROW",
        fallbackOrigin: "https://growvault.test",
        refundRequestUrl: "https://growvault.test/returns/request/ord_test_12345678?token=abc",
      },
    );

    expect(email.subject).toContain("GrowVault");
    expect(email.html).toContain("GrowVault");
    expect(email.html).toContain("https://growvault.test/products");
    expect(email.html).toContain("Formular auf GrowVault öffnen");
  });
});
