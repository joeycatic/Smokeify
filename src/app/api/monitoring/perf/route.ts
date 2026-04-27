import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { hasJsonContentType, jsonApi, emptyApi } from "@/lib/apiRoute";
import { isSameOrigin } from "@/lib/requestSecurity";

type PerfPayload =
  | {
      kind: "web-vital";
      name: string;
      value: number;
      rating: string;
      id: string;
      path: string;
      navigationType?: string;
    }
  | {
      kind: "page-resources";
      path: string;
      htmlTransferSize: number;
      staticTransferSize: number;
      scriptTransferSize: number;
      stylesheetTransferSize: number;
      scriptResourceCount: number;
      stylesheetResourceCount: number;
    };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonApi({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasJsonContentType(request)) {
    return jsonApi({ error: "Expected application/json" }, { status: 415 });
  }

  const limit = 60;
  const rateLimit = await checkRateLimit({
    key: `perf-monitoring:${getClientIp(request.headers)}`,
    limit,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return jsonApi(
      { error: "Too many requests" },
      { status: 429 },
      { rateLimit: { limit, remaining: rateLimit.remaining, resetAt: rateLimit.resetAt } },
    );
  }

  const payload = (await request.json().catch(() => null)) as PerfPayload | null;
  if (!payload) {
    return jsonApi(
      { error: "Invalid payload" },
      { status: 400 },
      { rateLimit: { limit, remaining: rateLimit.remaining, resetAt: rateLimit.resetAt } },
    );
  }

  console.info("[perf:client]", JSON.stringify(payload));
  return emptyApi(204, {
    rateLimit: { limit, remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
  });
}
