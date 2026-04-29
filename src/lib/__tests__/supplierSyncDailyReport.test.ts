import { describe, expect, it } from "vitest";
import {
  buildSupplierSyncDailyReportMessage,
  getSupplierSyncDailyReportDedupeKey,
  isSupplierSyncDailyReportTime,
} from "@/lib/supplierSyncDailyReport";

describe("supplierSyncDailyReport", () => {
  it("detects 12:00 in Europe/Berlin across DST offsets", () => {
    expect(isSupplierSyncDailyReportTime(new Date("2026-07-01T10:00:00.000Z"))).toBe(true);
    expect(isSupplierSyncDailyReportTime(new Date("2026-01-15T11:00:00.000Z"))).toBe(true);

    expect(isSupplierSyncDailyReportTime(new Date("2026-07-01T09:00:00.000Z"))).toBe(false);
    expect(isSupplierSyncDailyReportTime(new Date("2026-01-15T10:00:00.000Z"))).toBe(false);
  });

  it("builds a Berlin-date dedupe key", () => {
    expect(getSupplierSyncDailyReportDedupeKey(new Date("2026-07-01T10:00:00.000Z"))).toBe(
      "supplier-sync-daily-report::2026-07-01",
    );
  });

  it("summarizes successful and failed sync jobs", () => {
    const { message, summary } = buildSupplierSyncDailyReportMessage({
      windowEnd: new Date("2026-07-01T10:00:00.000Z"),
      jobs: [
        {
          status: "SUCCEEDED",
          updatedAt: new Date("2026-07-01T07:00:00.000Z"),
          completedAt: new Date("2026-07-01T07:02:00.000Z"),
          lastError: null,
          lastResult: {
            processed: 120,
            updated: 7,
            skipped: 3,
            failed: 2,
            timedOut: false,
            durationMs: 45000,
          },
        },
        {
          status: "FAILED",
          updatedAt: new Date("2026-07-01T08:00:00.000Z"),
          completedAt: null,
          lastError: "Boom",
          lastResult: null,
        },
      ],
    });

    expect(summary.totalRuns).toBe(2);
    expect(summary.successfulRuns).toBe(1);
    expect(summary.failedRuns).toBe(1);
    expect(summary.processed).toBe(120);
    expect(summary.updated).toBe(7);
    expect(summary.skipped).toBe(3);
    expect(summary.failed).toBe(2);
    expect(summary.durationMs).toBe(45000);
    expect(message).toContain("Supplier Sync Tagesreport");
    expect(message).toContain("Runs: 2");
    expect(message).toContain("Erfolgreich: 1");
    expect(message).toContain("Job-Fehler: 1");
    expect(message).toContain("Produkte verarbeitet: 120");
    expect(message).toContain("Boom");
  });
});
