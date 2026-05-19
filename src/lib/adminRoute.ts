import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { adminJson } from "@/lib/adminApi";
import { requireFreshAdmin } from "@/lib/adminCatalog";
import {
  canAdminPerformAction,
  getRequiredAdminApiScope,
  hasAdminScope,
  type AdminAction,
  type AdminRole,
  type AdminScope,
} from "@/lib/adminPermissions";
import { formatServerTiming, getNow } from "@/lib/perf";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

type AdminRouteOptions = {
  sameOrigin?: boolean;
  action?: AdminAction;
  scope?: AdminScope | AdminScope[];
  role?: AdminRole;
  rateLimit?: {
    keyPrefix: string;
    limit: number;
    windowMs: number;
    message?: string;
  };
};

type AdminRouteContext<TParams extends Record<string, string>> = {
  request: NextRequest;
  params: TParams;
  session: Session;
};

type AdminRouteHandler<TParams extends Record<string, string>> = (
  context: AdminRouteContext<TParams>,
) => Promise<Response>;

const applyAdminResponseHeaders = (
  response: Response,
  rateLimit?: { limit: number; remaining: number; resetAt: Date },
  serverTimings?: Array<{ name: string; durationMs: number; description?: string }>,
) => {
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (serverTimings && serverTimings.length > 0) {
    const headerValue = formatServerTiming(serverTimings);
    if (headerValue) {
      response.headers.set("Server-Timing", headerValue);
    }
    const total = serverTimings
      .filter((metric) => metric.name === "total")
      .at(0)?.durationMs;
    if (typeof total === "number") {
      response.headers.set("X-Response-Time", `${Math.round(total * 100) / 100}ms`);
    }
  }
  if (rateLimit) {
    response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    response.headers.set("X-RateLimit-Remaining", String(Math.max(0, rateLimit.remaining)));
    response.headers.set("X-RateLimit-Reset", rateLimit.resetAt.toISOString());
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
    );
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }
  return response;
};

export function withAdminRoute<TParams extends Record<string, string> = Record<string, string>>(
  handler: AdminRouteHandler<TParams>,
  options: AdminRouteOptions = {},
) {
  return async (
    request: NextRequest,
    context?: { params?: Promise<unknown> | TParams },
  ) => {
    const requestStartedAt = getNow();
    const serverTimings: Array<{ name: string; durationMs: number; description?: string }> = [];

    const pushTiming = (name: string, startedAt: number, description?: string) => {
      serverTimings.push({
        name,
        durationMs: getNow() - startedAt,
        description,
      });
    };

    const finalize = (
      response: Response,
      rateLimitMeta?: {
        limit: number;
        remaining: number;
        resetAt: Date;
      },
    ) => {
      serverTimings.push({
        name: "total",
        durationMs: getNow() - requestStartedAt,
        description: request.nextUrl.pathname,
      });
      return applyAdminResponseHeaders(response, rateLimitMeta, serverTimings);
    };

    if (options.sameOrigin !== false && !isSameOrigin(request)) {
      pushTiming("origin", requestStartedAt, "same-origin-check");
      return finalize(adminJson({ error: "Forbidden" }, { status: 403 }));
    }
    pushTiming("origin", requestStartedAt, "same-origin-check");

    let rateLimitMeta:
      | {
          limit: number;
          remaining: number;
          resetAt: Date;
        }
      | undefined;

    if (options.rateLimit) {
      const rateLimitStartedAt = getNow();
      const ip = getClientIp(request.headers);
      const result = await checkRateLimit({
        key: `${options.rateLimit.keyPrefix}:ip:${ip}`,
        limit: options.rateLimit.limit,
        windowMs: options.rateLimit.windowMs,
      });
      rateLimitMeta = {
        limit: options.rateLimit.limit,
        remaining: result.remaining,
        resetAt: result.resetAt,
      };
      pushTiming("ratelimit", rateLimitStartedAt);
      if (!result.allowed) {
        return finalize(
          adminJson(
            { error: options.rateLimit.message ?? "Zu viele Anfragen. Bitte später erneut versuchen." },
            { status: 429 },
          ),
          rateLimitMeta,
        );
      }
    }

    const authStartedAt = getNow();
    const session = await requireFreshAdmin();
    pushTiming("auth", authStartedAt);
    if (!session) {
      return finalize(adminJson({ error: "Unauthorized" }, { status: 401 }), rateLimitMeta);
    }

    if (options.role && session.user.role !== options.role) {
      return finalize(adminJson({ error: "Forbidden" }, { status: 403 }), rateLimitMeta);
    }

    const inferredScope =
      options.scope ?? getRequiredAdminApiScope(request.nextUrl.pathname, request.method);
    if (inferredScope && !hasAdminScope(session.user.role, inferredScope)) {
      return finalize(adminJson({ error: "Forbidden" }, { status: 403 }), rateLimitMeta);
    }

    if (options.action && !canAdminPerformAction(session.user.role, options.action)) {
      return finalize(adminJson({ error: "Forbidden" }, { status: 403 }), rateLimitMeta);
    }

    const params =
      context?.params && typeof (context.params as Promise<unknown>).then === "function"
        ? ((await (context.params as Promise<unknown>)) as TParams)
        : ((context?.params as TParams | undefined) ?? ({} as TParams));

    const handlerStartedAt = getNow();
    const response = await handler({
      request,
      params,
      session,
    });
    pushTiming("handler", handlerStartedAt);

    return finalize(response, rateLimitMeta);
  };
}
