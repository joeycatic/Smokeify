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
) => {
  response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
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
    context?: { params?: Promise<TParams> | TParams },
  ) => {
    if (options.sameOrigin !== false && !isSameOrigin(request)) {
      return applyAdminResponseHeaders(adminJson({ error: "Forbidden" }, { status: 403 }));
    }

    let rateLimitMeta:
      | {
          limit: number;
          remaining: number;
          resetAt: Date;
        }
      | undefined;

    if (options.rateLimit) {
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
      if (!result.allowed) {
        return applyAdminResponseHeaders(
          adminJson(
            { error: options.rateLimit.message ?? "Zu viele Anfragen. Bitte später erneut versuchen." },
            { status: 429 },
          ),
          rateLimitMeta,
        );
      }
    }

    const session = await requireFreshAdmin();
    if (!session) {
      return applyAdminResponseHeaders(adminJson({ error: "Unauthorized" }, { status: 401 }));
    }

    if (options.role && session.user.role !== options.role) {
      return applyAdminResponseHeaders(adminJson({ error: "Forbidden" }, { status: 403 }));
    }

    const inferredScope =
      options.scope ?? getRequiredAdminApiScope(request.nextUrl.pathname, request.method);
    if (inferredScope && !hasAdminScope(session.user.role, inferredScope)) {
      return applyAdminResponseHeaders(adminJson({ error: "Forbidden" }, { status: 403 }));
    }

    if (options.action && !canAdminPerformAction(session.user.role, options.action)) {
      return applyAdminResponseHeaders(adminJson({ error: "Forbidden" }, { status: 403 }));
    }

    const params =
      context?.params && typeof (context.params as Promise<TParams>).then === "function"
        ? await (context.params as Promise<TParams>)
        : ((context?.params as TParams | undefined) ?? ({} as TParams));

    return applyAdminResponseHeaders(
      await handler({
        request,
        params,
        session,
      }),
      rateLimitMeta,
    );
  };
}
