import { describe, expect, it } from "vitest";
import {
  berlinDateKeyToUtc,
  buildAdminAnalyticsBuckets,
  resolveAdminAnalyticsRange,
} from "@/lib/adminAnalyticsRange";
import { buildAdminAnalyticsApiHref, buildAdminAnalyticsHref } from "@/lib/adminAnalyticsUrl";

describe("adminAnalyticsRange", () => {
  const now = new Date("2026-06-27T12:00:00.000Z");

  it("resolves short presets against the Berlin calendar", () => {
    const range = resolveAdminAnalyticsRange({ days: "7" }, now);

    expect(range).toMatchObject({
      kind: "preset",
      days: 7,
      from: "2026-06-21",
      to: "2026-06-27",
      bucketKind: "day",
    });
    expect(range.start.toISOString()).toBe("2026-06-20T22:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-06-27T22:00:00.000Z");
    expect(range.previousStart.toISOString()).toBe("2026-06-13T22:00:00.000Z");
  });

  it("accepts valid custom dates and rejects future, reversed, and oversized ranges", () => {
    expect(
      resolveAdminAnalyticsRange({ from: "2026-06-01", to: "2026-06-14" }, now),
    ).toMatchObject({ kind: "custom", days: 14, bucketKind: "day" });

    expect(
      resolveAdminAnalyticsRange({ from: "2026-06-28", to: "2026-06-29" }, now),
    ).toMatchObject({ kind: "preset", days: 30 });
    expect(
      resolveAdminAnalyticsRange({ from: "2026-06-14", to: "2026-06-01" }, now),
    ).toMatchObject({ kind: "preset", days: 30 });
    expect(
      resolveAdminAnalyticsRange({ from: "2025-01-01", to: "2026-06-01" }, now),
    ).toMatchObject({ kind: "preset", days: 30 });
  });

  it("uses DST-safe Berlin midnight boundaries and hourly buckets", () => {
    expect(berlinDateKeyToUtc("2026-03-29").toISOString()).toBe(
      "2026-03-28T23:00:00.000Z",
    );
    expect(berlinDateKeyToUtc("2026-03-30").toISOString()).toBe(
      "2026-03-29T22:00:00.000Z",
    );
    const springForward = resolveAdminAnalyticsRange(
      { from: "2026-03-29", to: "2026-03-29" },
      now,
    );
    expect(buildAdminAnalyticsBuckets(springForward)).toHaveLength(23);

    const fallBack = resolveAdminAnalyticsRange(
      { from: "2025-10-26", to: "2025-10-26" },
      now,
    );
    expect(buildAdminAnalyticsBuckets(fallBack)).toHaveLength(25);
  });

  it("selects daily, weekly, and monthly buckets by range length", () => {
    const daily = resolveAdminAnalyticsRange({ days: "30" }, now);
    const weekly = resolveAdminAnalyticsRange({ days: "90" }, now);
    const monthly = resolveAdminAnalyticsRange({ days: "365" }, now);

    expect(buildAdminAnalyticsBuckets(daily)).toHaveLength(30);
    expect(buildAdminAnalyticsBuckets(weekly)).toHaveLength(13);
    expect(buildAdminAnalyticsBuckets(monthly).length).toBeGreaterThanOrEqual(12);
    expect(buildAdminAnalyticsBuckets(monthly).length).toBeLessThanOrEqual(13);
  });

  it("keeps preset, custom, metric, storefront, and section state in URLs", () => {
    const preset = resolveAdminAnalyticsRange({ days: "7" }, now);
    const custom = resolveAdminAnalyticsRange(
      { from: "2026-06-01", to: "2026-06-14" },
      now,
    );

    expect(
      buildAdminAnalyticsHref({ range: preset, storefront: "MAIN", metric: "margin" }),
    ).toBe("/admin/analytics?days=7&storefront=MAIN&metric=margin");
    expect(
      buildAdminAnalyticsApiHref(
        { range: custom, storefront: "ALL", metric: "revenue" },
        "live",
      ),
    ).toBe(
      "/api/admin/analytics?from=2026-06-01&to=2026-06-14&storefront=ALL&section=live",
    );
  });
});
