import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const MAINTENANCE_FLAG = "1";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  if (host === "www.smokeify.de") {
    const url = request.nextUrl.clone();
    url.host = "smokeify.de";
    return NextResponse.redirect(url);
  }

  if (process.env.MAINTENANCE_MODE !== MAINTENANCE_FLAG) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const role = token?.role;
  if (role === "ADMIN" || role === "STAFF") {
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
