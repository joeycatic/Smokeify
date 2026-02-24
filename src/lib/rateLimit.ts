import "server-only";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
  const rows = await prisma.$queryRaw<
    Array<{ count: number; resetAt: Date }>
  >(Prisma.sql`
    INSERT INTO "RateLimit" ("key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${key}, 1, ${nextResetAt}, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimit"."resetAt" <= ${now} THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimit"."resetAt" <= ${now} THEN ${nextResetAt}
        ELSE "RateLimit"."resetAt"
      END,
      "updatedAt" = NOW()
    WHERE "RateLimit"."resetAt" <= ${now} OR "RateLimit"."count" < ${limit}
    RETURNING "count", "resetAt"
  `);

  if (rows.length > 0) {
    const current = rows[0];
    return {
      allowed: true,
      remaining: Math.max(limit - current.count, 0),
      resetAt: current.resetAt,
    };
  }

  const existing = await prisma.rateLimit.findUnique({
    where: { key },
    select: { resetAt: true },
  });
  return {
    allowed: false,
    remaining: 0,
    resetAt: existing?.resetAt ?? nextResetAt,
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
