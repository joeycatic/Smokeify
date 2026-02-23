import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const MAINTENANCE_FLAG = "1";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const role = token?.role as string | undefined;
  const isAdmin = role === "ADMIN";

  // /maintenance is admin-only regardless of maintenance mode
  if (pathname.startsWith("/maintenance")) {
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Outside maintenance mode — allow everything
  if (process.env.MAINTENANCE_MODE !== MAINTENANCE_FLAG) {
    return NextResponse.next();
  }

  // Maintenance mode active — only admins can browse the site
  if (isAdmin) {
    return NextResponse.next();
  }

  const allowlist = [
    "/admin",
    "/api",
    "/auth",
    "/_next",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ];

  if (allowlist.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
