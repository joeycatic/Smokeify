const ANALYTICS_TIME_ZONE = "Europe/Berlin";
const DAY_MS = 24 * 60 * 60 * 1000;

export const ADMIN_ANALYTICS_PRESET_OPTIONS = [
  { value: 1, label: "Today", longLabel: "Today" },
  { value: 7, label: "7d", longLabel: "7 days" },
  { value: 14, label: "14d", longLabel: "14 days" },
  { value: 30, label: "30d", longLabel: "30 days" },
  { value: 90, label: "90d", longLabel: "90 days" },
  { value: 365, label: "1y", longLabel: "1 year" },
] as const;

export type AdminAnalyticsPresetDays =
  (typeof ADMIN_ANALYTICS_PRESET_OPTIONS)[number]["value"];
export type AdminAnalyticsMetric = "revenue" | "margin" | "orders" | "conversion";
export type AdminAnalyticsBucketKind = "hour" | "day" | "week" | "month";

export type AdminAnalyticsRange = {
  kind: "preset" | "custom";
  days: number;
  label: string;
  from: string;
  to: string;
  start: Date;
  endExclusive: Date;
  previousStart: Date;
  previousEndExclusive: Date;
  bucketKind: AdminAnalyticsBucketKind;
};

export type AdminAnalyticsRangeSearch = {
  days?: string | string[] | null;
  from?: string | string[] | null;
  to?: string | string[] | null;
};

export type AdminAnalyticsBucket = {
  key: string;
  label: string;
  start: Date;
  endExclusive: Date;
};

const berlinDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const berlinDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function firstValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function formatParts(date: Date) {
  return berlinDateTimeFormatter.formatToParts(date).reduce<Record<string, number>>(
    (parts, part) => {
      if (part.type !== "literal") parts[part.type] = Number(part.value);
      return parts;
    },
    {},
  );
}

function getBerlinOffsetMs(date: Date) {
  const parts = formatParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function dateKeyFromParts(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getBerlinDateKey(date = new Date()) {
  return berlinDateFormatter.format(date);
}

export function berlinDateKeyToUtc(value: string) {
  const parts = parseDateKey(value);
  if (!parts) throw new Error(`Invalid analytics date: ${value}`);
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let candidate = localMidnightAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    candidate = localMidnightAsUtc - getBerlinOffsetMs(new Date(candidate));
  }
  return new Date(candidate);
}

export function addDateKeyDays(value: string, days: number) {
  const parts = parseDateKey(value);
  if (!parts) throw new Error(`Invalid analytics date: ${value}`);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateKeyFromParts({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  });
}

function countInclusiveDays(from: string, to: string) {
  const fromParts = parseDateKey(from);
  const toParts = parseDateKey(to);
  if (!fromParts || !toParts) return null;
  const fromUtc = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toUtc = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  if (toUtc < fromUtc) return null;
  return Math.floor((toUtc - fromUtc) / DAY_MS) + 1;
}

function isPresetDays(value: number): value is AdminAnalyticsPresetDays {
  return ADMIN_ANALYTICS_PRESET_OPTIONS.some((option) => option.value === value);
}

function getBucketKind(days: number): AdminAnalyticsBucketKind {
  if (days <= 2) return "hour";
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

function makeRange(input: {
  kind: "preset" | "custom";
  days: number;
  label: string;
  from: string;
  to: string;
}): AdminAnalyticsRange {
  const start = berlinDateKeyToUtc(input.from);
  const endExclusive = berlinDateKeyToUtc(addDateKeyDays(input.to, 1));
  const previousEndExclusive = new Date(start);
  const previousStart = berlinDateKeyToUtc(addDateKeyDays(input.from, -input.days));
  return {
    ...input,
    start,
    endExclusive,
    previousStart,
    previousEndExclusive,
    bucketKind: getBucketKind(input.days),
  };
}

export function resolveAdminAnalyticsRange(
  search: AdminAnalyticsRangeSearch,
  now = new Date(),
): AdminAnalyticsRange {
  const today = getBerlinDateKey(now);
  const customFrom = firstValue(search.from);
  const customTo = firstValue(search.to);
  const customDays =
    customFrom && customTo ? countInclusiveDays(customFrom, customTo) : null;

  if (
    customFrom &&
    customTo &&
    customDays !== null &&
    customDays <= 365 &&
    customTo <= today
  ) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: customFrom.slice(0, 4) === customTo.slice(0, 4) ? undefined : "numeric",
      timeZone: ANALYTICS_TIME_ZONE,
    });
    return makeRange({
      kind: "custom",
      days: customDays,
      label: `${formatter.format(berlinDateKeyToUtc(customFrom))} – ${formatter.format(
        berlinDateKeyToUtc(customTo),
      )}`,
      from: customFrom,
      to: customTo,
    });
  }

  const parsedDays = Number(firstValue(search.days) ?? 30);
  const days = isPresetDays(parsedDays) ? parsedDays : 30;
  const option = ADMIN_ANALYTICS_PRESET_OPTIONS.find((entry) => entry.value === days)!;
  return makeRange({
    kind: "preset",
    days,
    label: option.longLabel,
    from: addDateKeyDays(today, -(days - 1)),
    to: today,
  });
}

