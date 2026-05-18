import { describe, expect, it } from "vitest";
import {
  normalizeAdminSavedViewFilters,
  normalizeAdminSavedViewRoute,
} from "@/lib/adminSavedViewValidation";

describe("adminSavedViewValidation", () => {
  it("accepts only admin routes and strips query strings", () => {
    expect(normalizeAdminSavedViewRoute("/admin/orders?status=open")).toBe("/admin/orders");
    expect(normalizeAdminSavedViewRoute("/products")).toBeNull();
  });

  it("serializes only non-empty string filters", () => {
    expect(
      normalizeAdminSavedViewFilters({
        q: " tents ",
        status: ["OPEN"],
        empty: "",
        count: 3,
      }),
    ).toEqual({ q: "tents", status: "OPEN" });
  });
});
