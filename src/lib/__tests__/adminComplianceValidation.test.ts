import { describe, expect, it } from "vitest";
import { normalizeAdminComplianceMutationInput } from "@/lib/adminComplianceValidation";

describe("adminComplianceValidation", () => {
  it("rejects unknown compliance actions", () => {
    expect(normalizeAdminComplianceMutationInput({ action: "ship_it" })).toBeNull();
  });

  it("normalizes compliance mutation payloads", () => {
    expect(
      normalizeAdminComplianceMutationInput({
        action: "set_feed_eligibility",
        note: " reviewed ",
        eligible: true,
        ownerEmail: " admin@example.com ",
      }),
    ).toEqual({
      action: "set_feed_eligibility",
      note: "reviewed",
      blocker: "",
      ownerId: null,
      ownerEmail: "admin@example.com",
      eligible: true,
    });
  });
});