function makeBucketLabel(start: Date, kind: AdminAnalyticsBucketKind) {
  if (kind === "hour") {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: ANALYTICS_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);
  }
  if (kind === "month") {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: ANALYTICS_TIME_ZONE,
      month: "short",
      year: "2-digit",
    }).format(start);
  }
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: ANALYTICS_TIME_ZONE,
    day: "2-digit",
    month: "short",
  }).format(start);
}

export function buildAdminAnalyticsBuckets(range: AdminAnalyticsRange): AdminAnalyticsBucket[] {
  const buckets: AdminAnalyticsBucket[] = [];
  if (range.bucketKind === "hour") {
    for (
      let cursor = range.start.getTime();
      cursor < range.endExclusive.getTime();
      cursor += 60 * 60 * 1000
    ) {
      const start = new Date(cursor);
      const endExclusive = new Date(
        Math.min(cursor + 60 * 60 * 1000, range.endExclusive.getTime()),
      );
      buckets.push({
        key: start.toISOString(),
        label: makeBucketLabel(start, "hour"),
        start,
        endExclusive,
      });
    }
    return buckets;
  }

  if (range.bucketKind === "month") {
    let cursorKey = range.from;
    while (cursorKey <= range.to) {
      const parts = parseDateKey(cursorKey)!;
      const nextMonth = new Date(Date.UTC(parts.year, parts.month, 1));
      const nextMonthKey = dateKeyFromParts({
        year: nextMonth.getUTCFullYear(),
        month: nextMonth.getUTCMonth() + 1,
        day: 1,
      });
      const bucketEndKey = nextMonthKey <= range.to ? nextMonthKey : addDateKeyDays(range.to, 1);
      const start = berlinDateKeyToUtc(cursorKey);
      const endExclusive = berlinDateKeyToUtc(bucketEndKey);
      buckets.push({
        key: cursorKey,
        label: makeBucketLabel(start, "month"),
        start,
        endExclusive,
      });
      cursorKey = bucketEndKey;
    }
    return buckets;
  }

  const stepDays = range.bucketKind === "week" ? 7 : 1;
  let cursorKey = range.from;
  while (cursorKey <= range.to) {
    const nextKey = addDateKeyDays(cursorKey, stepDays);
    const cappedEndKey = nextKey <= range.to ? nextKey : addDateKeyDays(range.to, 1);
    const start = berlinDateKeyToUtc(cursorKey);
    buckets.push({
      key: cursorKey,
      label: makeBucketLabel(start, range.bucketKind),
      start,
      endExclusive: berlinDateKeyToUtc(cappedEndKey),
    });
    cursorKey = cappedEndKey;
  }
  return buckets;
}

export function parseAdminAnalyticsMetric(
  value: string | string[] | null | undefined,
): AdminAnalyticsMetric {
  const normalized = firstValue(value);
  return normalized === "margin" ||
    normalized === "orders" ||
    normalized === "conversion"
    ? normalized
    : "revenue";
}
