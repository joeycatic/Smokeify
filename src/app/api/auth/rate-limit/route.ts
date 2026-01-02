import { NextResponse } from "next/server";
import { getClientIp, getRateLimitStatus, LOGIN_RATE_LIMIT } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const body = (await request.json()) as { identifier?: string };
  const identifier = body.identifier?.trim().toLowerCase();

  if (!identifier) {
    return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
  }

  const ip = getClientIp(request.headers);
  const ipStatus = await getRateLimitStatus({
    key: `login:ip:${ip}`,
    limit: LOGIN_RATE_LIMIT.ipLimit,
  });
  const identifierStatus = await getRateLimitStatus({
    key: `login:identifier:${identifier}`,
    limit: LOGIN_RATE_LIMIT.identifierLimit,
  });

  const limited = ipStatus.limited || identifierStatus.limited;
  return NextResponse.json({
    limited,
    resetAt: (ipStatus.limited ? ipStatus.resetAt : identifierStatus.resetAt).toISOString(),
  });
}
