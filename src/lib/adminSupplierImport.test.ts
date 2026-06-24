import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateSupplierSellPriceCents,
  buildSupplierImportSourceChanges,
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
      supplierPricing: {
        discounted: true,
      },
    });

    expect(mapped).toMatchObject({
      costCents: 8000,
      priceCents: calculateSupplierSellPriceCents(8000),
      compareAtCents: calculateSupplierSellPriceCents(10000),
    });
  });

  it("ignores a compare-at price without an explicit supplier discount", () => {
    const mapped = mapScrapedItem({
      sourceUrl: "https://bloomtech.de/reference-price-only",
      title: "Reference price only",
      price: 80,
      compareAtPrice: 100,
      supplierPricing: {
        discounted: false,
      },
    });

    expect(mapped).toMatchObject({
      costCents: 8000,
      priceCents: calculateSupplierSellPriceCents(8000),
      compareAtCents: null,
    });
  });

  it("flags every supplier field that changed on a repeated scan", () => {
    const incoming = mapScrapedItem({
      sourceUrl: "https://bloomtech.de/changed-product",
      title: "Changed product",
      manufacturer: "Bloomtech",
      price: 8,
      stock: { quantity: 4 },
      supplierImages: [
        "https://bloomtech.de/image-1.webp",
        "https://bloomtech.de/image-2.webp",
      ],
    });

    expect(incoming).not.toBeNull();
    const changes = buildSupplierImportSourceChanges(
      {
        title: "Original product",
        manufacturer: "Bloomtech",
        handle: "original-product",
        shortDescription: null,
        description: null,
        technicalDetails: null,
        gtin: null,
        sku: null,
        costCents: 900,
        priceCents: calculateSupplierSellPriceCents(900),
        compareAtCents: 1299,
        stockQuantity: 1,
        weightGrams: null,
        imageUrls: ["https://bloomtech.de/image-1.webp"],
      },
      incoming!,
    );

    expect(changes.map((change) => change.field)).toEqual(
      expect.arrayContaining([
        "title",
        "handle",
        "costCents",
        "priceCents",
        "compareAtCents",
        "stockQuantity",
        "imageUrls",
      ]),
    );
  });

  it("flags a supplier discount change even when rounded sell prices match", () => {
    const incoming = mapScrapedItem({
      sourceUrl: "https://bloomtech.de/new-discount",
      title: "New discount",
      price: 8,
      compareAtPrice: 8.4,
      supplierPricing: {
        discounted: true,
        discountPercent: 5,
      },
    });

    expect(incoming).not.toBeNull();
    expect(
      buildSupplierImportSourceChanges(
        {
          title: "New discount",
          handle: "new-discount",
          costCents: 800,
          priceCents: calculateSupplierSellPriceCents(800),
          compareAtCents: null,
          stockQuantity: 0,
          imageUrls: [],
          sourcePayload: {
            supplierPricing: {
              discounted: false,
              discountPercent: null,
            },
          },
        },
        incoming!,
      ),
    ).toContainEqual({
      field: "supplierDiscount",
      label: "Supplier discount",
      currentValue: "Regular price",
      incomingValue: "Discounted (5%)",
    });
  });

  it("normalizes unique supplier import item IDs for bulk removal", () => {
    expect(
      normalizeSupplierImportItemIds([" item-1 ", "item-2", "item-1", "", null]),
    ).toEqual(["item-1", "item-2"]);
  });
});
