import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const MAINTENANCE_FLAG = "1";

export async function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== MAINTENANCE_FLAG) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const role = token?.role;
  if (role === "ADMIN" || role === "STAFF") {
    const res = NextResponse.next();
    res.headers.set("x-maintenance-role", String(role));
    res.headers.set("x-maintenance-token", token ? "present" : "missing");
    return res;
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
    const res = NextResponse.next();
    res.headers.set("x-maintenance-role", String(role ?? "none"));
    res.headers.set("x-maintenance-token", token ? "present" : "missing");
    return res;
  }

  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-maintenance-role", String(role ?? "none"));
    res.headers.set("x-maintenance-token", token ? "present" : "missing");
    return res;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  const res = NextResponse.redirect(url);
  res.headers.set("x-maintenance-role", String(role ?? "none"));
  res.headers.set("x-maintenance-token", token ? "present" : "missing");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
