import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let buildGrowvaultReviewTelegramMessage: typeof import("../growvaultReviewNotification").buildGrowvaultReviewTelegramMessage;
const originalGrowUrl = process.env.NEXT_PUBLIC_GROW_APP_URL;

describe("growvaultReviewNotification", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.test";
    ({ buildGrowvaultReviewTelegramMessage } = await import("../growvaultReviewNotification"));
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_GROW_APP_URL = originalGrowUrl;
  });

  it("builds a GrowVault review message with product, rating, review text, and link", () => {
    const message = buildGrowvaultReviewTelegramMessage({
      storefront: "GROW",
      product: {
        title: "BioBizz Light Mix",
        handle: "biobizz-light-mix",
      },
      review: {
        rating: 4,
        title: "Solide Erde",
        body: "Hat gut funktioniert und kam schnell an.",
        guestName: "Julia",
        createdAt: new Date("2026-05-28T10:15:00.000Z"),
      },
      reviewer: {
        name: "Julia Tester",
        email: "julia@example.com",
      },
    });

    expect(message).toContain("New GrowVault review");
    expect(message).toContain("Product: BioBizz Light Mix");
    expect(message).toContain("Rating: ★★★★☆ (4/5)");
    expect(message).toContain("Reviewer: Julia");
    expect(message).toContain("Title: Solide Erde");
    expect(message).toContain("Hat gut funktioniert und kam schnell an.");
    expect(message).toContain("https://growvault.test/products/biobizz-light-mix");
  });

  it("skips non-Grow storefront reviews", () => {
    const message = buildGrowvaultReviewTelegramMessage({
      storefront: "MAIN",
      product: {
        title: "RAW Papers",
        handle: "raw-papers",
      },
      review: {
        rating: 5,
        body: "Top.",
        createdAt: new Date("2026-05-28T10:15:00.000Z"),
      },
    });

    expect(message).toBeNull();
  });
});
