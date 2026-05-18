import { NextResponse } from "next/server";

export const ADMIN_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function applyAdminHeaders(
  response: Response,
  headers?: HeadersInit,
) {
  Object.entries(ADMIN_NO_STORE_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  if (headers) {
    new Headers(headers).forEach((value, key) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export function adminAttachmentHeaders(filename: string, contentType: string) {
  return {
    ...ADMIN_NO_STORE_HEADERS,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  } as const;
}

export function adminJson(body: unknown, init?: ResponseInit) {
  return applyAdminHeaders(
    NextResponse.json(body, {
      ...init,
      headers: init?.headers,
    }),
  );
}
