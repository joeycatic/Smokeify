import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const MAINTENANCE_FLAG = "1";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const maintenanceActive = process.env.MAINTENANCE_MODE === MAINTENANCE_FLAG;
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

  if (pathname.startsWith("/maintenance")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const role = token?.role as string | undefined;
    const isAdmin = role === "ADMIN";
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
