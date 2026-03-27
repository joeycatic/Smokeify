import { describe, expect, it } from "vitest";
import {
  computeNextAdminReportDelivery,
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
});
