import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MAINTENANCE_FLAG = "1";

export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== MAINTENANCE_FLAG) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const allowlist = [
    "/maintenance",
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
