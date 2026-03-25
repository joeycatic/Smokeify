import { NextResponse } from "next/server";

export const ADMIN_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;

export function adminJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...ADMIN_NO_STORE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}
