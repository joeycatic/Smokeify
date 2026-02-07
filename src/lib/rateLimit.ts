import "server-only";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

export const LOGIN_RATE_LIMIT = {
  identifierLimit: 5,
  ipLimit: 10,
  windowMs: 10 * 60 * 1000,
} as const;

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanup = 0;

async function cleanupOldRateLimits(now: Date) {
  const nowMs = now.getTime();
  if (nowMs - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = nowMs;
  await prisma.rateLimit.deleteMany({
    where: { resetAt: { lt: now } },
  });
}

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
  const now = new Date();
  await cleanupOldRateLimits(now);
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.resetAt <= now) {
    const resetAt = new Date(now.getTime() + windowMs);
    await prisma.rateLimit.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    });
    return { allowed: true, remaining: Math.max(limit - 1, 0), resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  const updated = await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: Math.max(limit - updated.count, 0),
    resetAt: updated.resetAt,
  };
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

export async function getRateLimitStatus({
  key,
  limit,
}: {
  key: string;
  limit: number;
}) {
  const now = new Date();
  const record = await prisma.rateLimit.findUnique({ where: { key } });
  if (!record || record.resetAt <= now) {
    return { limited: false, resetAt: now };
  }
  return { limited: record.count >= limit, resetAt: record.resetAt };
}


