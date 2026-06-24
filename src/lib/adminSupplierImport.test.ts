import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateSupplierSellPriceCents,
  mapScrapedItem,
  normalizeBloomtechCategoryUrl,
  normalizeSupplierImportItemIds,
  normalizeSupplierImportEdits,
} from "@/lib/adminSupplierImport";

describe("adminSupplierImport", () => {
  it("accepts and normalizes Bloomtech category URLs", () => {
    expect(
      normalizeBloomtechCategoryUrl("https://bloomtech.de/Biobizz_1#products"),
    ).toBe("https://bloomtech.de/Biobizz_1");
  });

  it("rejects non-Bloomtech hosts", () => {
    expect(() =>
      normalizeBloomtechCategoryUrl("https://example.com/category"),
    ).toThrow("bloomtech.de");
  });

  it("uses the importer-compatible 20 percent margin and 99-cent rounding", () => {
    expect(calculateSupplierSellPriceCents(1000)).toBe(1299);
    expect(calculateSupplierSellPriceCents(2500)).toBe(3099);
  });

  it("normalizes editable numeric values and image URLs", () => {
    expect(
      normalizeSupplierImportEdits({
        title: "  Product  ",
        handle: "My Product",
        stockQuantity: 4.6,
        costCents: 1234.4,
        compareAtCents: 1699.4,
        imageUrls: [
          "https://bloomtech.de/image.webp",
          "https://bloomtech.de/image.webp",
          "javascript:alert(1)",
        ],
      }),
    ).toEqual({
      title: "Product",
      handle: "my-product",
      stockQuantity: 5,
      costCents: 1234,
      compareAtCents: 1699,
      imageUrls: ["https://bloomtech.de/image.webp"],
    });
  });

  it("transfers a supplier discount into active and compare-at sell prices", () => {
    const mapped = mapScrapedItem({
      sourceUrl: "https://bloomtech.de/discounted-product",
      title: "Discounted product",
      price: 80,
      compareAtPrice: 100,
    });

    expect(mapped).toMatchObject({
      costCents: 8000,
      priceCents: calculateSupplierSellPriceCents(8000),
      compareAtCents: calculateSupplierSellPriceCents(10000),
    });
  });

  it("normalizes unique supplier import item IDs for bulk removal", () => {
    expect(
      normalizeSupplierImportItemIds([" item-1 ", "item-2", "item-1", "", null]),
    ).toEqual(["item-1", "item-2"]);
  });
});
