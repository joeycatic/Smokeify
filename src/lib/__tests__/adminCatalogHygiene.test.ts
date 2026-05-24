import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}), { virtual: true });

import { parseCatalogHygieneFilters } from "@/lib/adminCatalogHygiene";

describe("adminCatalogHygiene", () => {
  it("parses supported hygiene filters and page values", () => {
    expect(
      parseCatalogHygieneFilters({
        q: "tent",
        issueType: "missing_image",
        storefront: "GROW",
        status: "ACTIVE",
        supplierPresence: "WITH_SUPPLIER",
        page: "3",
      }),
    ).toEqual({
      q: "tent",
      issueType: "missing_image",
      storefront: "GROW",
      status: "ACTIVE",
      supplierPresence: "WITH_SUPPLIER",
      page: 3,
    });
  });

  it("falls back to safe defaults for invalid hygiene filter values", () => {
    expect(
      parseCatalogHygieneFilters({
        issueType: "unknown",
        storefront: "NOPE",
        status: "INVALID",
        supplierPresence: "MAYBE",
        page: "0",
      }),
    ).toEqual({
      q: "",
      issueType: "",
      storefront: "",
      status: "",
      supplierPresence: "",
      page: 1,
    });
  });
});
