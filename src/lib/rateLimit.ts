import "server-only";
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

export function getClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
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
