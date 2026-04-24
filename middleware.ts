import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { hasAdminAccess } from "@/lib/adminAccess";
import {
  getRequiredAdminApiScope,
  getRequiredAdminPageScope,
  hasAdminScope,
} from "@/lib/adminPermissions";

const MAINTENANCE_FLAG = "1";

function buildAdminLoginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/auth/admin";
  url.search = `returnTo=${encodeURIComponent(returnTo)}`;
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const maintenanceActive = process.env.MAINTENANCE_MODE === MAINTENANCE_FLAG;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminAuthPage = pathname === "/auth/admin";
  const allowlist = [
    "/admin",
    "/api",
    "/auth",
    "/_next",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ];
  const isStaticAsset = /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isAdminPage || isAdminApi || isAdminAuthPage || pathname.startsWith("/maintenance")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const role = token?.role as string | undefined;
    const hasVerifiedAdminAccess = hasAdminAccess({
      role,
      adminVerifiedAt: token?.adminVerifiedAt,
      adminAccessDisabledAt: token?.adminAccessDisabledAt,
      invalidated: token?.invalidated,
    });

    if (isAdminAuthPage) {
      if (hasVerifiedAdminAccess) {
        const requestedTarget = request.nextUrl.searchParams.get("returnTo");
        const target =
          requestedTarget && requestedTarget.startsWith("/") ? requestedTarget : "/admin";
        return NextResponse.redirect(new URL(target, request.url));
      }
      return NextResponse.next();
    }

    if (isAdminPage) {
      if (!hasVerifiedAdminAccess) {
        return NextResponse.redirect(buildAdminLoginUrl(request));
      }
      const requiredScope = getRequiredAdminPageScope(pathname);
      if (requiredScope && !hasAdminScope(role, requiredScope)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/admin";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }

      const requestHeaders = new Headers(request.headers);
      if (requiredScope) {
        requestHeaders.set("x-admin-required-scope", requiredScope);
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    if (isAdminApi) {
      if (!hasVerifiedAdminAccess) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const requiredScope = getRequiredAdminApiScope(pathname, request.method);
      if (requiredScope && !hasAdminScope(role, requiredScope)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.next();
    }

    if (pathname.startsWith("/maintenance")) {
      const isAdmin = role === "ADMIN";
      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
  }

  if (!maintenanceActive) {
    return NextResponse.next();
  }

  if (allowlist.some((path) => pathname.startsWith(path)) || isStaticAsset) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const role = token?.role as string | undefined;
  if (role === "ADMIN") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip static assets entirely so the edge middleware only runs for pages/API
  // routes that might actually need maintenance gating.
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
