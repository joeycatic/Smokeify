import { getClientIp, getRateLimitStatus, LOGIN_RATE_LIMIT } from "@/lib/rateLimit";
import { jsonApi, hasJsonContentType } from "@/lib/apiRoute";
import { isSameOrigin } from "@/lib/requestSecurity";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonApi({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasJsonContentType(request)) {
    return jsonApi({ error: "Expected application/json" }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as { identifier?: string } | null;
  const identifier = body?.identifier?.trim().toLowerCase();

  if (!identifier) {
    return jsonApi({ error: "Missing identifier" }, { status: 400 });
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
  const resetAt = ipStatus.limited ? ipStatus.resetAt : identifierStatus.resetAt;
  const remaining = limited ? 0 : Math.min(LOGIN_RATE_LIMIT.ipLimit - 1, LOGIN_RATE_LIMIT.identifierLimit - 1);

  return jsonApi(
    {
      limited,
      resetAt: resetAt.toISOString(),
    },
    undefined,
    {
      rateLimit: {
        limit: Math.min(LOGIN_RATE_LIMIT.ipLimit, LOGIN_RATE_LIMIT.identifierLimit),
        remaining,
        resetAt,
      },
    },
  );
}
