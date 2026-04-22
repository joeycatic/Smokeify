import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { adminJson } from "@/lib/adminApi";
import { requireFreshAdmin } from "@/lib/adminCatalog";
import { canAdminPerformAction, type AdminAction } from "@/lib/adminPermissions";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

type AdminRouteOptions = {
  sameOrigin?: boolean;
  action?: AdminAction;
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

export function withAdminRoute<TParams extends Record<string, string> = Record<string, string>>(
  handler: AdminRouteHandler<TParams>,
  options: AdminRouteOptions = {},
) {
  return async (
    request: NextRequest,
    context?: { params?: Promise<TParams> | TParams },
  ) => {
    if (options.sameOrigin !== false && !isSameOrigin(request)) {
      return adminJson({ error: "Forbidden" }, { status: 403 });
    }

    if (options.rateLimit) {
      const ip = getClientIp(request.headers);
      const result = await checkRateLimit({
        key: `${options.rateLimit.keyPrefix}:ip:${ip}`,
        limit: options.rateLimit.limit,
        windowMs: options.rateLimit.windowMs,
      });
      if (!result.allowed) {
        return adminJson(
          { error: options.rateLimit.message ?? "Zu viele Anfragen. Bitte später erneut versuchen." },
          { status: 429 },
        );
      }
    }

    const session = await requireFreshAdmin();
    if (!session) {
      return adminJson({ error: "Unauthorized" }, { status: 401 });
    }

    if (options.action && !canAdminPerformAction(session.user.role, options.action)) {
      return adminJson({ error: "Forbidden" }, { status: 403 });
    }

    const params =
      context?.params && typeof (context.params as Promise<TParams>).then === "function"
        ? await (context.params as Promise<TParams>)
        : ((context?.params as TParams | undefined) ?? ({} as TParams));

    return handler({
      request,
      params,
      session,
    });
  };
}
