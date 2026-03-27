export const ADMIN_TIME_RANGE_OPTIONS = [
  {
    value: 30,
    label: "30d",
    longLabel: "30 days",
    adjectiveLabel: "30-day",
  },
  {
    value: 90,
    label: "3mo",
    longLabel: "3 months",
    adjectiveLabel: "3-month",
  },
  {
    value: 365,
    label: "1y",
    longLabel: "1 year",
    adjectiveLabel: "1-year",
  },
] as const;

export type AdminTimeRangeDays = (typeof ADMIN_TIME_RANGE_OPTIONS)[number]["value"];

export type AdminTimeBucket = {
  key: string;
  label: string;
  start: Date;
  endExclusive: Date;
  dayCount: number;
};

export const DEFAULT_ADMIN_TIME_RANGE_DAYS: AdminTimeRangeDays = 30;

export function parseAdminTimeRangeDays(
  value: string | string[] | undefined,
): AdminTimeRangeDays {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized ?? DEFAULT_ADMIN_TIME_RANGE_DAYS);
  const matched = ADMIN_TIME_RANGE_OPTIONS.find((option) => option.value === parsed);
  return matched?.value ?? DEFAULT_ADMIN_TIME_RANGE_DAYS;
}

export function getAdminTimeRangeOption(days: AdminTimeRangeDays) {
  return (
    ADMIN_TIME_RANGE_OPTIONS.find((option) => option.value === days) ??
    ADMIN_TIME_RANGE_OPTIONS[0]
  );
}

export function getAdminTimeWindowStart(days: number) {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function buildAdminSearchHref(
  pathname: string,
  params: Record<string, string | undefined>,
) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getBucketCount(days: AdminTimeRangeDays) {
  if (days === 30) return 10;
  if (days === 90) return 13;
  return 12;
}

function formatBucketLabel(start: Date, endInclusive: Date, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });
  const startLabel = formatter.format(start);
  const endLabel = formatter.format(endInclusive);
  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
}

export function buildAdminTimeBuckets(
  days: AdminTimeRangeDays,
  locale: string,
): AdminTimeBucket[] {
  const bucketCount = getBucketCount(days);
  const windowStart = getAdminTimeWindowStart(days);
  const baseBucketSize = Math.floor(days / bucketCount);
  const remainder = days % bucketCount;
  const buckets: AdminTimeBucket[] = [];

  let cursor = new Date(windowStart);
  for (let index = 0; index < bucketCount; index += 1) {
    const dayCount = baseBucketSize + (index < remainder ? 1 : 0);
    const start = new Date(cursor);
    const endExclusive = new Date(start);
    endExclusive.setDate(endExclusive.getDate() + dayCount);
    const endInclusive = new Date(endExclusive);
    endInclusive.setDate(endInclusive.getDate() - 1);

    buckets.push({
      key: start.toISOString().slice(0, 10),
      label: formatBucketLabel(start, endInclusive, locale),
      start,
      endExclusive,
      dayCount,
    });

    cursor = endExclusive;
  }

  return buckets;
}
