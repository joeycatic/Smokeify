import "server-only";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

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
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);

  const incremented = await prisma.rateLimit.updateMany({
    where: {
      key,
      resetAt: { gt: now },
      count: { lt: limit },
    },
    data: { count: { increment: 1 } },
  });

  if (incremented.count > 0) {
    const current = await prisma.rateLimit.findUnique({
      where: { key },
      select: { count: true, resetAt: true },
    });
    const currentCount = current?.count ?? 1;
    const resetAt = current?.resetAt ?? nextResetAt;
    return {
      allowed: true,
      remaining: Math.max(limit - currentCount, 0),
      resetAt,
    };
  }

  const existing = await prisma.rateLimit.findUnique({
    where: { key },
    select: { count: true, resetAt: true },
  });

  if (!existing || existing.resetAt <= now) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: nextResetAt },
      update: { count: 1, resetAt: nextResetAt },
    });
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt: nextResetAt,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt: existing.resetAt,
  };
}

export async function getRateLimitStatus({
  key,
  limit,
}: {
  key: string;
  limit: number;
}) {
  const now = new Date();
  const entry = await prisma.rateLimit.findUnique({
    where: { key },
    select: { count: true, resetAt: true },
  });
  if (!entry || entry.resetAt <= now) {
    return { limited: false, resetAt: now };
  }
  return { limited: entry.count >= limit, resetAt: entry.resetAt };
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
