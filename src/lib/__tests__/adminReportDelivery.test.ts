import { describe, expect, it } from "vitest";
import {
  computeNextAdminReportDelivery,
  formatAdminReportDeliveryLabel,
  isValidAdminReportDeliveryRecipient,
  normalizeAdminReportDeliveryRecipients,
  parseAdminReportDeliveryFrequency,
} from "@/lib/adminReportDelivery";

describe("adminReportDelivery", () => {
  it("parses only supported delivery frequencies", () => {
    expect(parseAdminReportDeliveryFrequency("DAILY")).toBe("DAILY");
    expect(parseAdminReportDeliveryFrequency("WEEKLY")).toBe("WEEKLY");
    expect(parseAdminReportDeliveryFrequency("monthly")).toBeNull();
  });

  it("computes the next daily delivery in UTC", () => {
    const next = computeNextAdminReportDelivery({
      frequency: "DAILY",
      hour: 8,
      from: new Date("2026-03-27T09:15:00.000Z"),
    });
    expect(next.toISOString()).toBe("2026-03-28T08:00:00.000Z");
  });

  it("computes the next weekly delivery for the configured weekday", () => {
    const next = computeNextAdminReportDelivery({
      frequency: "WEEKLY",
      hour: 6,
      weekday: 1,
      from: new Date("2026-03-27T09:15:00.000Z"),
    });
    expect(next.toISOString()).toBe("2026-03-30T06:00:00.000Z");
  });

  it("normalizes, dedupes, and lowercases delivery recipients", () => {
    expect(
      normalizeAdminReportDeliveryRecipients([
        "Ops@Smokeify.com ",
        "finance@smokeify.com",
        "ops@smokeify.com",
      ]),
    ).toEqual(["ops@smokeify.com", "finance@smokeify.com"]);
  });

  it("falls back to the legacy delivery email when recipients are missing", () => {
    expect(normalizeAdminReportDeliveryRecipients(undefined, "ops@smokeify.com")).toEqual([
      "ops@smokeify.com",
    ]);
  });

  it("validates delivery recipients with a simple email guard", () => {
    expect(isValidAdminReportDeliveryRecipient("ops@smokeify.com")).toBe(true);
    expect(isValidAdminReportDeliveryRecipient("ops-at-smokeify")).toBe(false);
  });

  it("formats delivery labels with recipient context", () => {
    expect(
      formatAdminReportDeliveryLabel({
        enabled: true,
        frequency: "DAILY",
        recipients: ["ops@smokeify.com", "finance@smokeify.com"],
        weekday: null,
        hour: 8,
      }),
    ).toBe("Daily at 08:00 UTC · 2 recipients");
  });
});
