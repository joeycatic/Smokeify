import "server-only";
import { isIP } from "node:net";

// ---------------------------------------------------------------------------
// In-memory rate limiter — replaces the previous DB-backed implementation.
//
// Trade-off: limits are per-process. On a multi-instance deployment (e.g.
// Vercel with many concurrent serverless functions) each cold-start gets its
// own counter, so a determined attacker could theoretically spread requests
// across instances. For a small shop this is an acceptable trade-off vs.
// adding 10-50 ms of DB latency to every API request.
//
// Upgrade path: swap the `store` Map for an Upstash Redis client if you ever
// need cross-instance consistency.
// ---------------------------------------------------------------------------

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Lazily clean up expired entries on access — avoids setInterval in serverless.
const getEntry = (key: string, now: number): Entry | undefined => {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.resetAt <= now) {
    store.delete(key);
    return undefined;
  }
  return entry;
};

export const LOGIN_RATE_LIMIT = {
  identifierLimit: 5,
  ipLimit: 10,
  windowMs: 10 * 60 * 1000,
} as const;

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export async function checkRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const existing = getEntry(key, now);

  if (!existing) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(limit - 1, 0), resetAt: new Date(resetAt) };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: new Date(existing.resetAt) };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: new Date(existing.resetAt),
  };
}

export async function getRateLimitStatus({
  key,
  limit,
}: {
  key: string;
  limit: number;
}) {
  const now = Date.now();
  const entry = getEntry(key, now);
  if (!entry) return { limited: false, resetAt: new Date(now) };
  return { limited: entry.count >= limit, resetAt: new Date(entry.resetAt) };
}

export function getClientIp(
  headers: Headers | Record<string, string | string[] | undefined> | undefined
) {
  const readHeader = (name: string) => {
    if (!headers) return undefined;
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) ?? undefined;
    }
    const record = headers as Record<string, string | string[] | undefined>;
    const value = record[name] ?? record[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const parseValidIp = (value: string | undefined) => {
    if (!value) return undefined;
    const candidate = value.split(",")[0]?.trim();
    if (!candidate) return undefined;
    return isIP(candidate) ? candidate : undefined;
  };

  const directProxyIp = parseValidIp(readHeader("x-vercel-forwarded-for"));
  if (directProxyIp) return directProxyIp;

  const cloudflareIp = parseValidIp(readHeader("cf-connecting-ip"));
  if (cloudflareIp) return cloudflareIp;

  const forwarded = parseValidIp(readHeader("x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = parseValidIp(readHeader("x-real-ip"));
  if (realIp) return realIp;

  return "unknown";
}
